import Foundation
import Observation
import StoreKit
import Supabase

/// Tracks whether the signed-in user has Gather Lists Pro.
///
/// The server's `subscriptions` table is the only source of truth: StoreKit
/// transactions on this device are reported to it, and Pro status is then read
/// back from it. A purchase made by this Apple ID but owned by another Gather
/// account therefore does not unlock Pro here.
@Observable
@MainActor
final class ProSubscriptionManager {
    static let productIDs = ["com.gatherlists.pro.annual", "com.gatherlists.pro.monthly"]

    /// When the user's Pro access ends, or nil when they have none.
    private(set) var proUntil: Date?

    var isPro: Bool {
        guard let proUntil else { return false }
        return proUntil > .now
    }

    /// Whether Pro limits apply to this account (the server's `pro_enforced()`):
    /// off for everyone until launch, except accounts listed as testers.
    /// While off, every feature behaves as it did before Pro existed.
    private(set) var isEnforced = UserDefaults.standard.bool(forKey: enforcementCacheKey)

    /// Whether the user may use Pro-only features of their own right now.
    var hasProAccess: Bool { !isEnforced || isPro }

    /// The last known answer for `userId`, for code that runs outside the view
    /// tree. Limits count as off until the server has said otherwise.
    static func cachedHasProAccess(for userId: UUID) -> Bool {
        guard UserDefaults.standard.bool(forKey: enforcementCacheKey) else { return true }
        guard let proUntil = cachedProUntil(for: userId) else { return false }
        return proUntil > .now
    }

    /// Ties a purchase to the signed-in account so the server can attribute it
    /// even if the app never gets to report the transaction itself.
    var purchaseOptions: Set<Product.PurchaseOption> {
        guard let userId else { return [] }
        return [.appAccountToken(userId)]
    }

    private var userId: UUID?
    private var updatesTask: Task<Void, Never>?

    /// Begins tracking Pro status for `userId`. Safe to call repeatedly.
    func start(userId: UUID) async {
        guard self.userId != userId else { return }
        stop()
        self.userId = userId
        proUntil = Self.cachedProUntil(for: userId)
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                await self?.process(update)
            }
        }
        await refresh()
    }

    /// Stops tracking and forgets the current user's status.
    func stop() {
        updatesTask?.cancel()
        updatesTask = nil
        userId = nil
        proUntil = nil
    }

    /// Reports this device's active subscriptions to the server, then reloads Pro status.
    func refresh() async {
        var reported = Set<UInt64>()
        for await entitlement in Transaction.currentEntitlements {
            guard case .verified(let transaction) = entitlement,
                  Self.productIDs.contains(transaction.productID),
                  reported.insert(transaction.originalID).inserted else { continue }
            await report(transaction)
        }
        await loadServerState()
    }

    /// Handles the outcome of a purchase made from the paywall.
    func handlePurchase(_ result: Result<Product.PurchaseResult, Error>) async {
        guard case .success(.success(let verification)) = result else { return }
        await process(verification)
    }

    private func process(_ verification: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = verification else { return }
        if Self.productIDs.contains(transaction.productID) {
            await report(transaction)
            await loadServerState()
        }
        await transaction.finish()
    }

    private func report(_ transaction: Transaction) async {
        do {
            let manager = SupabaseManager.shared
            let session = try await manager.client.auth.session
            var request = URLRequest(
                url: manager.supabaseURL.appendingPathComponent("functions/v1/sync-apple-subscription")
            )
            request.httpMethod = "POST"
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["transactionId": String(transaction.originalID)])

            let (_, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if !(200..<300).contains(status) {
                print("[ProSubscriptionManager] Reporting transaction \(transaction.originalID) failed with status \(status)")
            }
        } catch {
            print("[ProSubscriptionManager] Reporting transaction \(transaction.originalID) failed: \(error)")
        }
    }

    private func loadEnforcement() async {
        do {
            isEnforced = try await SupabaseManager.shared.client
                .rpc("pro_enforced")
                .execute()
                .value
            UserDefaults.standard.set(isEnforced, forKey: Self.enforcementCacheKey)
        } catch {
            print("[ProSubscriptionManager] Loading the enforcement switch failed: \(error)")
        }
    }

    private func loadServerState() async {
        guard let userId else { return }
        await loadEnforcement()
        do {
            let rows: [EntitlementRow] = try await SupabaseManager.shared.client
                .from("subscriptions")
                .select("expires_at")
                .eq("user_id", value: userId)
                .is("revoked_at", value: nil)
                .gt("expires_at", value: Date.now.ISO8601Format())
                .order("expires_at", ascending: false)
                .limit(1)
                .execute()
                .value
            guard self.userId == userId else { return }
            proUntil = rows.first?.expiresAt
            Self.cache(proUntil, for: userId)
        } catch {
            // Keep the last known status: a failed request must not lock a subscriber out.
            print("[ProSubscriptionManager] Loading Pro status failed: \(error)")
        }
    }

    private static let enforcementCacheKey = "proEnforced"

    private static func cacheKey(for userId: UUID) -> String {
        "proUntil.\(userId.uuidString)"
    }

    private static func cachedProUntil(for userId: UUID) -> Date? {
        UserDefaults.standard.object(forKey: cacheKey(for: userId)) as? Date
    }

    private static func cache(_ proUntil: Date?, for userId: UUID) {
        UserDefaults.standard.set(proUntil, forKey: cacheKey(for: userId))
    }
}

private struct EntitlementRow: Decodable {
    let expiresAt: Date

    enum CodingKeys: String, CodingKey {
        case expiresAt = "expires_at"
    }
}

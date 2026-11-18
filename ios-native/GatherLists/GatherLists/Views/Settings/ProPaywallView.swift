import StoreKit
import SwiftUI

/// The Gather Lists Pro purchase screen, built on Apple's subscription store.
struct ProPaywallView: View {
    @Environment(ProSubscriptionManager.self) private var proSubscription
    @Environment(\.dismiss) private var dismiss

    private static let privacyURL = URL(string: "https://gatherlists.com/privacy.html")!
    private static let termsURL = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    private static let features: [(icon: String, title: String)] = [
        ("calendar", "Plan your meals for the week"),
        ("magnifyingglass", "Search recipes online"),
        ("square.and.arrow.down", "Import recipes from any website"),
        ("person.2", "People you share with don't need Pro")
    ]

    var body: some View {
        SubscriptionStoreView(productIDs: ProSubscriptionManager.productIDs) {
            marketingContent
        }
        .storeButton(.visible, for: .restorePurchases)
        .storeButton(.visible, for: .policies)
        .subscriptionStorePolicyDestination(url: Self.privacyURL, for: .privacyPolicy)
        .subscriptionStorePolicyDestination(url: Self.termsURL, for: .termsOfService)
        .inAppPurchaseOptions { _ in proSubscription.purchaseOptions }
        .onInAppPurchaseCompletion { _, result in
            await proSubscription.handlePurchase(result)
        }
        .currentEntitlementTask(for: ProSubscriptionManager.productIDs[0]) { state in
            await refreshIfEntitled(state)
        }
        .currentEntitlementTask(for: ProSubscriptionManager.productIDs[1]) { state in
            await refreshIfEntitled(state)
        }
        .onChange(of: proSubscription.isPro) { _, isPro in
            if isPro { dismiss() }
        }
        .tint(.brandGreen)
    }

    private var marketingContent: some View {
        VStack(spacing: 16) {
            Text("Gather Lists Pro")
                .font(.quicksand(.title, weight: .bold))
                .foregroundStyle(Color.brandGreen)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Self.features, id: \.title) { feature in
                    Label(feature.title, systemImage: feature.icon)
                        .font(.quicksand(.body))
                }
            }
        }
        .padding()
    }

    /// Restoring purchases finishes without a purchase callback, so pick up a
    /// newly present entitlement here.
    private func refreshIfEntitled(_ state: EntitlementTaskState<VerificationResult<StoreKit.Transaction>?>) async {
        guard case .success(.some) = state, !proSubscription.isPro else { return }
        await proSubscription.refresh()
    }
}

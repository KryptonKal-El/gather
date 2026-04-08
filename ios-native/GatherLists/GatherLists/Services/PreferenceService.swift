import Foundation
import Supabase
import Realtime

/// Service for managing user preferences with realtime sync for last selected list.
struct PreferenceService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    private static var cachedPreferences: UserPreferences?
    
    private static let lastListIdKey = "last-list-id"
    
    // MARK: - UserDefaults Cache for Last List ID
    
    /// Reads cached last list ID from UserDefaults (instant read for launch restore).
    static func getCachedLastListId() -> UUID? {
        guard let string = UserDefaults.standard.string(forKey: lastListIdKey) else { return nil }
        return UUID(uuidString: string)
    }
    
    /// Writes last list ID to UserDefaults cache.
    static func setCachedLastListId(_ listId: UUID?) {
        if let listId {
            UserDefaults.standard.set(listId.uuidString, forKey: lastListIdKey)
        } else {
            UserDefaults.standard.removeObject(forKey: lastListIdKey)
        }
    }
    
    /// Fetches user preferences. Returns cached version if available.
    /// Falls back to system default config if no row exists.
    static func fetchUserPreferences() async throws -> UserPreferences {
        if let cached = cachedPreferences {
            return cached
        }
        
        let userId = try await client.auth.session.user.id
        
        let rows: [UserPreferences] = try await client
            .from("user_preferences")
            .select()
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value
        
        let defaultConfig = SortPipeline.systemDefault.map { $0.rawValue }
        let result = rows.first ?? UserPreferences(userId: userId, defaultSortConfig: defaultConfig)
        cachedPreferences = result
        return result
    }
    
    /// Clears cached preferences (call on sign-out or preference change from realtime).
    static func clearCache() {
        cachedPreferences = nil
    }
    
    /// Upserts the user's default sort config. Validates before writing.
    static func updateDefaultSortConfig(_ config: [SortLevel]) async throws {
        guard SortPipeline.isValid(config) else {
            throw NSError(domain: "PreferenceService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid sort config"])
        }
        
        let userId = try await client.auth.session.user.id
        let configStrings = config.map { $0.rawValue }
        let upsertData = UserPreferencesUpsert(userId: userId, defaultSortConfig: configStrings)
        
        try await client
            .from("user_preferences")
            .upsert(upsertData)
            .execute()
        
        cachedPreferences = UserPreferences(userId: userId, defaultSortConfig: configStrings)
    }
    
    /// Updates per-list sort config. Pass nil to clear override.
    static func updateListSortConfig(listId: UUID, config: [SortLevel]?) async throws {
        if let config = config {
            guard SortPipeline.isValid(config) else {
                throw NSError(domain: "PreferenceService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid sort config"])
            }
        }
        
        let configStrings = config?.map { $0.rawValue }
        let update = ListSortConfigUpdate(sortConfig: configStrings)
        
        try await client
            .from("lists")
            .update(update)
            .eq("id", value: listId)
            .execute()
    }
    
    /// Upserts the user's last selected list ID.
    static func updateLastListId(_ listId: UUID?) async throws {
        let userId = try await client.auth.session.user.id
        let upsertData = LastListIdUpsert(userId: userId, lastListId: listId)
        
        try await client
            .from("user_preferences")
            .upsert(upsertData)
            .execute()
        
        cachedPreferences?.lastListId = listId
    }
    
    /// Upserts the user's list order.
    static func updateListOrder(_ order: [String]) async throws {
        let userId = try await client.auth.session.user.id
        let upsertData = ListOrderUpsert(userId: userId, listOrder: order)
        
        try await client
            .from("user_preferences")
            .upsert(upsertData, onConflict: "user_id")
            .execute()
    }
    
    /// Updates sort config on a share row. Pass nil to clear the override (fall back to user preferences).
    static func updateShareSortConfig(listId: UUID, email: String, config: [SortLevel]?) async throws {
        if let config = config {
            guard SortPipeline.isValid(config) else {
                throw NSError(domain: "PreferenceService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid sort config"])
            }
        }
        
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let configStrings = config?.map { $0.rawValue }
        let update = ListSortConfigUpdate(sortConfig: configStrings)
        
        try await client
            .from("list_shares")
            .update(update)
            .eq("list_id", value: listId)
            .eq("shared_with_email", value: normalizedEmail)
            .execute()
    }
    
    /// Resolves the effective sort config for a list.
    /// Priority: share sort config (for shared users) → per-list override → global default → type default → system default.
    static func effectiveSortConfig(for list: GatherList, userPreferences: UserPreferences?, shareSortConfig: [String]? = nil) -> [SortLevel] {
        let configStrings: [String]
        let typeConfig = ListTypes.getConfig(list.type)
        let validLevels = Set(typeConfig.sortLevels.compactMap { SortLevel(rawValue: $0) })
        
        if let shareConfig = shareSortConfig {
            configStrings = shareConfig
        } else if let listConfig = list.sortConfig {
            configStrings = listConfig
        } else if let prefs = userPreferences {
            configStrings = prefs.defaultSortConfig
        } else {
            return SortPipeline.getDefaultConfig(for: list.type)
        }
        
        let levels = SortPipeline.normalize(configStrings.compactMap { SortLevel(rawValue: $0) })
        let filtered = levels.filter { validLevels.contains($0) }
        return filtered.isEmpty ? SortPipeline.getDefaultConfig(for: list.type) : filtered
    }
}

// MARK: - Realtime Subscription Manager

/// Manages realtime subscription for user preferences (last_list_id sync).
@MainActor
final class PreferenceRealtimeManager {
    static let shared = PreferenceRealtimeManager()
    
    private var client: SupabaseClient { SupabaseManager.shared.client }
    
    private var preferencesChannel: RealtimeChannelV2?
    private var preferencesTask: Task<Void, Never>?
    private var subscribedUserId: UUID?
    
    private init() {}
    
    /// Starts realtime subscription for user_preferences changes.
    /// Updates UserDefaults cache when last_list_id changes from another device.
    func startSubscription(userId: UUID) async {
        guard preferencesChannel == nil else { return }
        subscribedUserId = userId
        
        let channel = client.realtimeV2.channel("user-preferences-realtime-\(userId.uuidString)")
        preferencesChannel = channel
        
        let changes = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "user_preferences",
            filter: "user_id=eq.\(userId.uuidString)"
        )
        
        preferencesTask = Task {
            await channel.subscribe()
            for await _ in changes {
                await handlePreferenceChange()
            }
        }
    }
    
    /// Stops the realtime subscription (call on sign-out).
    func stopSubscription() {
        preferencesTask?.cancel()
        preferencesTask = nil
        
        let channel = preferencesChannel
        preferencesChannel = nil
        subscribedUserId = nil
        
        Task {
            await channel?.unsubscribe()
        }
    }
    
    private func handlePreferenceChange() async {
        guard let userId = subscribedUserId else { return }
        
        // Fetch latest preferences from server
        do {
            let client = SupabaseManager.shared.client
            let rows: [UserPreferences] = try await client
                .from("user_preferences")
                .select()
                .eq("user_id", value: userId)
                .limit(1)
                .execute()
                .value
            
            if let prefs = rows.first {
                // Update UserDefaults cache with server value — no navigation change
                PreferenceService.setCachedLastListId(prefs.lastListId)
                PreferenceService.clearCache()
                
                // Sync list order from server
                if let listOrder = prefs.listOrder {
                    UserDefaults.standard.set(listOrder, forKey: "gather_list_order")
                } else {
                    UserDefaults.standard.removeObject(forKey: "gather_list_order")
                }
                
                // Notify ListViewModel to rebuild
                NotificationCenter.default.post(name: .listOrderDidChange, object: nil)
            }
        } catch {
            print("[PreferenceRealtimeManager] Failed to fetch preferences: \(error.localizedDescription)")
        }
    }
}

extension Notification.Name {
    static let listOrderDidChange = Notification.Name("listOrderDidChange")
}

// MARK: - DTOs

private struct UserPreferencesUpsert: Encodable {
    let userId: UUID
    let defaultSortConfig: [String]
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case defaultSortConfig = "default_sort_config"
    }
}

private struct LastListIdUpsert: Encodable {
    let userId: UUID
    let lastListId: UUID?
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case lastListId = "last_list_id"
    }
}

private struct ListSortConfigUpdate: Encodable {
    let sortConfig: [String]?
    
    enum CodingKeys: String, CodingKey {
        case sortConfig = "sort_config"
    }
}

private struct ListOrderUpsert: Encodable {
    let userId: UUID
    let listOrder: [String]
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case listOrder = "list_order"
    }
}

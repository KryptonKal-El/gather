import Foundation
import Supabase

struct PreferenceService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    private static var cachedPreferences: UserPreferences?
    
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
    
    /// Resolves the effective sort config for a list.
    /// Priority: per-list override → global default → type default → system default.
    static func effectiveSortConfig(for list: GatherList, userPreferences: UserPreferences?) -> [SortLevel] {
        let configStrings: [String]
        
        if let listConfig = list.sortConfig {
            configStrings = listConfig
        } else if let prefs = userPreferences {
            configStrings = prefs.defaultSortConfig
        } else {
            return SortPipeline.getDefaultConfig(for: list.type)
        }
        
        let levels = SortPipeline.normalize(configStrings.compactMap { SortLevel(rawValue: $0) })
        return levels
    }
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

private struct ListSortConfigUpdate: Encodable {
    let sortConfig: [String]?
    
    enum CodingKeys: String, CodingKey {
        case sortConfig = "sort_config"
    }
}

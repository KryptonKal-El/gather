import Foundation
import Supabase

struct PreferenceService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    private static var cachedPreferences: UserPreferences?
    
    static func fetchUserPreferences() async throws -> UserPreferences {
        if let cached = cachedPreferences {
            return cached
        }
        
        let userId = try await client.auth.session.user.id
        
        let preferences: UserPreferences? = try await client
            .from("user_preferences")
            .select()
            .eq("user_id", value: userId)
            .maybeSingle()
            .execute()
            .value
        
        let result = preferences ?? UserPreferences(userId: userId, defaultSortMode: "store-category")
        cachedPreferences = result
        return result
    }
    
    static func updateDefaultSortMode(_ mode: SortMode) async throws {
        let userId = try await client.auth.session.user.id
        let upsertData = UserPreferencesUpsert(userId: userId, defaultSortMode: mode.rawValue)
        
        try await client
            .from("user_preferences")
            .upsert(upsertData)
            .execute()
        
        cachedPreferences = UserPreferences(userId: userId, defaultSortMode: mode.rawValue)
    }
    
    static func updateListSortMode(listId: UUID, mode: SortMode?) async throws {
        let update = ListSortModeUpdate(sortMode: mode?.rawValue)
        
        try await client
            .from("lists")
            .update(update)
            .eq("id", value: listId)
            .execute()
    }
    
    static func effectiveSortMode(for list: GatherList, userPreferences: UserPreferences?) -> SortMode {
        if let listMode = list.sortMode, let mode = SortMode(rawValue: listMode) {
            return mode
        }
        
        if let prefs = userPreferences, let mode = SortMode(rawValue: prefs.defaultSortMode) {
            return mode
        }
        
        return .storeCategory
    }
}

// MARK: - DTOs

private struct UserPreferencesUpsert: Encodable {
    let userId: UUID
    let defaultSortMode: String
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case defaultSortMode = "default_sort_mode"
    }
}

private struct ListSortModeUpdate: Encodable {
    let sortMode: String?
    
    enum CodingKeys: String, CodingKey {
        case sortMode = "sort_mode"
    }
}

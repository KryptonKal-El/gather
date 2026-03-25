import Foundation
import Supabase

/// Service layer wrapping Supabase queries for user profile operations.
struct ProfileService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Fetches a user's profile by ID.
    static func fetchProfile(userId: UUID) async throws -> Profile {
        let profile: Profile = try await client
            .from("profiles")
            .select()
            .eq("id", value: userId)
            .single()
            .execute()
            .value
        return profile
    }
    
    /// Updates the display name on the profiles table.
    static func updateDisplayName(userId: UUID, name: String) async throws {
        let update = DisplayNameUpdate(displayName: name)
        try await client
            .from("profiles")
            .update(update)
            .eq("id", value: userId)
            .execute()
    }
    
    /// Updates the avatar URL on the profiles table.
    static func updateAvatarUrl(userId: UUID, url: String) async throws {
        let update = AvatarUrlUpdate(avatarUrl: url)
        try await client
            .from("profiles")
            .update(update)
            .eq("id", value: userId)
            .execute()
    }
    
    /// Updates the user's timezone for reminder delivery scheduling.
    static func updateTimezone(userId: UUID) async throws {
        let update = TimezoneUpdate(timezone: TimeZone.current.identifier)
        try await client
            .from("profiles")
            .update(update)
            .eq("id", value: userId)
            .execute()
    }
}

// MARK: - DTOs

private struct DisplayNameUpdate: Encodable {
    let displayName: String
    
    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
    }
}

private struct AvatarUrlUpdate: Encodable {
    let avatarUrl: String
    
    enum CodingKeys: String, CodingKey {
        case avatarUrl = "avatar_url"
    }
}

private struct TimezoneUpdate: Encodable {
    let timezone: String
}

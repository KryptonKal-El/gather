import Foundation
import Supabase

struct NotificationPreferenceService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Fetch notification preferences for a specific list.
    static func fetchPreferences(listId: UUID) async throws -> NotificationPreference? {
        let userId = try await client.auth.session.user.id
        let result: [NotificationPreference] = try await client
            .from("list_notification_preferences")
            .select()
            .eq("user_id", value: userId.uuidString)
            .eq("list_id", value: listId.uuidString)
            .execute()
            .value
        return result.first
    }
    
    /// Upsert notification preferences for a list.
    static func upsertPreferences(listId: UUID, itemAdded: Bool, itemChecked: Bool, rsvpChanged: Bool, collaboratorJoined: Bool) async throws {
        let userId = try await client.auth.session.user.id
        let data = NotificationPreferenceUpsert(
            userId: userId,
            listId: listId,
            itemAdded: itemAdded,
            itemChecked: itemChecked,
            rsvpChanged: rsvpChanged,
            collaboratorJoined: collaboratorJoined
        )
        try await client
            .from("list_notification_preferences")
            .upsert(data, onConflict: "user_id,list_id")
            .execute()
    }
    
    /// Delete notification preferences for a list (disables all notifications).
    static func deletePreferences(listId: UUID) async throws {
        let userId = try await client.auth.session.user.id
        try await client
            .from("list_notification_preferences")
            .delete()
            .eq("user_id", value: userId.uuidString)
            .eq("list_id", value: listId.uuidString)
            .execute()
    }
}

// MARK: - Models

struct NotificationPreference: Codable {
    let id: UUID
    let userId: UUID
    let listId: UUID
    var itemAdded: Bool
    var itemChecked: Bool
    var rsvpChanged: Bool
    var collaboratorJoined: Bool
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case listId = "list_id"
        case itemAdded = "item_added"
        case itemChecked = "item_checked"
        case rsvpChanged = "rsvp_changed"
        case collaboratorJoined = "collaborator_joined"
    }
}

private struct NotificationPreferenceUpsert: Encodable {
    let userId: UUID
    let listId: UUID
    let itemAdded: Bool
    let itemChecked: Bool
    let rsvpChanged: Bool
    let collaboratorJoined: Bool
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case listId = "list_id"
        case itemAdded = "item_added"
        case itemChecked = "item_checked"
        case rsvpChanged = "rsvp_changed"
        case collaboratorJoined = "collaborator_joined"
    }
}

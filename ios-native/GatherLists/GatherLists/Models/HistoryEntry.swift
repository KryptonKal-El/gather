import Foundation

/// An item history entry for autocomplete, mapped to the `history` Supabase table.
struct HistoryEntry: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let listId: UUID?
    let name: String
    let imageUrl: String?
    let addedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case listId = "list_id"
        case name
        case imageUrl = "image_url"
        case addedAt = "added_at"
    }
}

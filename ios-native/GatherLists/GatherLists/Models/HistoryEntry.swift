import Foundation

/// An item history entry for autocomplete, mapped to the `history` Supabase table.
struct HistoryEntry: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let name: String
    let addedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case addedAt = "added_at"
    }
}

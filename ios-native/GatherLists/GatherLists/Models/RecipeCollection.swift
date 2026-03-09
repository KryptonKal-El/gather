import Foundation

/// A collection that groups recipes, mapped to the `collections` Supabase table.
/// Named RecipeCollection to avoid collision with Swift's Collection protocol.
struct RecipeCollection: Codable, Identifiable, Hashable {
    let id: UUID
    let ownerId: UUID
    var name: String
    var emoji: String?
    var description: String?
    let isDefault: Bool
    var sortOrder: Int
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case name
        case emoji
        case description
        case isDefault = "is_default"
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

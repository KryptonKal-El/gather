import Foundation

/// A recipe owned by a user, mapped to the `recipes` Supabase table.
struct Recipe: Codable, Identifiable, Hashable {
    let id: UUID
    let ownerId: UUID
    var name: String
    var description: String?
    var imageUrl: String?
    var ingredientCount: Int
    var stepCount: Int
    var collectionId: UUID
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case name
        case description
        case imageUrl = "image_url"
        case ingredientCount = "ingredient_count"
        case stepCount = "step_count"
        case collectionId = "collection_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

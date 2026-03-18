import Foundation

struct UserCategoryDefault: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let listType: String
    var categories: [CategoryDef]
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case listType = "list_type"
        case categories
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

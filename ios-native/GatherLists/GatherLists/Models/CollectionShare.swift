import Foundation

/// A sharing record linking a collection to a collaborator's email, mapped to the `collection_shares` Supabase table.
struct CollectionShare: Codable, Identifiable {
    let id: UUID
    let collectionId: UUID
    let sharedWithEmail: String
    let sharedBy: UUID?
    let permission: String
    let addedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case collectionId = "collection_id"
        case sharedWithEmail = "shared_with_email"
        case sharedBy = "shared_by"
        case permission
        case addedAt = "added_at"
    }
}

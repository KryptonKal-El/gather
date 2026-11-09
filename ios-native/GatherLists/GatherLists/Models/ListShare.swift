import Foundation

/// A sharing record linking a list to a collaborator's email, mapped to the `list_shares` Supabase table.
struct ListShare: Codable, Identifiable {
    let id: UUID
    let listId: UUID
    let sharedWithEmail: String
    let sortConfig: [String]?
    /// "editor" or "viewer"; nil from older rows means editor.
    let role: String?
    let addedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case listId = "list_id"
        case sharedWithEmail = "shared_with_email"
        case sortConfig = "sort_config"
        case role
        case addedAt = "added_at"
    }
}

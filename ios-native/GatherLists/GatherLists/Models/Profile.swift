import Foundation

/// A user profile, mapped to the `profiles` Supabase table.
struct Profile: Codable, Identifiable, Hashable {
    let id: UUID
    var avatarUrl: String?
    var displayName: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case avatarUrl = "avatar_url"
        case displayName = "display_name"
    }
}

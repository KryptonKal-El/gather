import Foundation

struct UserPreferences: Codable {
    let userId: UUID
    var defaultSortConfig: [String]
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case defaultSortConfig = "default_sort_config"
    }
}

import Foundation

struct UserPreferences: Codable {
    let userId: UUID
    var defaultSortConfig: [String]
    var lastListId: UUID?
    var listOrder: [String]?
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case defaultSortConfig = "default_sort_config"
        case lastListId = "last_list_id"
        case listOrder = "list_order"
    }
}

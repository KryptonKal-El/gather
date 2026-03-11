import Foundation

enum SortMode: String, Codable, CaseIterable {
    case storeCategory = "store-category"
    case category = "category"
    case alpha = "alpha"
    case dateAdded = "date-added"
    
    var label: String {
        switch self {
        case .storeCategory: return "Store & Category"
        case .category: return "Category"
        case .alpha: return "A–Z"
        case .dateAdded: return "Date Added"
        }
    }
}

struct UserPreferences: Codable {
    let userId: UUID
    var defaultSortMode: String
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case defaultSortMode = "default_sort_mode"
    }
}

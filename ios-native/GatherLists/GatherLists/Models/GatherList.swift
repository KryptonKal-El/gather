import Foundation

struct GatherList: Codable, Identifiable, Hashable {
    let id: UUID
    let ownerId: UUID
    var name: String
    var emoji: String?
    var itemCount: Int
    var color: String
    var sortOrder: Int
    var sortConfig: [String]?
    var type: String
    let createdAt: Date
    
    init(id: UUID = UUID(), ownerId: UUID, name: String, emoji: String? = nil, itemCount: Int = 0, color: String = "#1565c0", sortOrder: Int = 0, sortConfig: [String]? = nil, type: String = "grocery", createdAt: Date = Date()) {
        self.id = id
        self.ownerId = ownerId
        self.name = name
        self.emoji = emoji
        self.itemCount = itemCount
        self.color = color
        self.sortOrder = sortOrder
        self.sortConfig = sortConfig
        self.type = type
        self.createdAt = createdAt
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case name
        case emoji
        case itemCount = "item_count"
        case color
        case sortOrder = "sort_order"
        case sortConfig = "sort_config"
        case type
        case createdAt = "created_at"
    }
}

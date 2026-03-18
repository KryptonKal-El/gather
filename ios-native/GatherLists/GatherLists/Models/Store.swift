import Foundation

/// A category definition with keyword-based auto-categorization rules.
struct CategoryDef: Codable, Hashable {
    let key: String
    let name: String
    let color: String
    let keywords: [String]
}

/// A user-defined store for item grouping, mapped to the `stores` Supabase table.
struct Store: Codable, Identifiable, Hashable {
    let id: UUID
    let userId: UUID
    var name: String
    var color: String?
    var sortOrder: Int
    let createdAt: Date
    
    init(
        id: UUID = UUID(),
        userId: UUID,
        name: String,
        color: String? = nil,
        sortOrder: Int = 0,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.color = color
        self.sortOrder = sortOrder
        self.createdAt = createdAt
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case color
        case sortOrder = "sort_order"
        case createdAt = "created_at"
    }
}

import Foundation

/// A shopping list item, mapped to the `items` Supabase table.
struct Item: Codable, Identifiable, Hashable {
    let id: UUID
    let listId: UUID
    var name: String
    var category: String?
    var isChecked: Bool
    var storeId: UUID?
    var quantity: Int
    var price: Decimal?
    var imageUrl: String?
    let addedAt: Date
    
    init(
        id: UUID = UUID(),
        listId: UUID,
        name: String,
        category: String? = nil,
        isChecked: Bool = false,
        storeId: UUID? = nil,
        quantity: Int = 1,
        price: Decimal? = nil,
        imageUrl: String? = nil,
        addedAt: Date = Date()
    ) {
        self.id = id
        self.listId = listId
        self.name = name
        self.category = category
        self.isChecked = isChecked
        self.storeId = storeId
        self.quantity = quantity
        self.price = price
        self.imageUrl = imageUrl
        self.addedAt = addedAt
    }
    
    enum CodingKeys: String, CodingKey {
        case id
        case listId = "list_id"
        case name
        case category
        case isChecked = "is_checked"
        case storeId = "store_id"
        case quantity
        case price
        case imageUrl = "image_url"
        case addedAt = "added_at"
    }
}

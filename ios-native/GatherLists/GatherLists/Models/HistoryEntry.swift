import Foundation

/// An item history entry for autocomplete, mapped to the `history` Supabase table.
struct HistoryEntry: Codable, Identifiable {
    let id: UUID
    let userId: UUID
    let listId: UUID?
    let name: String
    let imageUrl: String?
    // Mirrored item "template" fields, kept in sync by a DB trigger.
    let category: String?
    let storeId: UUID?
    let quantity: Int?
    let price: Decimal?
    let unit: String?
    let note: String?
    let url: String?
    let priority: String?
    let addedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case listId = "list_id"
        case name
        case imageUrl = "image_url"
        case category
        case storeId = "store_id"
        case quantity
        case price
        case unit
        case note
        case url
        case priority
        case addedAt = "added_at"
    }
}

import Foundation
import Supabase

/// Service layer wrapping Supabase queries for shopping list item operations.
struct ItemService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Fetches all items for a list, ordered by added_at ascending.
    static func fetchItems(listId: UUID) async throws -> [Item] {
        let items: [Item] = try await client
            .from("items")
            .select()
            .eq("list_id", value: listId)
            .order("added_at", ascending: true)
            .execute()
            .value
        return items
    }
    
    /// Adds a new item to a list with auto-categorization.
    static func addItem(
        listId: UUID,
        name: String,
        category: String?,
        storeId: UUID?,
        stores: [Store]
    ) async throws -> Item {
        let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
        
        let resolvedCategory: String
        if let explicitCategory = category {
            resolvedCategory = explicitCategory
        } else {
            var storeCategories: [CategoryDef] = []
            if let storeId = storeId,
               let store = stores.first(where: { $0.id == storeId }),
               !store.categories.isEmpty {
                storeCategories = store.categories
            }
            resolvedCategory = CategoryDefinitions.categorizeItem(capitalizedName, categories: storeCategories.isEmpty ? nil : storeCategories)
        }
        
        let newItem = NewItem(
            listId: listId,
            name: capitalizedName,
            category: resolvedCategory,
            storeId: storeId,
            quantity: 1,
            isChecked: false
        )
        
        let item: Item = try await client
            .from("items")
            .insert(newItem)
            .select()
            .single()
            .execute()
            .value
        return item
    }
    
    /// Partially updates an item. Only non-nil fields are sent.
    static func updateItem(
        itemId: UUID,
        name: String? = nil,
        category: String? = nil,
        isChecked: Bool? = nil,
        storeId: UUID? = nil,
        quantity: Int? = nil,
        price: Decimal? = nil,
        imageUrl: String? = nil
    ) async throws {
        let update = ItemUpdate(
            name: name,
            category: category,
            isChecked: isChecked,
            storeId: storeId,
            quantity: quantity,
            price: price,
            imageUrl: imageUrl
        )
        try await client
            .from("items")
            .update(update)
            .eq("id", value: itemId)
            .execute()
    }
    
    /// Toggles an item's checked state.
    static func toggleItem(itemId: UUID, isChecked: Bool) async throws {
        let update = ToggleUpdate(isChecked: isChecked)
        try await client
            .from("items")
            .update(update)
            .eq("id", value: itemId)
            .execute()
    }
    
    /// Deletes a single item.
    static func deleteItem(itemId: UUID) async throws {
        try await client
            .from("items")
            .delete()
            .eq("id", value: itemId)
            .execute()
    }
    
    /// Batch deletes items by IDs (used for "clear checked" feature).
    static func deleteItems(itemIds: [UUID]) async throws {
        guard !itemIds.isEmpty else { return }
        try await client
            .from("items")
            .delete()
            .in("id", values: itemIds)
            .execute()
    }
    
    /// Re-inserts an item for undo functionality (no auto-categorization).
    static func restoreItem(
        listId: UUID,
        name: String,
        category: String?,
        storeId: UUID?,
        quantity: Int,
        isChecked: Bool
    ) async throws -> Item {
        let restoreData = RestoreItem(
            listId: listId,
            name: name,
            category: category,
            storeId: storeId,
            quantity: quantity,
            isChecked: isChecked
        )
        let item: Item = try await client
            .from("items")
            .insert(restoreData)
            .select()
            .single()
            .execute()
            .value
        return item
    }
}

// MARK: - DTOs

private struct NewItem: Encodable {
    let listId: UUID
    let name: String
    let category: String
    let storeId: UUID?
    let quantity: Int
    let isChecked: Bool
    
    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case name
        case category
        case storeId = "store_id"
        case quantity
        case isChecked = "is_checked"
    }
}

private struct ItemUpdate: Encodable {
    var name: String?
    var category: String?
    var isChecked: Bool?
    var storeId: UUID?
    var quantity: Int?
    var price: Decimal?
    var imageUrl: String?
    
    enum CodingKeys: String, CodingKey {
        case name
        case category
        case isChecked = "is_checked"
        case storeId = "store_id"
        case quantity
        case price
        case imageUrl = "image_url"
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let name = name { try container.encode(name, forKey: .name) }
        if let category = category { try container.encode(category, forKey: .category) }
        if let isChecked = isChecked { try container.encode(isChecked, forKey: .isChecked) }
        if let storeId = storeId { try container.encode(storeId, forKey: .storeId) }
        if let quantity = quantity { try container.encode(quantity, forKey: .quantity) }
        if let price = price { try container.encode(price, forKey: .price) }
        if let imageUrl = imageUrl { try container.encode(imageUrl, forKey: .imageUrl) }
    }
}

private struct ToggleUpdate: Encodable {
    let isChecked: Bool
    
    enum CodingKeys: String, CodingKey {
        case isChecked = "is_checked"
    }
}

private struct RestoreItem: Encodable {
    let listId: UUID
    let name: String
    let category: String?
    let storeId: UUID?
    let quantity: Int
    let isChecked: Bool
    
    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case name
        case category
        case storeId = "store_id"
        case quantity
        case isChecked = "is_checked"
    }
}

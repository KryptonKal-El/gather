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
    
    /// Finds the most recent item with a matching name across all of a user's owned lists.
    static func fetchLastItemByName(_ name: String, userId: UUID) async throws -> Item? {
        let items: [Item] = try await client
            .from("items")
            .select("*, lists!inner(owner_id)")
            .eq("lists.owner_id", value: userId)
            .ilike("name", pattern: name)
            .order("added_at", ascending: false)
            .limit(1)
            .execute()
            .value
        return items.first
    }
    
    /// Adds a new item to a list with auto-categorization.
    static func addItem(
        listId: UUID,
        name: String,
        category: String?,
        storeId: UUID?,
        listCategories: [CategoryDef],
        listType: String? = nil,
        quantity: Int = 1,
        price: Decimal? = nil,
        imageUrl: String? = nil,
        unit: String = "each",
        rsvpStatus: String? = nil
    ) async throws -> Item {
        let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
        
        let resolvedCategory: String
        if let explicitCategory = category {
            resolvedCategory = explicitCategory
        } else {
            resolvedCategory = CategoryDefinitions.categorizeItem(capitalizedName, listType: listType, categories: listCategories.isEmpty ? nil : listCategories)
        }
        
        let newItem = NewItem(
            listId: listId,
            name: capitalizedName,
            category: resolvedCategory,
            storeId: storeId,
            quantity: quantity,
            isChecked: false,
            price: price,
            imageUrl: imageUrl,
            unit: unit,
            rsvpStatus: rsvpStatus
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
    /// Use `clearStoreId` or `clearPrice` to explicitly set those fields to null.
    static func updateItem(
        itemId: UUID,
        name: String? = nil,
        category: String? = nil,
        isChecked: Bool? = nil,
        storeId: UUID? = nil,
        clearStoreId: Bool = false,
        quantity: Int? = nil,
        price: Decimal? = nil,
        clearPrice: Bool = false,
        imageUrl: String? = nil,
        clearImageUrl: Bool = false,
        unit: String? = nil,
        rsvpStatus: String? = nil,
        clearRsvpStatus: Bool = false,
        dueDate: Date? = nil,
        clearDueDate: Bool = false,
        recurrenceRule: RecurrenceRule? = nil,
        clearRecurrenceRule: Bool = false,
        reminderDaysBefore: Int? = nil,
        clearReminderDaysBefore: Bool = false
    ) async throws {
        let update = ItemUpdate(
            name: name,
            category: category,
            isChecked: isChecked,
            storeId: storeId,
            clearStoreId: clearStoreId,
            quantity: quantity,
            price: price,
            clearPrice: clearPrice,
            imageUrl: imageUrl,
            clearImageUrl: clearImageUrl,
            unit: unit,
            rsvpStatus: rsvpStatus,
            clearRsvpStatus: clearRsvpStatus,
            dueDate: dueDate,
            clearDueDate: clearDueDate,
            recurrenceRule: recurrenceRule,
            clearRecurrenceRule: clearRecurrenceRule,
            reminderDaysBefore: reminderDaysBefore,
            clearReminderDaysBefore: clearReminderDaysBefore
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
        isChecked: Bool,
        price: Decimal?,
        imageUrl: String?,
        unit: String = "each",
        rsvpStatus: String? = nil
    ) async throws -> Item {
        let restoreData = RestoreItem(
            listId: listId,
            name: name,
            category: category,
            storeId: storeId,
            quantity: quantity,
            isChecked: isChecked,
            price: price,
            imageUrl: imageUrl,
            unit: unit,
            rsvpStatus: rsvpStatus
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
    
    /// Batch restores multiple items for undo functionality.
    static func restoreItems(listId: UUID, items: [Item]) async throws -> [Item] {
        var restored: [Item] = []
        for item in items {
            let restoredItem = try await restoreItem(
                listId: listId,
                name: item.name,
                category: item.category,
                storeId: item.storeId,
                quantity: item.quantity,
                isChecked: item.isChecked,
                price: item.price,
                imageUrl: item.imageUrl,
                unit: item.unit,
                rsvpStatus: item.rsvpStatus
            )
            restored.append(restoredItem)
        }
        return restored
    }
    
    /// Fetches completion history for a recurring item.
    /// Returns past checked-off instances in the same list with the same name.
    static func fetchCompletionHistory(listId: UUID, itemName: String) async throws -> [Item] {
        let response: [Item] = try await client
            .from("items")
            .select()
            .eq("list_id", value: listId.uuidString)
            .eq("name", value: itemName)
            .eq("is_checked", value: true)
            .not("checked_at", operator: .is, value: "null")
            .order("checked_at", ascending: false)
            .limit(50)
            .execute()
            .value
        return response
    }
    
    /// Batch inserts new items and updates quantities for duplicates from a preview.
    static func applyIngredientPreview(
        listId: UUID,
        newItems: [PreviewNewItem],
        duplicates: [PreviewDuplicateItem]
    ) async throws -> (added: Int, updated: Int) {
        let itemsToAdd = newItems.filter { !$0.isExcluded }
        let itemsToUpdate = duplicates.filter { !$0.isExcluded && $0.newQuantity != $0.currentQuantity }
        
        if !itemsToAdd.isEmpty {
            let insertData = itemsToAdd.map { item in
                IngredientItem(
                    listId: listId,
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    isChecked: false,
                    unit: item.unit
                )
            }
            
            try await client
                .from("items")
                .insert(insertData)
                .execute()
        }
        
        for duplicate in itemsToUpdate {
            try await updateItem(itemId: duplicate.id, quantity: duplicate.newQuantity)
        }
        
        return (itemsToAdd.count, itemsToUpdate.count)
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
    let price: Decimal?
    let imageUrl: String?
    var unit: String = "each"
    let rsvpStatus: String?
    
    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case name
        case category
        case storeId = "store_id"
        case quantity
        case isChecked = "is_checked"
        case price
        case imageUrl = "image_url"
        case unit
        case rsvpStatus = "rsvp_status"
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(listId, forKey: .listId)
        try container.encode(name, forKey: .name)
        try container.encode(category, forKey: .category)
        try container.encode(quantity, forKey: .quantity)
        try container.encode(isChecked, forKey: .isChecked)
        try container.encode(unit, forKey: .unit)
        if let storeId { try container.encode(storeId, forKey: .storeId) }
        if let price { try container.encode(price, forKey: .price) }
        if let imageUrl { try container.encode(imageUrl, forKey: .imageUrl) }
        if let rsvpStatus { try container.encode(rsvpStatus, forKey: .rsvpStatus) }
    }
}

private struct ItemUpdate: Encodable {
    var name: String?
    var category: String?
    var isChecked: Bool?
    var storeId: UUID?
    var clearStoreId: Bool = false
    var quantity: Int?
    var price: Decimal?
    var clearPrice: Bool = false
    var imageUrl: String?
    var clearImageUrl: Bool = false
    var unit: String?
    var rsvpStatus: String?
    var clearRsvpStatus: Bool = false
    var dueDate: Date?
    var clearDueDate: Bool = false
    var recurrenceRule: RecurrenceRule?
    var clearRecurrenceRule: Bool = false
    var reminderDaysBefore: Int?
    var clearReminderDaysBefore: Bool = false
    
    enum CodingKeys: String, CodingKey {
        case name
        case category
        case isChecked = "is_checked"
        case storeId = "store_id"
        case quantity
        case price
        case imageUrl = "image_url"
        case unit
        case rsvpStatus = "rsvp_status"
        case dueDate = "due_date"
        case recurrenceRule = "recurrence_rule"
        case reminderDaysBefore = "reminder_days_before"
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let name = name { try container.encode(name, forKey: .name) }
        if let category = category { try container.encode(category, forKey: .category) }
        if let isChecked = isChecked { try container.encode(isChecked, forKey: .isChecked) }
        if clearStoreId {
            try container.encodeNil(forKey: .storeId)
        } else if let storeId = storeId {
            try container.encode(storeId, forKey: .storeId)
        }
        if let quantity = quantity { try container.encode(quantity, forKey: .quantity) }
        if clearPrice {
            try container.encodeNil(forKey: .price)
        } else if let price = price {
            try container.encode(price, forKey: .price)
        }
        if clearImageUrl {
            try container.encodeNil(forKey: .imageUrl)
        } else if let imageUrl = imageUrl {
            try container.encode(imageUrl, forKey: .imageUrl)
        }
        if let unit = unit { try container.encode(unit, forKey: .unit) }
        if clearRsvpStatus {
            try container.encodeNil(forKey: .rsvpStatus)
        } else if let rsvpStatus = rsvpStatus {
            try container.encode(rsvpStatus, forKey: .rsvpStatus)
        }
        if clearDueDate {
            try container.encodeNil(forKey: .dueDate)
        } else if let dueDate = dueDate {
            try container.encode(dueDate, forKey: .dueDate)
        }
        if clearRecurrenceRule {
            try container.encodeNil(forKey: .recurrenceRule)
        } else if let recurrenceRule = recurrenceRule {
            try container.encode(recurrenceRule, forKey: .recurrenceRule)
        }
        if clearReminderDaysBefore {
            try container.encodeNil(forKey: .reminderDaysBefore)
        } else if let reminderDaysBefore = reminderDaysBefore {
            try container.encode(reminderDaysBefore, forKey: .reminderDaysBefore)
        }
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
    let price: Decimal?
    let imageUrl: String?
    var unit: String = "each"
    let rsvpStatus: String?
    
    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case name
        case category
        case storeId = "store_id"
        case quantity
        case isChecked = "is_checked"
        case price
        case imageUrl = "image_url"
        case unit
        case rsvpStatus = "rsvp_status"
    }
}

private struct IngredientItem: Encodable {
    let listId: UUID
    let name: String
    let category: String
    let quantity: Int
    let isChecked: Bool
    var unit: String = "each"
    
    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case name
        case category
        case quantity
        case isChecked = "is_checked"
        case unit
    }
}

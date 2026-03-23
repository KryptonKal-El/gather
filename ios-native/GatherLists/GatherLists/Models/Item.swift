import Foundation

/// Defines the recurrence pattern for recurring items.
struct RecurrenceRule: Codable, Hashable {
    let type: String          // "daily", "weekly", "biweekly", "monthly", "yearly", "custom"
    let interval: Int?        // every N (for custom)
    let frequency: String?    // "day", "week", "month", "year" (for custom)
    let daysOfWeek: [Int]?    // 0=Sun..6=Sat (for custom weekly)
    
    enum CodingKeys: String, CodingKey {
        case type
        case interval
        case frequency
        case daysOfWeek = "days_of_week"
    }
}

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
    var unit: String
    var rsvpStatus: String?
    let addedAt: Date
    
    // Recurrence/due-date fields
    var dueDate: Date?
    var recurrenceRule: RecurrenceRule?
    var reminderDaysBefore: Int?
    var checkedAt: Date?
    var parentItemId: UUID?
    var reminderSentAt: Date?
    
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
        unit: String = "each",
        rsvpStatus: String? = nil,
        addedAt: Date = Date(),
        dueDate: Date? = nil,
        recurrenceRule: RecurrenceRule? = nil,
        reminderDaysBefore: Int? = nil,
        checkedAt: Date? = nil,
        parentItemId: UUID? = nil,
        reminderSentAt: Date? = nil
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
        self.unit = unit
        self.rsvpStatus = rsvpStatus
        self.addedAt = addedAt
        self.dueDate = dueDate
        self.recurrenceRule = recurrenceRule
        self.reminderDaysBefore = reminderDaysBefore
        self.checkedAt = checkedAt
        self.parentItemId = parentItemId
        self.reminderSentAt = reminderSentAt
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
        case unit
        case rsvpStatus = "rsvp_status"
        case addedAt = "added_at"
        case dueDate = "due_date"
        case recurrenceRule = "recurrence_rule"
        case reminderDaysBefore = "reminder_days_before"
        case checkedAt = "checked_at"
        case parentItemId = "parent_item_id"
        case reminderSentAt = "reminder_sent_at"
    }
}

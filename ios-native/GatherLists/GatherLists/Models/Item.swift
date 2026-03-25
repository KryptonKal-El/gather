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
    var createdBy: UUID?
    
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
        reminderSentAt: Date? = nil,
        createdBy: UUID? = nil
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
        self.createdBy = createdBy
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
        case createdBy = "created_by"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Required fields
        id = try container.decode(UUID.self, forKey: .id)
        listId = try container.decode(UUID.self, forKey: .listId)
        name = try container.decode(String.self, forKey: .name)
        addedAt = try container.decode(Date.self, forKey: .addedAt)
        
        // Optional fields with safe defaults
        category = try container.decodeIfPresent(String.self, forKey: .category)
        isChecked = try container.decodeIfPresent(Bool.self, forKey: .isChecked) ?? false
        storeId = try container.decodeIfPresent(UUID.self, forKey: .storeId)
        quantity = try container.decodeIfPresent(Int.self, forKey: .quantity) ?? 1
        price = try container.decodeIfPresent(Decimal.self, forKey: .price)
        imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl)
        unit = try container.decodeIfPresent(String.self, forKey: .unit) ?? "each"
        rsvpStatus = try container.decodeIfPresent(String.self, forKey: .rsvpStatus)
        if let dueDateString = try container.decodeIfPresent(String.self, forKey: .dueDate) {
            let iso8601 = ISO8601DateFormatter()
            iso8601.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let dateOnly = DateFormatter()
            dateOnly.dateFormat = "yyyy-MM-dd"
            dateOnly.locale = Locale(identifier: "en_US_POSIX")
            dateOnly.timeZone = TimeZone(secondsFromGMT: 0)
            dueDate = iso8601.date(from: dueDateString) ?? dateOnly.date(from: dueDateString)
        } else {
            dueDate = nil
        }
        recurrenceRule = try? container.decodeIfPresent(RecurrenceRule.self, forKey: .recurrenceRule)
        reminderDaysBefore = try container.decodeIfPresent(Int.self, forKey: .reminderDaysBefore)
        checkedAt = try? container.decodeIfPresent(Date.self, forKey: .checkedAt)
        parentItemId = try container.decodeIfPresent(UUID.self, forKey: .parentItemId)
        reminderSentAt = try? container.decodeIfPresent(Date.self, forKey: .reminderSentAt)
        createdBy = try container.decodeIfPresent(UUID.self, forKey: .createdBy)
    }
}

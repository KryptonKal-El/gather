import Foundation

/// A meal of the day that can be planned.
enum MealType: String, Codable, CaseIterable, Identifiable, Hashable {
    case breakfast
    case lunch
    case dinner

    var id: String { rawValue }

    var label: String {
        switch self {
        case .breakfast: return "Breakfast"
        case .lunch: return "Lunch"
        case .dinner: return "Dinner"
        }
    }

    var systemImage: String {
        switch self {
        case .breakfast: return "sunrise"
        case .lunch: return "sun.max"
        case .dinner: return "moon.stars"
        }
    }
}

/// What occupies a planned meal slot.
enum MealEntryKind: String, Codable, CaseIterable, Hashable {
    case recipe
    case eatingOut = "eating_out"
    case leftovers
    case skip
    case custom

    var label: String {
        switch self {
        case .recipe: return "Recipe"
        case .eatingOut: return "Eating out"
        case .leftovers: return "Leftovers"
        case .skip: return "Skip"
        case .custom: return "Other meal"
        }
    }

    var systemImage: String {
        switch self {
        case .recipe: return "book"
        case .eatingOut: return "fork.knife"
        case .leftovers: return "takeoutbag.and.cup.and.straw"
        case .skip: return "minus.circle"
        case .custom: return "text.cursor"
        }
    }
}

/// A household meal plan, mapped to the `meal_plans` Supabase table.
struct MealPlan: Codable, Identifiable, Hashable {
    let id: UUID
    let ownerId: UUID
    var name: String
    var enabledMeals: [String]
    let createdAt: Date
    let updatedAt: Date

    /// Enabled meals in breakfast → dinner order, ignoring unknown values.
    var enabledMealTypes: [MealType] {
        MealType.allCases.filter { enabledMeals.contains($0.rawValue) }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case name
        case enabledMeals = "enabled_meals"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// A sharing record for a meal plan, mapped to the `meal_plan_shares` Supabase table.
struct MealPlanShare: Codable, Identifiable, Hashable {
    let id: UUID
    let mealPlanId: UUID
    let sharedWithEmail: String
    let sharedBy: UUID?
    let permission: String
    let addedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case mealPlanId = "meal_plan_id"
        case sharedWithEmail = "shared_with_email"
        case sharedBy = "shared_by"
        case permission
        case addedAt = "added_at"
    }
}

/// One planned meal slot, mapped to the `meal_plan_entries` Supabase table.
/// `date` is a calendar day string (`yyyy-MM-dd`) with no time zone.
struct MealPlanEntry: Codable, Identifiable, Hashable {
    let id: UUID
    let mealPlanId: UUID
    var date: String
    var meal: MealType
    var kind: MealEntryKind
    var recipeId: UUID?
    var title: String?
    var note: String?
    var isLocked: Bool
    var source: String
    var cookedAt: Date?
    /// Why the planner picked this recipe; only set on `source == "suggested"` slots.
    var suggestionReason: String?
    let createdBy: UUID?
    let createdAt: Date
    var updatedAt: Date

    var isSuggested: Bool { source == "suggested" }

    /// Text shown for the slot: the recipe name snapshot, or the kind's label.
    var displayTitle: String {
        if let title, !title.isEmpty { return title }
        return kind.label
    }

    enum CodingKeys: String, CodingKey {
        case id
        case mealPlanId = "meal_plan_id"
        case date
        case meal
        case kind
        case recipeId = "recipe_id"
        case title
        case note
        case isLocked = "is_locked"
        case source
        case cookedAt = "cooked_at"
        case suggestionReason = "suggestion_reason"
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Calendar helpers for Monday-start meal plan weeks. Plan dates are local
/// calendar days, stored as `yyyy-MM-dd`.
enum MealPlanWeek {
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        calendar.timeZone = .current
        return calendar
    }

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// The Monday that starts the week containing `date`.
    static func startOfWeek(containing date: Date) -> Date {
        let cal = calendar
        let day = cal.startOfDay(for: date)
        let weekday = cal.component(.weekday, from: day)
        let offset = (weekday + 5) % 7
        return cal.date(byAdding: .day, value: -offset, to: day) ?? day
    }

    /// The seven days of the week starting at `weekStart`.
    static func days(from weekStart: Date) -> [Date] {
        (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: weekStart) }
    }

    static func shift(_ weekStart: Date, byWeeks weeks: Int) -> Date {
        calendar.date(byAdding: .day, value: weeks * 7, to: weekStart) ?? weekStart
    }

    static func key(for date: Date) -> String {
        formatter.string(from: date)
    }

    static func date(fromKey key: String) -> Date? {
        formatter.date(from: key)
    }
}

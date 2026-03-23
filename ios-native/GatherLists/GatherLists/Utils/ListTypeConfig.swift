import Foundation

/// Field visibility configuration for a list type.
struct ListTypeFields {
    let store: Bool
    let category: Bool
    let price: Bool
    let quantity: Bool
    let unit: Bool
    let image: Bool
    let rsvpStatus: Bool
    let dueDate: Bool
    let recurrence: Bool
    let reminder: Bool
}

/// Category definition for non-grocery list types.
struct ListCategory {
    let key: String
    let name: String
    let color: String
    let keywords: [String]
}

/// Configuration for a list type.
struct ListTypeConfig {
    let id: String
    let label: String
    let icon: String
    let fields: ListTypeFields
    let quantityLabel: String?
    let categories: [ListCategory]?
    let sortLevels: [String]
    let defaultSort: [String]
}

/// All list type IDs in display order.
let LIST_TYPE_IDS: [String] = ["grocery", "todo", "basic", "packing", "guest_list", "project"]

/// Category definitions for non-grocery list types.
enum ListTypeCategories {
    static let packing: [ListCategory] = [
        ListCategory(
            key: "clothes",
            name: "Clothes",
            color: "#5C6BC0",
            keywords: ["shirt", "shirts", "pants", "shorts", "jacket", "coat", "dress", "socks", "underwear", "sweater", "hoodie", "jeans", "t-shirt", "blouse", "skirt"]
        ),
        ListCategory(
            key: "toiletries",
            name: "Toiletries",
            color: "#26A69A",
            keywords: ["toothbrush", "toothpaste", "shampoo", "conditioner", "soap", "deodorant", "razor", "sunscreen", "lotion", "floss", "mouthwash"]
        ),
        ListCategory(
            key: "electronics",
            name: "Electronics",
            color: "#42A5F5",
            keywords: ["charger", "laptop", "phone", "tablet", "headphones", "earbuds", "camera", "adapter", "cable", "power bank", "kindle"]
        ),
        ListCategory(
            key: "documents",
            name: "Documents",
            color: "#78909C",
            keywords: ["passport", "tickets", "boarding pass", "id", "insurance", "itinerary", "visa", "license", "reservation"]
        ),
        ListCategory(
            key: "accessories",
            name: "Accessories",
            color: "#AB47BC",
            keywords: ["hat", "sunglasses", "belt", "watch", "jewelry", "wallet", "umbrella", "scarf", "gloves"]
        ),
        ListCategory(
            key: "medications",
            name: "Medications",
            color: "#EF5350",
            keywords: ["medicine", "pills", "vitamins", "inhaler", "prescription", "band-aids", "first aid", "allergy", "ibuprofen", "tylenol"]
        ),
        ListCategory(
            key: "snacks_food",
            name: "Snacks & Food",
            color: "#FFA726",
            keywords: ["snacks", "granola bars", "trail mix", "nuts", "crackers", "water bottle", "gum", "candy"]
        ),
        ListCategory(
            key: "entertainment",
            name: "Entertainment",
            color: "#66BB6A",
            keywords: ["book", "books", "cards", "games", "puzzle", "magazine", "notebook", "journal", "pen", "pencil"]
        ),
        ListCategory(
            key: "miscellaneous",
            name: "Miscellaneous",
            color: "#9E9E9E",
            keywords: []
        )
    ]
    
    static let todo: [ListCategory] = [
        ListCategory(key: "work", name: "Work", color: "#42A5F5", keywords: []),
        ListCategory(key: "personal", name: "Personal", color: "#66BB6A", keywords: []),
        ListCategory(key: "errands", name: "Errands", color: "#FFA726", keywords: []),
        ListCategory(key: "finance", name: "Finance", color: "#26A69A", keywords: []),
        ListCategory(key: "health", name: "Health", color: "#EF5350", keywords: []),
        ListCategory(key: "home", name: "Home", color: "#AB47BC", keywords: []),
        ListCategory(key: "other", name: "Other", color: "#9E9E9E", keywords: [])
    ]
    
    static let project: [ListCategory] = [
        ListCategory(
            key: "research",
            name: "Research",
            color: "#5C6BC0",
            keywords: ["research", "investigate", "analyze", "analysis", "discovery", "explore", "study", "review", "audit", "evaluate", "assess"]
        ),
        ListCategory(
            key: "design",
            name: "Design",
            color: "#AB47BC",
            keywords: ["design", "mockup", "wireframe", "prototype", "ux", "ui", "layout", "sketch", "figma", "visual"]
        ),
        ListCategory(
            key: "development",
            name: "Development",
            color: "#26A69A",
            keywords: ["develop", "code", "implement", "build", "feature", "refactor", "api", "backend", "frontend", "deploy", "fix", "bug"]
        ),
        ListCategory(
            key: "testing",
            name: "Testing",
            color: "#FFA726",
            keywords: ["test", "qa", "verify", "validate", "check", "regression", "integration", "e2e", "unit test", "coverage"]
        ),
        ListCategory(
            key: "admin",
            name: "Admin",
            color: "#78909C",
            keywords: ["meeting", "document", "docs", "plan", "coordinate", "schedule", "budget", "report", "email", "organize", "presentation"]
        ),
        ListCategory(
            key: "other",
            name: "Other",
            color: "#9e9e9e",
            keywords: []
        )
    ]
}

/// List type configurations and lookup.
enum ListTypes {
    private static let configs: [String: ListTypeConfig] = [
        "grocery": ListTypeConfig(
            id: "grocery",
            label: "Grocery",
            icon: "🛒",
            fields: ListTypeFields(store: true, category: true, price: true, quantity: true, unit: true, image: true, rsvpStatus: false, dueDate: false, recurrence: false, reminder: false),
            quantityLabel: "Qty",
            categories: nil,
            sortLevels: ["store", "category", "name", "date"],
            defaultSort: ["store", "category", "name"]
        ),
        "basic": ListTypeConfig(
            id: "basic",
            label: "Basic",
            icon: "📋",
            fields: ListTypeFields(store: false, category: false, price: false, quantity: false, unit: false, image: false, rsvpStatus: false, dueDate: true, recurrence: true, reminder: true),
            quantityLabel: nil,
            categories: nil,
            sortLevels: ["name", "date", "dueDate"],
            defaultSort: ["name"]
        ),
        "guest_list": ListTypeConfig(
            id: "guest_list",
            label: "Guest List",
            icon: "🎉",
            fields: ListTypeFields(store: false, category: false, price: false, quantity: true, unit: false, image: false, rsvpStatus: true, dueDate: false, recurrence: false, reminder: false),
            quantityLabel: "Head Count",
            categories: nil,
            sortLevels: ["rsvp", "name", "date"],
            defaultSort: ["rsvp", "name"]
        ),
        "packing": ListTypeConfig(
            id: "packing",
            label: "Packing",
            icon: "🧳",
            fields: ListTypeFields(store: false, category: true, price: false, quantity: true, unit: false, image: false, rsvpStatus: false, dueDate: false, recurrence: false, reminder: false),
            quantityLabel: "Qty",
            categories: ListTypeCategories.packing,
            sortLevels: ["category", "name", "date"],
            defaultSort: ["category", "name"]
        ),
        "project": ListTypeConfig(
            id: "project",
            label: "Project",
            icon: "🏗️",
            fields: ListTypeFields(store: false, category: true, price: true, quantity: true, unit: false, image: false, rsvpStatus: false, dueDate: true, recurrence: true, reminder: true),
            quantityLabel: "Qty",
            categories: ListTypeCategories.project,
            sortLevels: ["category", "name", "date", "price", "dueDate"],
            defaultSort: ["category", "name"]
        ),
        "todo": ListTypeConfig(
            id: "todo",
            label: "To-Do",
            icon: "📝",
            fields: ListTypeFields(store: false, category: true, price: false, quantity: false, unit: false, image: false, rsvpStatus: false, dueDate: true, recurrence: true, reminder: true),
            quantityLabel: nil,
            categories: ListTypeCategories.todo,
            sortLevels: ["category", "name", "date", "dueDate"],
            defaultSort: ["category", "name"]
        )
    ]
    
    /// Returns the configuration for a given list type ID.
    static func getConfig(_ typeId: String) -> ListTypeConfig {
        configs[typeId] ?? configs["grocery"]!
    }
}

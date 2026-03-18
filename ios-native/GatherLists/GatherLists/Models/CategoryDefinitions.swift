import Foundation

/// Default category definitions and auto-categorization for grocery items.
enum CategoryDefinitions {
    /// The 12 built-in categories matching the React implementation.
    static let defaults: [CategoryDef] = [
        CategoryDef(
            key: "produce",
            name: "Produce",
            color: "#4caf50",
            keywords: [
                "apple", "apples", "banana", "bananas", "lettuce", "tomato", "tomatoes",
                "onion", "onions", "garlic", "potato", "potatoes", "carrot", "carrots",
                "broccoli", "spinach", "avocado", "avocados", "cucumber", "peppers",
                "pepper", "celery", "mushroom", "mushrooms", "lemon", "lemons", "lime",
                "limes", "orange", "oranges", "berries", "strawberries", "blueberries",
                "grapes", "kale", "zucchini", "corn", "ginger", "cilantro", "parsley",
                "basil", "mint", "jalapeño", "jalapeno"
            ]
        ),
        CategoryDef(
            key: "dairy",
            name: "Dairy & Eggs",
            color: "#2196f3",
            keywords: [
                "milk", "cheese", "yogurt", "butter", "cream", "eggs", "egg",
                "sour cream", "cream cheese", "cottage cheese", "mozzarella",
                "parmesan", "cheddar"
            ]
        ),
        CategoryDef(
            key: "meat",
            name: "Meat & Seafood",
            color: "#e53935",
            keywords: [
                "chicken", "beef", "pork", "steak", "salmon", "shrimp", "turkey",
                "bacon", "sausage", "ground beef", "ground turkey", "fish", "tuna",
                "lamb", "ham"
            ]
        ),
        CategoryDef(
            key: "bakery",
            name: "Bakery",
            color: "#ff9800",
            keywords: [
                "bread", "bagel", "bagels", "tortilla", "tortillas", "rolls", "buns",
                "croissant", "muffin", "muffins", "pita"
            ]
        ),
        CategoryDef(
            key: "frozen",
            name: "Frozen",
            color: "#00bcd4",
            keywords: [
                "ice cream", "frozen pizza", "frozen vegetables", "frozen fruit",
                "frozen berries"
            ]
        ),
        CategoryDef(
            key: "pantry",
            name: "Pantry & Dry Goods",
            color: "#795548",
            keywords: [
                "rice", "pasta", "flour", "sugar", "salt", "oil", "olive oil",
                "vegetable oil", "coconut oil", "beans", "lentils", "oats", "cereal",
                "peanut butter", "canned tomatoes", "tomato paste", "tomato sauce",
                "chicken broth", "broth", "noodles", "quinoa", "baking soda",
                "baking powder", "vanilla", "honey", "vinegar", "nuts", "almonds",
                "walnuts"
            ]
        ),
        CategoryDef(
            key: "beverages",
            name: "Beverages",
            color: "#9c27b0",
            keywords: ["water", "juice", "coffee", "tea", "soda", "wine", "beer"]
        ),
        CategoryDef(
            key: "snacks",
            name: "Snacks",
            color: "#ffc107",
            keywords: [
                "chips", "crackers", "cookies", "popcorn", "granola", "granola bars",
                "pretzels", "chocolate"
            ]
        ),
        CategoryDef(
            key: "condiments",
            name: "Condiments & Sauces",
            color: "#ff5722",
            keywords: [
                "ketchup", "mustard", "mayo", "mayonnaise", "soy sauce", "hot sauce",
                "salsa", "salad dressing", "bbq sauce", "sriracha"
            ]
        ),
        CategoryDef(
            key: "household",
            name: "Household",
            color: "#607d8b",
            keywords: [
                "paper towels", "toilet paper", "trash bags", "dish soap",
                "laundry detergent", "sponge", "aluminum foil", "plastic wrap"
            ]
        ),
        CategoryDef(
            key: "personal_care",
            name: "Personal Care",
            color: "#e91e63",
            keywords: [
                "shampoo", "conditioner", "soap", "toothpaste", "deodorant", "lotion"
            ]
        ),
        CategoryDef(
            key: "other",
            name: "Other",
            color: "#9e9e9e",
            keywords: []
        )
    ]
    
    /// Categorizes an item name using 3-pass keyword matching.
    /// Pass 1: Exact match (full name = keyword)
    /// Pass 2: Multi-word phrase match (keyword is substring of name)
    /// Pass 3: Single-word fallback (any word in name matches any keyword)
    /// - Parameters:
    ///   - name: The item name to categorize.
    ///   - categories: Categories to match against. Uses defaults when nil or empty.
    /// - Returns: The matched category key, or "other" if no match.
    static func categorizeItem(_ name: String, categories: [CategoryDef]? = nil) -> String {
        let cats = (categories?.isEmpty ?? true) ? defaults : categories!
        let normalized = name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Pass 1: Exact match
        for cat in cats {
            for keyword in cat.keywords {
                if normalized == keyword.lowercased() {
                    return cat.key
                }
            }
        }
        
        // Pass 2: Multi-word phrase match
        for cat in cats {
            for keyword in cat.keywords {
                let kw = keyword.lowercased()
                if kw.contains(" ") && normalized.contains(kw) {
                    return cat.key
                }
            }
        }
        
        // Pass 3: Single-word fallback
        let words = normalized.split(separator: " ").map(String.init)
        for word in words {
            for cat in cats {
                for keyword in cat.keywords {
                    if word == keyword.lowercased() {
                        return cat.key
                    }
                }
            }
        }
        
        return "other"
    }
    
    /// Categorizes an item based on the list type.
    /// - Grocery or nil: uses grocery keyword matching (existing behavior)
    /// - Packing: uses packing category keywords
    /// - Project: uses project category keywords
    /// - Basic, Guest List, To-Do: returns "other" (no auto-categorization)
    static func categorizeItem(_ name: String, listType: String?, categories: [CategoryDef]? = nil) -> String {
        switch listType {
        case "basic", "guest_list", "todo":
            return "other"
        case "packing":
            let packingDefs = ListTypeCategories.packing.map { cat in
                CategoryDef(key: cat.key, name: cat.name, color: cat.color, keywords: cat.keywords)
            }
            let result = categorizeItem(name, categories: packingDefs)
            return result == "other" ? "miscellaneous" : result
        case "project":
            let projectDefs = ListTypeCategories.project.map { cat in
                CategoryDef(key: cat.key, name: cat.name, color: cat.color, keywords: cat.keywords)
            }
            return categorizeItem(name, categories: projectDefs)
        default:
            return categorizeItem(name, categories: categories)
        }
    }
    
    /// Looks up a category definition by key from the given array (or defaults).
    static func category(forKey key: String, in categories: [CategoryDef]? = nil) -> CategoryDef? {
        let cats = (categories?.isEmpty ?? true) ? defaults : categories!
        return cats.first { $0.key == key }
    }
}

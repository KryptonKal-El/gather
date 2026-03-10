import Foundation

/// Predefined measurement units for shopping list items.
enum ItemUnit: String, CaseIterable, Identifiable {
    case each
    case cups
    case tbsp
    case tsp
    case oz
    case lb
    case g
    case kg
    case ml
    case L
    case dozen
    case pinch
    
    var id: String { rawValue }
    
    var displayName: String { rawValue }
    
    /// Maps a Spoonacular API unit string to a Gather Lists unit value.
    static func mapFromSpoonacular(_ unit: String) -> String {
        let lowered = unit.lowercased().trimmingCharacters(in: .whitespaces)
        switch lowered {
        case "cups", "cup": return ItemUnit.cups.rawValue
        case "tablespoons", "tablespoon", "tbsp", "tbsps": return ItemUnit.tbsp.rawValue
        case "teaspoons", "teaspoon", "tsp", "tsps": return ItemUnit.tsp.rawValue
        case "ounces", "ounce", "oz": return ItemUnit.oz.rawValue
        case "pounds", "pound", "lb", "lbs": return ItemUnit.lb.rawValue
        case "grams", "gram", "g": return ItemUnit.g.rawValue
        case "kilograms", "kilogram", "kg": return ItemUnit.kg.rawValue
        case "milliliters", "milliliter", "ml": return ItemUnit.ml.rawValue
        case "liters", "liter", "l": return ItemUnit.L.rawValue
        case "pinch", "pinches": return ItemUnit.pinch.rawValue
        case "dozen": return ItemUnit.dozen.rawValue
        default: return ItemUnit.each.rawValue
        }
    }
}

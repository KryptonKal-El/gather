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
}

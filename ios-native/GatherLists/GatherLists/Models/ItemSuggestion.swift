import Foundation

/// A suggested item with name, reason, and category.
struct ItemSuggestion: Identifiable {
    let id = UUID()
    let name: String
    let reason: String
    let category: String
}

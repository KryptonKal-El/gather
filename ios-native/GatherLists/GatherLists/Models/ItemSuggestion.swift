import Foundation

/// A suggested item with name, reason, category, and the latest known image.
struct ItemSuggestion: Identifiable {
    let id = UUID()
    let name: String
    let reason: String
    let category: String
    let imageUrl: String?
}

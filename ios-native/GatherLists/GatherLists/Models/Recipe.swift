import Foundation

/// A recipe owned by a user, mapped to the `recipes` Supabase table.
struct Recipe: Codable, Identifiable, Hashable {
    let id: UUID
    let ownerId: UUID
    var name: String
    var description: String?
    var imageUrl: String?
    var ingredientCount: Int
    var stepCount: Int
    var collectionId: UUID
    // Optional so recipes cached by builds that predate the cook log still decode.
    var cookCount: Int?
    var lastCookedAt: Date?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case name
        case description
        case imageUrl = "image_url"
        case ingredientCount = "ingredient_count"
        case stepCount = "step_count"
        case collectionId = "collection_id"
        case cookCount = "cook_count"
        case lastCookedAt = "last_cooked_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// How the Recipes "All" view lays out its cards: under collection headers
/// (the default) or as one flat grid.
enum RecipeGrouping: String, CaseIterable, Identifiable {
    case collection
    case ungrouped

    var id: String { rawValue }

    var label: String {
        switch self {
        case .collection: return "Collection"
        case .ungrouped: return "None"
        }
    }

    var systemImage: String {
        switch self {
        case .collection: return "folder"
        case .ungrouped: return "square.grid.2x2"
        }
    }
}

/// The order recipes are listed in within a collection. The user picks one per
/// collection from the collection's overflow menu; `alphabetical` is the default.
enum RecipeSortOption: String, CaseIterable, Identifiable {
    case alphabetical
    case recentlyCooked
    case recentlyAdded
    case mostCooked

    static let `default`: RecipeSortOption = .alphabetical

    var id: String { rawValue }

    /// Menu label shown to the user.
    var label: String {
        switch self {
        case .alphabetical: return "Alphabetical (A–Z)"
        case .recentlyCooked: return "Most Recently Cooked"
        case .recentlyAdded: return "Most Recently Added"
        case .mostCooked: return "Most Cooked"
        }
    }

    /// SF Symbol paired with the label in the menu.
    var systemImage: String {
        switch self {
        case .alphabetical: return "textformat"
        case .recentlyCooked: return "clock"
        case .recentlyAdded: return "calendar.badge.plus"
        case .mostCooked: return "flame"
        }
    }

    /// Returns `recipes` ordered by this option. Ties (and recipes missing the
    /// relevant value) fall back to a case-insensitive name comparison so the
    /// order stays stable.
    func sorted(_ recipes: [Recipe]) -> [Recipe] {
        func byName(_ a: Recipe, _ b: Recipe) -> Bool {
            a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
        switch self {
        case .alphabetical:
            return recipes.sorted(by: byName)
        case .recentlyCooked:
            return recipes.sorted { a, b in
                let lhs = a.lastCookedAt ?? .distantPast
                let rhs = b.lastCookedAt ?? .distantPast
                return lhs == rhs ? byName(a, b) : lhs > rhs
            }
        case .recentlyAdded:
            return recipes.sorted { a, b in
                a.createdAt == b.createdAt ? byName(a, b) : a.createdAt > b.createdAt
            }
        case .mostCooked:
            return recipes.sorted { a, b in
                let lhs = a.cookCount ?? 0
                let rhs = b.cookCount ?? 0
                return lhs == rhs ? byName(a, b) : lhs > rhs
            }
        }
    }
}

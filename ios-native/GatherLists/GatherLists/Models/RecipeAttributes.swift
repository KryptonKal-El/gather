import Foundation

/// A labelled value in one of the recipe attribute vocabularies.
protocol RecipeAttributeOption: RawRepresentable, CaseIterable, Identifiable, Hashable where RawValue == String {
    var label: String { get }
}

extension RecipeAttributeOption {
    var id: String { rawValue }
}

enum RecipeCourse: String, RecipeAttributeOption {
    case main, side, dessert, snack, drink, component

    var label: String {
        switch self {
        case .main: return "Main dish"
        case .side: return "Side"
        case .dessert: return "Dessert"
        case .snack: return "Snack"
        case .drink: return "Drink"
        case .component: return "Sauce / base"
        }
    }
}

enum RecipeProtein: String, RecipeAttributeOption {
    case chicken, beef, pork, lamb, turkey, fish, shellfish, eggs, tofu, beans, dairy, none

    var label: String {
        switch self {
        case .tofu: return "Tofu / tempeh"
        case .beans: return "Beans / lentils"
        case .dairy: return "Cheese / dairy"
        case .none: return "No main protein"
        default: return rawValue.capitalized
        }
    }
}

enum RecipeCuisine: String, RecipeAttributeOption {
    case american, mexican, italian, french, spanish, greek, mediterranean
    case middleEastern = "middle_eastern"
    case indian, chinese, japanese, korean, thai, vietnamese, caribbean, african, other

    var label: String {
        switch self {
        case .middleEastern: return "Middle Eastern"
        default: return rawValue.capitalized
        }
    }
}

enum RecipeEffort: String, RecipeAttributeOption {
    case quick, medium, project

    var label: String {
        switch self {
        case .quick: return "Quick (under 30 min)"
        case .medium: return "Medium"
        case .project: return "Project (1 hr+)"
        }
    }
}

enum RecipeMethod: String, RecipeAttributeOption {
    case stovetop, oven, grill
    case slowCooker = "slow_cooker"
    case pressureCooker = "pressure_cooker"
    case airFryer = "air_fryer"
    case fried
    case noCook = "no_cook"

    var label: String {
        switch self {
        case .stovetop: return "Stovetop"
        case .oven: return "Oven"
        case .grill: return "Grill"
        case .slowCooker: return "Slow cooker"
        case .pressureCooker: return "Pressure cooker"
        case .airFryer: return "Air fryer"
        case .fried: return "Fried"
        case .noCook: return "No cook"
        }
    }
}

/// Planner-facing attributes of a recipe, mapped to the `recipe_attributes` Supabase table.
/// Categorical values are stored as raw strings so a value added in a later build doesn't
/// break decoding here; use the typed accessors.
struct RecipeAttributes: Codable, Hashable {
    let recipeId: UUID
    var course: String?
    var mealTypes: [String]
    var protein: String?
    var cuisine: String?
    var effort: String?
    var method: String?
    var kidFriendly: Bool?
    var perishables: [String]
    var manualFields: [String]
    var autoSourceHash: String?
    var autoTaggedAt: Date?

    /// Field names used in `manualFields`.
    enum Field: String, CaseIterable {
        case course
        case mealTypes = "meal_types"
        case protein, cuisine, effort, method
        case kidFriendly = "kid_friendly"
    }

    init(recipeId: UUID) {
        self.recipeId = recipeId
        mealTypes = []
        perishables = []
        manualFields = []
    }

    var courseValue: RecipeCourse? { course.flatMap(RecipeCourse.init(rawValue:)) }
    var proteinValue: RecipeProtein? { protein.flatMap(RecipeProtein.init(rawValue:)) }
    var cuisineValue: RecipeCuisine? { cuisine.flatMap(RecipeCuisine.init(rawValue:)) }
    var effortValue: RecipeEffort? { effort.flatMap(RecipeEffort.init(rawValue:)) }
    var methodValue: RecipeMethod? { method.flatMap(RecipeMethod.init(rawValue:)) }
    var mealTypeValues: [MealType] { MealType.allCases.filter { mealTypes.contains($0.rawValue) } }

    func isManual(_ field: Field) -> Bool {
        manualFields.contains(field.rawValue)
    }

    /// Short labels for display chips, in a stable order.
    var displayChips: [String] {
        var chips = mealTypeValues.map(\.label)
        if let courseValue, courseValue != .main { chips.append(courseValue.label) }
        if let proteinValue, proteinValue != .none { chips.append(proteinValue.label) }
        if let cuisineValue, cuisineValue != .other { chips.append(cuisineValue.label) }
        if let effortValue { chips.append(effortValue == .quick ? "Quick" : effortValue == .project ? "Project" : "Medium effort") }
        if let methodValue { chips.append(methodValue.label) }
        if kidFriendly == true { chips.append("Kid-friendly") }
        return chips
    }

    enum CodingKeys: String, CodingKey {
        case recipeId = "recipe_id"
        case course
        case mealTypes = "meal_types"
        case protein, cuisine, effort, method
        case kidFriendly = "kid_friendly"
        case perishables
        case manualFields = "manual_fields"
        case autoSourceHash = "auto_source_hash"
        case autoTaggedAt = "auto_tagged_at"
    }
}

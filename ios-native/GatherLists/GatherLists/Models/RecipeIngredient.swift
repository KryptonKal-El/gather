import Foundation

/// An ingredient belonging to a recipe, mapped to the `recipe_ingredients` Supabase table.
struct RecipeIngredient: Codable, Identifiable, Hashable {
    let id: UUID
    let recipeId: UUID
    let name: String
    let quantity: String?
    let sortOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case recipeId = "recipe_id"
        case name
        case quantity
        case sortOrder = "sort_order"
    }
}

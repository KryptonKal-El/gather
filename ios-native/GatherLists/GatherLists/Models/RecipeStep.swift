import Foundation

/// An instruction step belonging to a recipe, mapped to the `recipe_steps` Supabase table.
struct RecipeStep: Codable, Identifiable, Hashable {
    let id: UUID
    let recipeId: UUID
    let instruction: String
    let sortOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case recipeId = "recipe_id"
        case instruction
        case sortOrder = "sort_order"
    }
}

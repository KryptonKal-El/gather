import Foundation
import Supabase

/// Service layer wrapping Supabase queries for recipe collection operations.
struct RecipeService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Fetches all collections for a user, ordered by sort_order then created_at ascending.
    static func fetchCollections(userId: UUID) async throws -> [RecipeCollection] {
        let collections: [RecipeCollection] = try await client
            .from("collections")
            .select()
            .eq("owner_id", value: userId)
            .order("sort_order", ascending: true)
            .order("created_at", ascending: true)
            .execute()
            .value
        return collections
    }
    
    /// Creates a new collection for a user.
    static func createCollection(
        userId: UUID,
        name: String,
        emoji: String?,
        description: String?
    ) async throws -> RecipeCollection {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            throw RecipeServiceError.emptyName
        }
        
        let newCollection = NewCollection(
            ownerId: userId,
            name: trimmedName,
            emoji: emoji,
            description: description,
            isDefault: false
        )
        
        let collection: RecipeCollection = try await client
            .from("collections")
            .insert(newCollection)
            .select()
            .single()
            .execute()
            .value
        return collection
    }
    
    /// Partially updates a collection. Only non-nil fields are sent.
    static func updateCollection(
        collectionId: UUID,
        name: String? = nil,
        emoji: String? = nil,
        description: String? = nil
    ) async throws {
        let update = CollectionUpdate(
            name: name,
            emoji: emoji,
            description: description
        )
        try await client
            .from("collections")
            .update(update)
            .eq("id", value: collectionId)
            .execute()
    }
    
    /// Deletes a collection. Caller is responsible for handling recipes first (DB has RESTRICT FK).
    static func deleteCollection(collectionId: UUID) async throws {
        try await client
            .from("collections")
            .delete()
            .eq("id", value: collectionId)
            .execute()
    }
    
    /// Ensures a default collection exists for the user, creating one if needed.
    static func ensureDefaultCollection(userId: UUID) async throws -> RecipeCollection {
        let existing: [RecipeCollection] = try await client
            .from("collections")
            .select()
            .eq("owner_id", value: userId)
            .eq("is_default", value: true)
            .execute()
            .value
        
        if let defaultCollection = existing.first {
            return defaultCollection
        }
        
        let newDefault = NewCollection(
            ownerId: userId,
            name: "My Recipes",
            emoji: "📖",
            description: nil,
            isDefault: true
        )
        
        let collection: RecipeCollection = try await client
            .from("collections")
            .insert(newDefault)
            .select()
            .single()
            .execute()
            .value
        return collection
    }
    
    // MARK: - Recipe Operations
    
    /// Fetches all recipes for a user, ordered by created_at descending.
    static func fetchRecipes(userId: UUID) async throws -> [Recipe] {
        let recipes: [Recipe] = try await client
            .from("recipes")
            .select()
            .eq("owner_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return recipes
    }
    
    /// Fetches all recipes in a collection, ordered by created_at descending.
    static func fetchRecipesForCollection(collectionId: UUID) async throws -> [Recipe] {
        let recipes: [Recipe] = try await client
            .from("recipes")
            .select()
            .eq("collection_id", value: collectionId)
            .order("created_at", ascending: false)
            .execute()
            .value
        return recipes
    }
    
    /// Creates a new recipe with ingredients and steps.
    static func createRecipe(
        userId: UUID,
        name: String,
        description: String?,
        collectionId: UUID,
        ingredients: [(name: String, quantity: String?)],
        steps: [String]
    ) async throws -> Recipe {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            throw RecipeServiceError.emptyName
        }
        
        let newRecipe = NewRecipe(
            ownerId: userId,
            name: trimmedName,
            description: description,
            collectionId: collectionId
        )
        
        let recipe: Recipe = try await client
            .from("recipes")
            .insert(newRecipe)
            .select()
            .single()
            .execute()
            .value
        
        if !ingredients.isEmpty {
            let newIngredients = ingredients.enumerated().map { index, ingredient in
                NewIngredient(
                    recipeId: recipe.id,
                    name: ingredient.name,
                    quantity: ingredient.quantity,
                    sortOrder: index
                )
            }
            try await client
                .from("recipe_ingredients")
                .insert(newIngredients)
                .execute()
        }
        
        if !steps.isEmpty {
            let newSteps = steps.enumerated().map { index, instruction in
                NewStep(
                    recipeId: recipe.id,
                    instruction: instruction,
                    sortOrder: index
                )
            }
            try await client
                .from("recipe_steps")
                .insert(newSteps)
                .execute()
        }
        
        // Re-fetch to get updated counts from DB triggers
        let updatedRecipe: Recipe = try await client
            .from("recipes")
            .select()
            .eq("id", value: recipe.id)
            .single()
            .execute()
            .value
        return updatedRecipe
    }
    
    /// Partially updates a recipe. Only non-nil fields are sent.
    static func updateRecipe(
        recipeId: UUID,
        name: String? = nil,
        description: String? = nil
    ) async throws {
        let update = RecipeUpdate(name: name, description: description)
        try await client
            .from("recipes")
            .update(update)
            .eq("id", value: recipeId)
            .execute()
    }
    
    /// Deletes a recipe. Ingredients and steps cascade automatically.
    static func deleteRecipe(recipeId: UUID) async throws {
        try await client
            .from("recipes")
            .delete()
            .eq("id", value: recipeId)
            .execute()
    }
    
    /// Replaces all ingredients for a recipe.
    static func updateRecipeIngredients(
        recipeId: UUID,
        ingredients: [(name: String, quantity: String?)]
    ) async throws {
        try await client
            .from("recipe_ingredients")
            .delete()
            .eq("recipe_id", value: recipeId)
            .execute()
        
        if !ingredients.isEmpty {
            let newIngredients = ingredients.enumerated().map { index, ingredient in
                NewIngredient(
                    recipeId: recipeId,
                    name: ingredient.name,
                    quantity: ingredient.quantity,
                    sortOrder: index
                )
            }
            try await client
                .from("recipe_ingredients")
                .insert(newIngredients)
                .execute()
        }
    }
    
    /// Replaces all steps for a recipe.
    static func updateRecipeSteps(recipeId: UUID, steps: [String]) async throws {
        try await client
            .from("recipe_steps")
            .delete()
            .eq("recipe_id", value: recipeId)
            .execute()
        
        if !steps.isEmpty {
            let newSteps = steps.enumerated().map { index, instruction in
                NewStep(
                    recipeId: recipeId,
                    instruction: instruction,
                    sortOrder: index
                )
            }
            try await client
                .from("recipe_steps")
                .insert(newSteps)
                .execute()
        }
    }
    
    /// Fetches a recipe with its ingredients and steps.
    static func fetchRecipeDetail(recipeId: UUID) async throws -> (recipe: Recipe, ingredients: [RecipeIngredient], steps: [RecipeStep]) {
        let recipe: Recipe = try await client
            .from("recipes")
            .select()
            .eq("id", value: recipeId)
            .single()
            .execute()
            .value
        
        let ingredients: [RecipeIngredient] = try await client
            .from("recipe_ingredients")
            .select()
            .eq("recipe_id", value: recipeId)
            .order("sort_order", ascending: true)
            .execute()
            .value
        
        let steps: [RecipeStep] = try await client
            .from("recipe_steps")
            .select()
            .eq("recipe_id", value: recipeId)
            .order("sort_order", ascending: true)
            .execute()
            .value
        
        return (recipe, ingredients, steps)
    }
    
    /// Moves a recipe to a different collection.
    static func moveRecipeToCollection(recipeId: UUID, collectionId: UUID) async throws {
        let update = RecipeMoveUpdate(collectionId: collectionId)
        try await client
            .from("recipes")
            .update(update)
            .eq("id", value: recipeId)
            .execute()
    }
    
    // MARK: - Collection Sharing
    
    /// Shares a collection with a user by email.
    static func shareCollection(collectionId: UUID, email: String, sharedBy: UUID) async throws {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let newShare = NewCollectionShare(
            collectionId: collectionId,
            sharedWithEmail: normalizedEmail,
            sharedBy: sharedBy,
            permission: "write"
        )
        try await client
            .from("collection_shares")
            .insert(newShare)
            .execute()
    }
    
    /// Removes a collection share for a user by email.
    static func unshareCollection(collectionId: UUID, email: String) async throws {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        try await client
            .from("collection_shares")
            .delete()
            .eq("collection_id", value: collectionId)
            .eq("shared_with_email", value: normalizedEmail)
            .execute()
    }
    
    /// Fetches all shares for a collection.
    static func fetchCollectionShares(collectionId: UUID) async throws -> [CollectionShare] {
        let shares: [CollectionShare] = try await client
            .from("collection_shares")
            .select()
            .eq("collection_id", value: collectionId)
            .execute()
            .value
        return shares
    }
    
    /// Fetches all collections shared with a user by email.
    static func fetchSharedCollections(email: String) async throws -> [RecipeCollection] {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let shares: [CollectionShare] = try await client
            .from("collection_shares")
            .select()
            .eq("shared_with_email", value: normalizedEmail)
            .execute()
            .value
        guard !shares.isEmpty else { return [] }
        let collectionIds = shares.map { $0.collectionId }
        let collections: [RecipeCollection] = try await client
            .from("collections")
            .select()
            .in("id", values: collectionIds)
            .execute()
            .value
        return collections
    }
}

// MARK: - Errors

enum RecipeServiceError: Error, LocalizedError {
    case emptyName
    
    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Collection name cannot be empty"
        }
    }
}

// MARK: - DTOs

private struct NewCollection: Encodable {
    let ownerId: UUID
    let name: String
    let emoji: String?
    let description: String?
    let isDefault: Bool
    
    enum CodingKeys: String, CodingKey {
        case ownerId = "owner_id"
        case name
        case emoji
        case description
        case isDefault = "is_default"
    }
}

private struct CollectionUpdate: Encodable {
    var name: String?
    var emoji: String?
    var description: String?
    
    enum CodingKeys: String, CodingKey {
        case name
        case emoji
        case description
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let name = name { try container.encode(name, forKey: .name) }
        if let emoji = emoji { try container.encode(emoji, forKey: .emoji) }
        if let description = description { try container.encode(description, forKey: .description) }
    }
}

private struct NewRecipe: Encodable {
    let ownerId: UUID
    let name: String
    let description: String?
    let collectionId: UUID
    
    enum CodingKeys: String, CodingKey {
        case ownerId = "owner_id"
        case name
        case description
        case collectionId = "collection_id"
    }
}

private struct RecipeUpdate: Encodable {
    var name: String?
    var description: String?
    
    enum CodingKeys: String, CodingKey {
        case name
        case description
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let name = name { try container.encode(name, forKey: .name) }
        if let description = description { try container.encode(description, forKey: .description) }
    }
}

private struct NewIngredient: Encodable {
    let recipeId: UUID
    let name: String
    let quantity: String?
    let sortOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case recipeId = "recipe_id"
        case name
        case quantity
        case sortOrder = "sort_order"
    }
}

private struct NewStep: Encodable {
    let recipeId: UUID
    let instruction: String
    let sortOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case recipeId = "recipe_id"
        case instruction
        case sortOrder = "sort_order"
    }
}

private struct RecipeMoveUpdate: Encodable {
    let collectionId: UUID
    
    enum CodingKeys: String, CodingKey {
        case collectionId = "collection_id"
    }
}

private struct NewCollectionShare: Encodable {
    let collectionId: UUID
    let sharedWithEmail: String
    let sharedBy: UUID
    let permission: String
    
    enum CodingKeys: String, CodingKey {
        case collectionId = "collection_id"
        case sharedWithEmail = "shared_with_email"
        case sharedBy = "shared_by"
        case permission
    }
}

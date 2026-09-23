import Foundation
import Supabase

/// Service layer wrapping Supabase queries for `recipe_attributes`.
struct RecipeAttributeService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }

    /// Fetches attributes for every recipe the user can see. RLS scopes the rows.
    static func fetchAll() async throws -> [RecipeAttributes] {
        try await client
            .from("recipe_attributes")
            .select()
            .execute()
            .value
    }

    /// Fetches one recipe's attributes, or nil when it has none yet.
    static func fetch(recipeId: UUID) async throws -> RecipeAttributes? {
        let rows: [RecipeAttributes] = try await client
            .from("recipe_attributes")
            .select()
            .eq("recipe_id", value: recipeId)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Creates or replaces a recipe's attributes and returns the saved row.
    @discardableResult
    static func upsert(_ attributes: RecipeAttributes, userId: UUID) async throws -> RecipeAttributes {
        try await client
            .from("recipe_attributes")
            .upsert(RecipeAttributesUpsert(attributes: attributes, updatedBy: userId), onConflict: "recipe_id")
            .select()
            .single()
            .execute()
            .value
    }
}

/// Encodes every column explicitly (including nils) so clearing a value clears it in the row.
private struct RecipeAttributesUpsert: Encodable {
    let attributes: RecipeAttributes
    let updatedBy: UUID

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
        case updatedBy = "updated_by"
        case updatedAt = "updated_at"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(attributes.recipeId, forKey: .recipeId)
        try container.encode(attributes.course, forKey: .course)
        try container.encode(attributes.mealTypes, forKey: .mealTypes)
        try container.encode(attributes.protein, forKey: .protein)
        try container.encode(attributes.cuisine, forKey: .cuisine)
        try container.encode(attributes.effort, forKey: .effort)
        try container.encode(attributes.method, forKey: .method)
        try container.encode(attributes.kidFriendly, forKey: .kidFriendly)
        try container.encode(attributes.perishables, forKey: .perishables)
        try container.encode(attributes.manualFields, forKey: .manualFields)
        try container.encode(attributes.autoSourceHash, forKey: .autoSourceHash)
        try container.encode(attributes.autoTaggedAt, forKey: .autoTaggedAt)
        try container.encode(updatedBy, forKey: .updatedBy)
        try container.encode(Date(), forKey: .updatedAt)
    }
}

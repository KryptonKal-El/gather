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

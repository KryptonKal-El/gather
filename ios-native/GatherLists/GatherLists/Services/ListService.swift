import Foundation
import Supabase

/// Service layer wrapping Supabase queries for list and share operations.
struct ListService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    // MARK: - List Operations
    
    /// Fetches all lists owned by the given user, ordered by sort_order ascending.
    static func fetchOwnedLists(userId: UUID) async throws -> [GatherList] {
        let lists: [GatherList] = try await client
            .from("lists")
            .select()
            .eq("owner_id", value: userId)
            .order("sort_order", ascending: true)
            .execute()
            .value
        return lists
    }
    
    /// Creates a new list and returns it.
    static func createList(userId: UUID, name: String, emoji: String?, color: String, sortOrder: Int = 0) async throws -> GatherList {
        let newList = NewList(ownerId: userId, name: name, emoji: emoji, color: color, sortOrder: sortOrder)
        let list: GatherList = try await client
            .from("lists")
            .insert(newList)
            .select()
            .single()
            .execute()
            .value
        return list
    }
    
    /// Updates a list's name, emoji, and/or color.
    static func updateList(listId: UUID, name: String?, emoji: String?, color: String?) async throws {
        let update = ListUpdate(name: name, emoji: emoji, color: color)
        try await client
            .from("lists")
            .update(update)
            .eq("id", value: listId)
            .execute()
    }
    
    /// Deletes a list. Items cascade-delete via FK constraint.
    static func deleteList(listId: UUID) async throws {
        try await client
            .from("lists")
            .delete()
            .eq("id", value: listId)
            .execute()
    }
    
    /// Saves the order of lists by upserting all lists with updated sort_order values.
    static func saveListOrder(userId: UUID, lists: [GatherList]) async throws {
        let entries = lists.enumerated().map { index, list in
            ListOrderEntry(
                id: list.id,
                ownerId: userId,
                name: list.name,
                emoji: list.emoji,
                itemCount: list.itemCount,
                color: list.color,
                sortOrder: index,
                createdAt: list.createdAt
            )
        }
        try await client
            .from("lists")
            .upsert(entries, onConflict: "id")
            .execute()
    }
    
    // MARK: - Share Operations
    
    /// Shares a list with a user by email (lowercased, trimmed).
    static func shareList(listId: UUID, email: String) async throws {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let newShare = NewListShare(listId: listId, sharedWithEmail: normalizedEmail)
        try await client
            .from("list_shares")
            .insert(newShare)
            .execute()
    }
    
    /// Removes sharing for a given email from a list.
    static func unshareList(listId: UUID, email: String) async throws {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        try await client
            .from("list_shares")
            .delete()
            .eq("list_id", value: listId)
            .eq("shared_with_email", value: normalizedEmail)
            .execute()
    }
    
    /// Fetches all share records for a given list.
    static func fetchSharesForList(listId: UUID) async throws -> [ListShare] {
        let shares: [ListShare] = try await client
            .from("list_shares")
            .select()
            .eq("list_id", value: listId)
            .execute()
            .value
        return shares
    }
    
    /// Fetches lists shared with the user, merging share refs with list metadata.
    /// Returns full GatherList objects for all lists shared with this email.
    static func fetchSharedWithMe(email: String) async throws -> [GatherList] {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Step 1: Fetch share records for this email
        let shares: [ListShare] = try await client
            .from("list_shares")
            .select()
            .eq("shared_with_email", value: normalizedEmail)
            .execute()
            .value
        
        guard !shares.isEmpty else { return [] }
        
        // Step 2: Fetch the parent lists by their IDs
        let listIds = shares.map { $0.listId }
        let lists: [GatherList] = try await client
            .from("lists")
            .select()
            .in("id", values: listIds)
            .execute()
            .value
        
        return lists
    }
}

// MARK: - DTOs for Insert/Update

/// Lightweight struct for inserting a new list.
private struct NewList: Encodable {
    let ownerId: UUID
    let name: String
    let emoji: String?
    let color: String
    let itemCount: Int = 0
    let sortOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case ownerId = "owner_id"
        case name, emoji, color
        case itemCount = "item_count"
        case sortOrder = "sort_order"
    }
}

/// Lightweight struct for updating a list. Only non-nil fields are encoded.
private struct ListUpdate: Encodable {
    var name: String?
    var emoji: String?
    var color: String?
}

/// Lightweight struct for inserting a new share.
private struct NewListShare: Encodable {
    let listId: UUID
    let sharedWithEmail: String
    
    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case sharedWithEmail = "shared_with_email"
    }
}

/// Lightweight struct for upserting list order.
private struct ListOrderEntry: Encodable {
    let id: UUID
    let ownerId: UUID
    let name: String
    let emoji: String?
    let itemCount: Int
    let color: String
    let sortOrder: Int
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case name
        case emoji
        case itemCount = "item_count"
        case color
        case sortOrder = "sort_order"
        case createdAt = "created_at"
    }
}

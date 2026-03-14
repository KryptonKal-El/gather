import Foundation
import Supabase

/// Pairs a GatherList with the share-level sort config for shared users.
struct SharedListRef {
    let list: GatherList
    let shareSortConfig: [String]?
}

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
    static func createList(userId: UUID, name: String, emoji: String?, color: String, sortOrder: Int = 0, type: String = "grocery") async throws -> GatherList {
        let newList = NewList(ownerId: userId, name: name, emoji: emoji, color: color, sortOrder: sortOrder, type: type)
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
    static func updateList(listId: UUID, name: String?, emoji: String?, color: String?, type: String? = nil) async throws {
        let update = ListUpdate(name: name, emoji: emoji, color: color, type: type)
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
                createdAt: list.createdAt,
                type: list.type
            )
        }
        try await client
            .from("lists")
            .upsert(entries, onConflict: "id")
            .execute()
    }
    
    // MARK: - Share Operations
    
    /// Shares a list with a user by email (lowercased, trimmed).
    static func shareList(listId: UUID, email: String, sortConfig: [String]? = nil) async throws {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let newShare = NewListShare(listId: listId, sharedWithEmail: normalizedEmail, sortConfig: sortConfig)
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
    
    /// Fetches lists shared with the user, paired with their share-level sort_config.
    static func fetchSharedWithMeRefs(email: String) async throws -> [SharedListRef] {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        let shares: [ListShare] = try await client
            .from("list_shares")
            .select()
            .eq("shared_with_email", value: normalizedEmail)
            .execute()
            .value
        
        guard !shares.isEmpty else { return [] }
        
        let listIds = shares.map { $0.listId }
        let lists: [GatherList] = try await client
            .from("lists")
            .select()
            .in("id", values: listIds)
            .execute()
            .value
        
        let listMap = Dictionary(uniqueKeysWithValues: lists.map { ($0.id, $0) })
        
        return shares.compactMap { share in
            guard let list = listMap[share.listId] else { return nil }
            return SharedListRef(list: list, shareSortConfig: share.sortConfig)
        }
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
    let type: String
    
    enum CodingKeys: String, CodingKey {
        case ownerId = "owner_id"
        case name, emoji, color
        case itemCount = "item_count"
        case sortOrder = "sort_order"
        case type
    }
}

/// Lightweight struct for updating a list. Only non-nil fields are encoded.
private struct ListUpdate: Encodable {
    var name: String?
    var emoji: String?
    var color: String?
    var type: String?
}

/// Lightweight struct for inserting a new share.
private struct NewListShare: Encodable {
    let listId: UUID
    let sharedWithEmail: String
    let sortConfig: [String]?
    
    enum CodingKeys: String, CodingKey {
        case listId = "list_id"
        case sharedWithEmail = "shared_with_email"
        case sortConfig = "sort_config"
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
    let type: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case ownerId = "owner_id"
        case name
        case emoji
        case itemCount = "item_count"
        case color
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case type
    }
}

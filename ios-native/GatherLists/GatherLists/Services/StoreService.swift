import Foundation
import Supabase

/// Service layer wrapping Supabase queries for store operations.
struct StoreService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Fetches all stores for a user, ordered by sort_order ascending.
    static func fetchStores(userId: UUID) async throws -> [Store] {
        let stores: [Store] = try await client
            .from("stores")
            .select()
            .eq("user_id", value: userId)
            .order("sort_order", ascending: true)
            .execute()
            .value
        return stores
    }
    
    /// Fetches stores by their IDs. Used to load shared-list owner stores.
    static func fetchStoresByIds(_ ids: [UUID]) async throws -> [Store] {
        guard !ids.isEmpty else { return [] }
        let stores: [Store] = try await client
            .from("stores")
            .select()
            .in("id", values: ids.map { $0.uuidString })
            .order("sort_order", ascending: true)
            .execute()
            .value
        return stores
    }
    
    /// Creates a new store for a user.
    static func createStore(
        userId: UUID,
        name: String,
        color: String?
    ) async throws -> Store {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            throw StoreServiceError.emptyName
        }
        
        let existingStores = try await fetchStores(userId: userId)
        let sortOrder = existingStores.count
        
        let newStore = NewStore(
            userId: userId,
            name: trimmedName,
            color: color,
            sortOrder: sortOrder
        )
        
        let store: Store = try await client
            .from("stores")
            .insert(newStore)
            .select()
            .single()
            .execute()
            .value
        return store
    }
    
    /// Partially updates a store. Only non-nil fields are sent.
    static func updateStore(
        storeId: UUID,
        name: String? = nil,
        color: String? = nil
    ) async throws {
        let update = StoreUpdate(
            name: name,
            color: color
        )
        try await client
            .from("stores")
            .update(update)
            .eq("id", value: storeId)
            .execute()
    }
    
    /// Deletes a store.
    static func deleteStore(storeId: UUID) async throws {
        try await client
            .from("stores")
            .delete()
            .eq("id", value: storeId)
            .execute()
    }
    
    /// Saves the order of stores by upserting all stores with updated sort_order values.
    static func saveStoreOrder(userId: UUID, stores: [Store]) async throws {
        let entries = stores.enumerated().map { index, store in
            StoreOrderEntry(
                id: store.id,
                userId: userId,
                name: store.name,
                color: store.color,
                sortOrder: index,
                createdAt: store.createdAt
            )
        }
        try await client
            .from("stores")
            .upsert(entries, onConflict: "id")
            .execute()
    }
}

// MARK: - Errors

enum StoreServiceError: Error, LocalizedError {
    case emptyName
    
    var errorDescription: String? {
        switch self {
        case .emptyName:
            return "Store name cannot be empty"
        }
    }
}

// MARK: - DTOs

private struct NewStore: Encodable {
    let userId: UUID
    let name: String
    let color: String?
    let sortOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case name
        case color
        case sortOrder = "sort_order"
    }
}

private struct StoreUpdate: Encodable {
    var name: String?
    var color: String?
    
    enum CodingKeys: String, CodingKey {
        case name
        case color
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let name = name { try container.encode(name, forKey: .name) }
        if let color = color { try container.encode(color, forKey: .color) }
    }
}

private struct StoreOrderEntry: Encodable {
    let id: UUID
    let userId: UUID
    let name: String
    let color: String?
    let sortOrder: Int
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case color
        case sortOrder = "sort_order"
        case createdAt = "created_at"
    }
}

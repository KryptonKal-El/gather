import Foundation
import Supabase

/// Service layer wrapping Supabase queries for item history (autocomplete) operations.
struct HistoryService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }

    /// Fetches history entries for a list, ordered by added_at ascending.
    ///
    /// No user_id filter: RLS returns the caller's legacy (list-less) rows plus
    /// every collaborator's rows for lists the caller can access, so suggestions
    /// reflect items added by anyone on a shared list.
    static func fetchHistory(listId: UUID) async throws -> [HistoryEntry] {
        let entries: [HistoryEntry] = try await client
            .from("history")
            .select()
            .eq("list_id", value: listId)
            .order("added_at", ascending: true)
            .execute()
            .value
        return entries
    }

    /// Adds a single history entry mirroring an item's reusable fields, so the
    /// item can be restored in full when re-added from suggestions. Edits are
    /// kept in sync afterward by a DB trigger.
    static func addHistoryEntry(
        userId: UUID,
        listId: UUID,
        name: String,
        imageUrl: String? = nil,
        category: String? = nil,
        storeId: UUID? = nil,
        quantity: Int? = nil,
        price: Decimal? = nil,
        unit: String? = nil,
        note: String? = nil,
        url: String? = nil,
        priority: String? = nil
    ) async throws {
        let entry = NewHistoryEntry(
            userId: userId, listId: listId, name: name, imageUrl: imageUrl,
            category: category, storeId: storeId, quantity: quantity,
            price: price, unit: unit, note: note, url: url, priority: priority
        )
        try await client
            .from("history")
            .insert(entry)
            .execute()
    }

    /// Batch inserts multiple history entries scoped to a list.
    static func addHistoryEntries(userId: UUID, listId: UUID, names: [String]) async throws {
        guard !names.isEmpty else { return }
        let entries = names.map {
            NewHistoryEntry(userId: userId, listId: listId, name: $0, imageUrl: nil,
                            category: nil, storeId: nil, quantity: nil, price: nil, unit: nil, note: nil,
                            url: nil, priority: nil)
        }
        try await client
            .from("history")
            .insert(entries)
            .execute()
    }
}

// MARK: - DTOs

private struct NewHistoryEntry: Encodable {
    let userId: UUID
    let listId: UUID
    let name: String
    let imageUrl: String?
    let category: String?
    let storeId: UUID?
    let quantity: Int?
    let price: Decimal?
    let unit: String?
    let note: String?
    let url: String?
    let priority: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case listId = "list_id"
        case name
        case imageUrl = "image_url"
        case category
        case storeId = "store_id"
        case quantity
        case price
        case unit
        case note
        case url
        case priority
    }
}

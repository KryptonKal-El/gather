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

    /// Adds a single history entry scoped to a list.
    static func addHistoryEntry(userId: UUID, listId: UUID, name: String, imageUrl: String? = nil) async throws {
        let entry = NewHistoryEntry(userId: userId, listId: listId, name: name, imageUrl: imageUrl)
        try await client
            .from("history")
            .insert(entry)
            .execute()
    }

    /// Batch inserts multiple history entries scoped to a list.
    static func addHistoryEntries(userId: UUID, listId: UUID, names: [String]) async throws {
        guard !names.isEmpty else { return }
        let entries = names.map { NewHistoryEntry(userId: userId, listId: listId, name: $0, imageUrl: nil) }
        try await client
            .from("history")
            .insert(entries)
            .execute()
    }

    /// Records an item's image on its list-scoped history rows so the image
    /// carries over when the item is later re-added from suggestions. Matches by
    /// list and name (names are capitalized consistently at add time).
    static func setHistoryImageForItem(listId: UUID, name: String, imageUrl: String?) async throws {
        try await client
            .from("history")
            .update(HistoryImageUpdate(imageUrl: imageUrl))
            .eq("list_id", value: listId)
            .eq("name", value: name)
            .execute()
    }
}

// MARK: - DTOs

private struct NewHistoryEntry: Encodable {
    let userId: UUID
    let listId: UUID
    let name: String
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case listId = "list_id"
        case name
        case imageUrl = "image_url"
    }
}

private struct HistoryImageUpdate: Encodable {
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case imageUrl = "image_url"
    }

    // Always encode the key (writing null when clearing) so the column updates.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(imageUrl, forKey: .imageUrl)
    }
}

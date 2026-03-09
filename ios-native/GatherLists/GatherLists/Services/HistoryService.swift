import Foundation
import Supabase

/// Service layer wrapping Supabase queries for item history (autocomplete) operations.
struct HistoryService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Fetches all history entries for a user, ordered by added_at ascending.
    static func fetchHistory(userId: UUID) async throws -> [HistoryEntry] {
        let entries: [HistoryEntry] = try await client
            .from("history")
            .select()
            .eq("user_id", value: userId)
            .order("added_at", ascending: true)
            .execute()
            .value
        return entries
    }
    
    /// Adds a single history entry.
    static func addHistoryEntry(userId: UUID, name: String) async throws {
        let entry = NewHistoryEntry(userId: userId, name: name)
        try await client
            .from("history")
            .insert(entry)
            .execute()
    }
    
    /// Batch inserts multiple history entries.
    static func addHistoryEntries(userId: UUID, names: [String]) async throws {
        guard !names.isEmpty else { return }
        let entries = names.map { NewHistoryEntry(userId: userId, name: $0) }
        try await client
            .from("history")
            .insert(entries)
            .execute()
    }
}

// MARK: - DTOs

private struct NewHistoryEntry: Encodable {
    let userId: UUID
    let name: String
    
    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case name
    }
}

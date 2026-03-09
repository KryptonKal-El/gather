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
}

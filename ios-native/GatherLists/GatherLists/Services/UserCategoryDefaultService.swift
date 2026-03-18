import Foundation
import Supabase

enum UserCategoryDefaultService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    static func fetchDefaults(userId: UUID) async throws -> [UserCategoryDefault] {
        try await client
            .from("user_category_defaults")
            .select()
            .eq("user_id", value: userId)
            .execute()
            .value
    }
    
    static func upsertDefault(userId: UUID, listType: String, categories: [CategoryDef]) async throws {
        struct UpsertPayload: Encodable {
            let userId: UUID
            let listType: String
            let categories: [CategoryDef]
            
            enum CodingKeys: String, CodingKey {
                case userId = "user_id"
                case listType = "list_type"
                case categories
            }
        }
        
        try await client
            .from("user_category_defaults")
            .upsert(UpsertPayload(userId: userId, listType: listType, categories: categories))
            .execute()
    }
}

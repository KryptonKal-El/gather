import Foundation
import Supabase

struct UserStoreDefault: Codable {
    let id: UUID
    let userId: UUID
    let listType: String
    let name: String
    let color: String?
    let sortOrder: Int
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case listType = "list_type"
        case name
        case color
        case sortOrder = "sort_order"
        case createdAt = "created_at"
    }
}

enum UserStoreDefaultService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    static func fetchDefaults(userId: UUID, listType: String) async throws -> [UserStoreDefault] {
        try await client
            .from("user_store_defaults")
            .select()
            .eq("user_id", value: userId)
            .eq("list_type", value: listType)
            .order("sort_order", ascending: true)
            .execute()
            .value
    }
    
    static func createDefault(userId: UUID, listType: String, name: String, color: String?, sortOrder: Int) async throws -> UserStoreDefault {
        struct CreatePayload: Encodable {
            let userId: UUID
            let listType: String
            let name: String
            let color: String?
            let sortOrder: Int
            
            enum CodingKeys: String, CodingKey {
                case userId = "user_id"
                case listType = "list_type"
                case name
                case color
                case sortOrder = "sort_order"
            }
        }
        
        let payload = CreatePayload(userId: userId, listType: listType, name: name, color: color, sortOrder: sortOrder)
        let result: UserStoreDefault = try await client
            .from("user_store_defaults")
            .insert(payload)
            .select()
            .single()
            .execute()
            .value
        return result
    }
    
    static func updateDefault(id: UUID, name: String? = nil, color: String? = nil, sortOrder: Int? = nil) async throws {
        struct UpdatePayload: Encodable {
            var name: String?
            var color: String?
            var sortOrder: Int?
            
            enum CodingKeys: String, CodingKey {
                case name
                case color
                case sortOrder = "sort_order"
            }
            
            func encode(to encoder: Encoder) throws {
                var container = encoder.container(keyedBy: CodingKeys.self)
                if let name = name { try container.encode(name, forKey: .name) }
                if let color = color { try container.encode(color, forKey: .color) }
                if let sortOrder = sortOrder { try container.encode(sortOrder, forKey: .sortOrder) }
            }
        }
        
        let payload = UpdatePayload(name: name, color: color, sortOrder: sortOrder)
        try await client
            .from("user_store_defaults")
            .update(payload)
            .eq("id", value: id)
            .execute()
    }
    
    static func deleteDefault(id: UUID) async throws {
        try await client
            .from("user_store_defaults")
            .delete()
            .eq("id", value: id)
            .execute()
    }
    
    static func saveOrder(defaults: [UserStoreDefault]) async throws {
        struct OrderEntry: Encodable {
            let id: UUID
            let sortOrder: Int
            
            enum CodingKeys: String, CodingKey {
                case id
                case sortOrder = "sort_order"
            }
        }
        
        let entries = defaults.enumerated().map { index, store in
            OrderEntry(id: store.id, sortOrder: index)
        }
        
        try await client
            .from("user_store_defaults")
            .upsert(entries, onConflict: "id")
            .execute()
    }
}

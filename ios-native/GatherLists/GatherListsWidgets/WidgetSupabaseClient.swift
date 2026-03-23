import Foundation

enum WidgetSupabaseError: Error, LocalizedError {
    case missingConfig
    case missingAuth
    case requestFailed(statusCode: Int)
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .missingConfig:
            return "Supabase configuration not found"
        case .missingAuth:
            return "Authentication required"
        case .requestFailed(let code):
            return "Request failed with status \(code)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

/// Lightweight Supabase client for widget extension using direct REST API calls.
struct WidgetSupabaseClient {
    
    /// Adds a new item to the specified list.
    static func addItem(name: String, listId: UUID) async throws {
        guard let supabaseUrl = SharedDefaults.getSupabaseUrl(),
              let supabaseKey = SharedDefaults.getSupabaseAnonKey(),
              !supabaseUrl.isEmpty, !supabaseKey.isEmpty else {
            throw WidgetSupabaseError.missingConfig
        }
        
        guard let accessToken = SharedDefaults.getAccessToken(), !accessToken.isEmpty else {
            throw WidgetSupabaseError.missingAuth
        }
        
        guard let url = URL(string: "\(supabaseUrl)/rest/v1/items") else {
            throw WidgetSupabaseError.missingConfig
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let itemId = UUID()
        let now = ISO8601DateFormatter().string(from: Date())
        
        let body: [String: Any] = [
            "id": itemId.uuidString,
            "list_id": listId.uuidString,
            "name": name,
            "is_checked": false,
            "quantity": 1,
            "unit": "each",
            "added_at": now
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw WidgetSupabaseError.requestFailed(statusCode: 0)
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                throw WidgetSupabaseError.requestFailed(statusCode: httpResponse.statusCode)
            }
        } catch let error as WidgetSupabaseError {
            throw error
        } catch {
            throw WidgetSupabaseError.networkError(error)
        }
    }
}

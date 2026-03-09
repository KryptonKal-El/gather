import Foundation
import Supabase

/// Singleton manager that initializes and provides access to the Supabase client.
@MainActor
final class SupabaseManager {
    static let shared = SupabaseManager()
    
    let client: SupabaseClient
    let supabaseURL: URL
    let anonKey: String
    
    private init() {
        guard let path = Bundle.main.path(forResource: "Secrets", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path),
              let urlString = dict["SUPABASE_URL"] as? String,
              let anonKey = dict["SUPABASE_ANON_KEY"] as? String,
              let url = URL(string: urlString) else {
            fatalError("Missing or invalid Secrets.plist — copy Secrets.plist.example to Secrets.plist and fill in your Supabase credentials")
        }
        
        supabaseURL = url
        self.anonKey = anonKey
        client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }
}

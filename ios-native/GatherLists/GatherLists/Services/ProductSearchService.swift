import Foundation

/// Result from the search-products edge function.
struct ProductSearchResult: Codable {
    let url: String
    let thumbnail: String
    let title: String
}

private actor SearchCache {
    private var cache: [String: (results: [ProductSearchResult], timestamp: Date)] = [:]
    private let ttl: TimeInterval = 300 // 5 minutes
    
    func get(_ key: String) -> [ProductSearchResult]? {
        guard let entry = cache[key],
              Date().timeIntervalSince(entry.timestamp) < ttl else {
            return nil
        }
        return entry.results
    }
    
    func set(_ key: String, results: [ProductSearchResult]) {
        cache[key] = (results: results, timestamp: Date())
    }
}

/// Client for the search-products Supabase edge function.
struct ProductSearchService {
    fileprivate static let cache = SearchCache()
    /// Searches for product images online via the edge function.
    /// Returns an empty array on failure (graceful degradation).
    @MainActor
    static func searchProducts(query: String, count: Int = 8) async -> [ProductSearchResult] {
        let cacheKey = query.trimmingCharacters(in: .whitespaces).lowercased()
        if let cached = await cache.get(cacheKey) {
            return cached
        }
        
        let manager = SupabaseManager.shared
        let baseURL = manager.supabaseURL.absoluteString
        let anonKey = manager.anonKey
        
        guard var components = URLComponents(string: "\(baseURL)/functions/v1/search-products") else {
            return []
        }
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "num", value: String(count))
        ]
        guard let url = components.url else { return [] }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                print("[ProductSearchService] HTTP error for query '\(query)'")
                return []
            }
            let decoded = try JSONDecoder().decode(SearchResponse.self, from: data)
            await cache.set(cacheKey, results: decoded.results)
            return decoded.results
        } catch {
            print("[ProductSearchService] Search failed: \(error.localizedDescription)")
            return []
        }
    }
}

private struct SearchResponse: Codable {
    let results: [ProductSearchResult]
}

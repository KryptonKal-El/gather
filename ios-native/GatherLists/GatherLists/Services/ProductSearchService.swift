import Foundation

/// Result from the search-products edge function.
struct ProductSearchResult: Codable {
    let url: String
    let thumbnail: String
    let title: String
}

/// Typealias for backward compatibility and cleaner naming.
typealias ProductResult = ProductSearchResult

/// Grouped results from image search, organized by source.
struct ProductResultGroup: Codable {
    let source: String
    let label: String
    let results: [ProductResult]
}

private actor SearchCache {
    private var cache: [String: (groups: [ProductResultGroup], timestamp: Date)] = [:]
    private let ttl: TimeInterval = 300 // 5 minutes
    
    func get(_ key: String) -> [ProductResultGroup]? {
        guard let entry = cache[key],
              Date().timeIntervalSince(entry.timestamp) < ttl else {
            return nil
        }
        return entry.groups
    }
    
    func set(_ key: String, groups: [ProductResultGroup]) {
        cache[key] = (groups: groups, timestamp: Date())
    }
}

/// Client for the search-products Supabase edge function.
struct ProductSearchService {
    fileprivate static let cache = SearchCache()
    
    /// Searches for product images online via the edge function.
    /// Returns an empty array on failure (graceful degradation).
    /// - Parameters:
    ///   - query: Search query string
    ///   - count: Number of results per source (default 25)
    ///   - sources: Image search settings determining which providers to query (default all enabled via defaultSettings)
    /// - Returns: Grouped results organized by source, or empty array if all sources disabled or request fails
    @MainActor
    static func searchProducts(query: String, count: Int = 25, sources: ImageSearchSettings = .defaultSettings) async -> [ProductResultGroup] {
        // Early return if all sources are disabled
        guard sources.walmart || sources.spoonacular || sources.openfoodfacts || sources.serpapi else {
            return []
        }
        
        let enabledSources = [
            sources.walmart ? "walmart" : nil,
            sources.spoonacular ? "spoonacular" : nil,
            sources.openfoodfacts ? "openfoodfacts" : nil,
            sources.serpapi ? "serpapi" : nil
        ].compactMap { $0 }.joined(separator: ",")
        
        let cacheKey = "\(query.trimmingCharacters(in: .whitespaces).lowercased()):\(enabledSources)"
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
            URLQueryItem(name: "num", value: String(count)),
            URLQueryItem(name: "sources", value: enabledSources)
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
            if !decoded.groups.isEmpty {
                await cache.set(cacheKey, groups: decoded.groups)
            }
            return decoded.groups
        } catch {
            print("[ProductSearchService] Search failed: \(error.localizedDescription)")
            return []
        }
    }
}

private struct SearchResponse: Codable {
    let groups: [ProductResultGroup]
}

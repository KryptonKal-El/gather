import Foundation

/// Result from the search-products edge function.
struct ProductSearchResult: Codable {
    let url: String
    let thumbnail: String
    let title: String
}

/// Typealias for backward compatibility and cleaner naming.
typealias ProductResult = ProductSearchResult

/// An image search provider, in display order.
enum ImageSearchSource: String, CaseIterable, Identifiable {
    case walmart, spoonacular, openfoodfacts, serpapi

    var id: String { rawValue }

    /// Section title shown above this source's results.
    var label: String {
        switch self {
        case .walmart: "Walmart"
        case .spoonacular: "Spoonacular"
        case .openfoodfacts: "Open Food Facts"
        case .serpapi: "Google Images"
        }
    }

    /// The sources the user has enabled, in display order.
    static func enabled(in settings: ImageSearchSettings) -> [ImageSearchSource] {
        allCases.filter { source in
            switch source {
            case .walmart: settings.walmart
            case .spoonacular: settings.spoonacular
            case .openfoodfacts: settings.openfoodfacts
            case .serpapi: settings.serpapi
            }
        }
    }
}

/// Why a single-source image search could not produce results.
enum ProductSearchError: Error {
    case invalidURL
    case http(Int)
    /// The edge function reported that the provider errored or timed out.
    case sourceFailed
}

private actor SearchCache {
    private var cache: [String: (results: [ProductResult], timestamp: Date)] = [:]
    private let ttl: TimeInterval = 300 // 5 minutes

    func get(_ key: String) -> [ProductResult]? {
        guard let entry = cache[key],
              Date().timeIntervalSince(entry.timestamp) < ttl else {
            return nil
        }
        return entry.results
    }

    func set(_ key: String, results: [ProductResult]) {
        cache[key] = (results: results, timestamp: Date())
    }
}

/// Client for the search-products Supabase edge function.
struct ProductSearchService {
    fileprivate static let cache = SearchCache()

    /// Searches one source for product images via the edge function, so each
    /// source can load, fail, and be retried on its own.
    /// Successful results (including empty ones) are cached for 5 minutes; failures never are.
    /// - Parameters:
    ///   - query: Search query string
    ///   - source: The provider to query
    ///   - count: Number of results to request (default 25)
    /// - Returns: The source's results; empty when it found nothing
    /// - Throws: `ProductSearchError` or a transport error when the request or the provider failed
    @MainActor
    static func search(query: String, source: ImageSearchSource, count: Int = 25) async throws -> [ProductResult] {
        let cacheKey = "\(source.rawValue):\(query.trimmingCharacters(in: .whitespaces).lowercased())"
        if let cached = await cache.get(cacheKey) {
            return cached
        }

        let manager = SupabaseManager.shared
        let baseURL = manager.supabaseURL.absoluteString

        guard var components = URLComponents(string: "\(baseURL)/functions/v1/search-products") else {
            throw ProductSearchError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "num", value: String(count)),
            URLQueryItem(name: "sources", value: source.rawValue)
        ]
        guard let url = components.url else { throw ProductSearchError.invalidURL }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(await manager.edgeFunctionToken())", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ProductSearchError.http(-1)
        }
        guard (200...299).contains(httpResponse.statusCode) else {
            throw ProductSearchError.http(httpResponse.statusCode)
        }

        let decoded = try JSONDecoder().decode(SearchResponse.self, from: data)
        if decoded.failed?.contains(source.rawValue) == true {
            throw ProductSearchError.sourceFailed
        }

        let results = decoded.groups.first { $0.source == source.rawValue }?.results ?? []
        await cache.set(cacheKey, results: results)
        return results
    }
}

private struct SearchResponse: Codable {
    let groups: [ResultGroup]
    /// Sources that errored or timed out. Absent on older edge function deployments.
    let failed: [String]?

    struct ResultGroup: Codable {
        let source: String
        let results: [ProductResult]
    }
}

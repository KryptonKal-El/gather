import Foundation

/// Search result from the Spoonacular API via edge function.
struct SpoonacularSearchResult: Codable, Identifiable {
    let id: Int
    let title: String
    let image: String
    let readyInMinutes: Int
    let servings: Int
}

/// Ingredient from recipe detail.
struct SpoonacularIngredient: Codable {
    let name: String
    let amount: Double
    let unit: String
    let original: String
}

/// Instruction step from recipe detail.
struct SpoonacularInstructionStep: Codable {
    let number: Int
    let step: String
}

/// Instruction set containing steps.
struct SpoonacularInstruction: Codable {
    let steps: [SpoonacularInstructionStep]
}

/// Full recipe detail from the Spoonacular API.
struct SpoonacularRecipeDetail: Codable {
    let id: Int
    let title: String
    let image: String
    let readyInMinutes: Int
    let servings: Int
    let sourceUrl: String
    let extendedIngredients: [SpoonacularIngredient]
    let analyzedInstructions: [SpoonacularInstruction]
}

/// Client for the search-recipes Supabase edge function.
struct RecipeSearchService {
    /// Searches for recipes online via the edge function.
    /// Returns an empty array on failure (graceful degradation).
    @MainActor
    static func searchRecipes(query: String, number: Int = 10) async -> [SpoonacularSearchResult] {
        let manager = SupabaseManager.shared
        let baseURL = manager.supabaseURL.absoluteString
        let anonKey = manager.anonKey
        
        guard var components = URLComponents(string: "\(baseURL)/functions/v1/search-recipes") else {
            return []
        }
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "number", value: String(number))
        ]
        guard let url = components.url else { return [] }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                print("[RecipeSearchService] HTTP error for query '\(query)'")
                return []
            }
            let decoded = try JSONDecoder().decode(SearchResponse.self, from: data)
            return decoded.results
        } catch {
            print("[RecipeSearchService] Search failed: \(error.localizedDescription)")
            return []
        }
    }
    
    /// Fetches full recipe details by ID via the edge function.
    /// Returns nil on failure.
    @MainActor
    static func getRecipeDetail(id: Int) async -> SpoonacularRecipeDetail? {
        let manager = SupabaseManager.shared
        let baseURL = manager.supabaseURL.absoluteString
        let anonKey = manager.anonKey
        
        guard var components = URLComponents(string: "\(baseURL)/functions/v1/search-recipes") else {
            return nil
        }
        components.queryItems = [
            URLQueryItem(name: "id", value: String(id))
        ]
        guard let url = components.url else { return nil }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                print("[RecipeSearchService] HTTP error for recipe id=\(id)")
                return nil
            }
            let decoded = try JSONDecoder().decode(SpoonacularRecipeDetail.self, from: data)
            return decoded
        } catch {
            print("[RecipeSearchService] Detail fetch failed: \(error.localizedDescription)")
            return nil
        }
    }
}

private struct SearchResponse: Codable {
    let results: [SpoonacularSearchResult]
}

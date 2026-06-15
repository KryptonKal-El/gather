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

/// A recipe parsed from freeform text by the parse-recipe edge function.
struct ParsedRecipe {
    let name: String
    let ingredients: [(quantity: String, name: String)]
    let steps: [String]
}

/// Client for the parse-recipe Supabase edge function, which uses Claude to
/// turn pasted recipe text into structured ingredients (with quantities) and
/// ordered steps. Returns nil on any failure so callers can fall back to the
/// local line parser.
struct RecipeTextParseService {
    @MainActor
    static func parse(text: String) async -> ParsedRecipe? {
        let manager = SupabaseManager.shared
        let baseURL = manager.supabaseURL.absoluteString
        let anonKey = manager.anonKey

        guard let url = URL(string: "\(baseURL)/functions/v1/parse-recipe") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(["text": text])

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200...299).contains(http.statusCode) else {
                // 503 (no API key configured) or any error -> caller falls back.
                return nil
            }
            let decoded = try JSONDecoder().decode(ParseRecipeResponse.self, from: data)
            let ingredients = (decoded.ingredients ?? [])
                .map { (quantity: $0.quantity ?? "", name: ($0.name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)) }
                .filter { !$0.name.isEmpty }
            let steps = (decoded.steps ?? [])
                .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            return ParsedRecipe(name: decoded.name ?? "", ingredients: ingredients, steps: steps)
        } catch {
            print("[RecipeTextParseService] Parse failed: \(error.localizedDescription)")
            return nil
        }
    }
}

private struct ParseRecipeResponse: Decodable {
    let name: String?
    let ingredients: [ParsedIngredient]?
    let steps: [String]?
}

private struct ParsedIngredient: Decodable {
    let quantity: String?
    let name: String?
}

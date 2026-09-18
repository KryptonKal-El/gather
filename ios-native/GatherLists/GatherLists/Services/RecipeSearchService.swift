import Foundation
import FoundationModels

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

/// A recipe parsed from freeform text by the on-device language model.
struct ParsedRecipe {
    let name: String
    let ingredients: [(quantity: String, name: String)]
    let steps: [String]
}

/// Why an on-device recipe parse produced no result.
enum RecipeParseError: Error {
    case tooLong
    case failed
}

/// Turns pasted recipe text into structured ingredients (with quantities) and
/// ordered steps using Apple's on-device language model. Nothing leaves the
/// device. Callers must hide the import option when `isAvailable` is false.
struct RecipeTextParseService {
    private static let instructions = """
        You parse pasted recipe text into structured data. The text is raw and possibly \
        messy, copied from a website, note, or message.

        Extract:
        - name: the recipe's title. Use an empty string if the text has no clear title.
        - ingredients: every ingredient, in order. Split each line into a quantity and a name. \
        The quantity is only the leading amount, size, and unit as written; the name is \
        everything after it, including preparation notes. Examples: \
        "2 cups all-purpose flour" -> quantity "2 cups", name "all-purpose flour". \
        "1 large yellow onion, diced" -> quantity "1 large", name "yellow onion, diced". \
        "1 (15 oz) can black beans, drained" -> quantity "1 (15 oz) can", name "black beans, drained". \
        "6 garlic cloves, smashed" -> quantity "6", name "garlic cloves, smashed". \
        "500g baby potatoes" -> quantity "500g", name "baby potatoes". \
        "salt and pepper" -> quantity "", name "salt and pepper".
        - steps: the ordered instructions, one entry per step. Strip leading numbers and \
        bullets. Combine wrapped lines that belong to the same step.

        Rules:
        - Only use information present in the text. Never invent ingredients, steps, or amounts.
        - Drop section headers like "Ingredients", "Directions", "For the sauce:" from the \
        lists, but if a header gives important context (e.g. "For the topping"), you may \
        prefix the relevant ingredient names with it in parentheses.
        - Ignore anything that is not part of the recipe, such as stories, ads, and comments.
        - Preserve the original order.
        """

    /// Whether the on-device model can run right now: a supported device, with
    /// Apple Intelligence turned on and its model downloaded.
    static var isAvailable: Bool {
        guard #available(iOS 26.0, *) else { return false }
        return SystemLanguageModel.default.isAvailable
    }

    /// Parses `text` on-device. Throws `RecipeParseError.tooLong` when the text
    /// can't fit the model's context window, `.failed` for anything else.
    static func parse(text: String) async throws -> ParsedRecipe {
        guard #available(iOS 26.0, *) else { throw RecipeParseError.failed }

        let model = SystemLanguageModel.default
        guard model.isAvailable else { throw RecipeParseError.failed }

        if #available(iOS 26.4, *), try await exceedsContext(text, model: model) {
            throw RecipeParseError.tooLong
        }

        do {
            let session = LanguageModelSession(model: model, instructions: instructions)
            let response = try await session.respond(
                to: text,
                generating: GeneratedRecipe.self,
                options: GenerationOptions(samplingMode: .greedy)
            )
            let recipe = response.content
            let ingredients = recipe.ingredients
                .map { (quantity: $0.quantity.trimmed, name: $0.name.trimmed) }
                .filter { !$0.name.isEmpty }
            let steps = recipe.steps.map(\.trimmed).filter { !$0.isEmpty }
            guard !(ingredients.isEmpty && steps.isEmpty) else { throw RecipeParseError.failed }
            return ParsedRecipe(name: recipe.name.trimmed, ingredients: ingredients, steps: steps)
        } catch let error as RecipeParseError {
            throw error
        } catch {
            print("[RecipeTextParseService] Parse failed: \(error.localizedDescription)")
            throw isContextOverflow(error) ? RecipeParseError.tooLong : RecipeParseError.failed
        }
    }

    @available(iOS 26.4, *)
    private static func exceedsContext(_ text: String, model: SystemLanguageModel) async throws -> Bool {
        do {
            let fixed = try await model.tokenCount(for: Instructions(instructions))
                + model.tokenCount(for: GeneratedRecipe.generationSchema)
            // The response restates nearly all of the input, so the input is budgeted twice.
            return try await fixed + model.tokenCount(for: text) * 2 > model.contextSize
        } catch {
            print("[RecipeTextParseService] Token count failed: \(error.localizedDescription)")
            return false
        }
    }

    @available(iOS 26.0, *)
    private static func isContextOverflow(_ error: Error) -> Bool {
        if #available(iOS 27.0, *), case LanguageModelError.contextSizeExceeded = error {
            return true
        }
        if case LanguageModelSession.GenerationError.exceededContextWindowSize = error {
            return true
        }
        return false
    }
}

@available(iOS 26.0, *)
@Generable
private struct GeneratedRecipe {
    @Guide(description: "The recipe's title, or an empty string if the text has no clear title.")
    let name: String
    @Guide(description: "Every ingredient, in the original order.")
    let ingredients: [GeneratedIngredient]
    @Guide(description: "The ordered instructions, one entry per step.")
    let steps: [String]
}

@available(iOS 26.0, *)
@Generable
private struct GeneratedIngredient {
    @Guide(description: "Only the leading amount, size, and unit, e.g. '2 cups' or '1 (15 oz) can'. Never the ingredient itself. Empty string if none.")
    let quantity: String
    @Guide(description: "The ingredient and any preparation notes, without the quantity, e.g. 'yellow onion, diced'.")
    let name: String
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

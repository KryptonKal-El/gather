import Foundation
import CryptoKit
import FoundationModels

/// Classifies a recipe into the planner's attribute vocabulary with Apple's on-device
/// language model. Nothing leaves the device. Only classification of text the user already
/// has — it never invents recipes or ingredients.
struct RecipeTaggingService {
    /// Bump when the prompt or vocabulary changes so existing auto tags are refreshed.
    private static let version = "v1"
    private static let maxInputCharacters = 2400

    private static let instructions = """
        You classify a home-cooking recipe for a weekly meal planner. Read the recipe's \
        name, description, ingredients and steps, then choose the best value for each field \
        from the allowed options. Judge from the recipe itself:
        - course: 'main' for a dish that can be a meal on its own; 'side' for accompaniments \
        like rice or salad; 'component' for sauces, dressings, doughs, stocks and other \
        building blocks; plus 'dessert', 'snack', 'drink'.
        - suitsBreakfast / suitsLunch / suitsDinner: which meals a household would \
        normally eat it for. A main dish usually suits lunch and/or dinner; pancakes and eggs \
        suit breakfast. Components and drinks suit none.
        - protein: the main protein source. Use 'none' when there is no notable protein.
        - cuisine: the closest cuisine, or 'other'.
        - effort: 'quick' if it can be on the table in about 30 minutes, 'project' if it takes \
        over an hour of work or long waiting (rising, marinating, slow cooking), else 'medium'.
        - method: the main cooking method.
        - kidFriendly: true unless it is very spicy, bitter, or unusual for children.
        - perishables: up to 4 fresh ingredients that spoil within about a week (herbs, leafy \
        greens, fresh fish, soft cheese), as short lowercase names. Skip pantry staples.
        """

    static var isAvailable: Bool {
        RecipeTextParseService.isAvailable
    }

    /// Fingerprint of the recipe text that tagging reads, so edits trigger a re-tag.
    static func sourceHash(name: String, description: String?, ingredients: [String]) -> String {
        let text = ([version, name, description ?? ""] + ingredients)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .joined(separator: "\n")
        return SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// Classifies the recipe and merges the result into `existing`, never touching fields
    /// listed in `manualFields`. Returns nil when the model is unavailable or fails.
    static func tag(
        recipeId: UUID,
        name: String,
        description: String?,
        ingredients: [String],
        steps: [String],
        existing: RecipeAttributes?
    ) async -> RecipeAttributes? {
        guard #available(iOS 26.0, *), isAvailable else { return nil }

        var prompt = "Recipe: \(name)\n"
        if let description, !description.isEmpty { prompt += "Description: \(description)\n" }
        prompt += "Ingredients:\n" + ingredients.map { "- \($0)" }.joined(separator: "\n")
        if !steps.isEmpty {
            prompt += "\nSteps:\n" + steps.prefix(6).enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
        }
        if prompt.count > maxInputCharacters {
            prompt = String(prompt.prefix(maxInputCharacters))
        }

        do {
            let session = LanguageModelSession(model: .default, instructions: instructions)
            let response = try await session.respond(
                to: prompt,
                generating: GeneratedRecipeTags.self,
                options: GenerationOptions(samplingMode: .greedy)
            )
            let hash = sourceHash(name: name, description: description, ingredients: ingredients)
            return merge(response.content, into: existing ?? RecipeAttributes(recipeId: recipeId), hash: hash)
        } catch {
            print("[RecipeTaggingService] Tagging failed for \(name): \(error.localizedDescription)")
            return nil
        }
    }

    @available(iOS 26.0, *)
    private static func merge(_ tags: GeneratedRecipeTags, into existing: RecipeAttributes, hash: String) -> RecipeAttributes {
        var result = existing
        if !existing.isManual(.course) { result.course = RecipeCourse(rawValue: tags.course)?.rawValue }
        if !existing.isManual(.mealTypes) {
            result.mealTypes = [
                tags.suitsBreakfast ? MealType.breakfast : nil,
                tags.suitsLunch ? MealType.lunch : nil,
                tags.suitsDinner ? MealType.dinner : nil,
            ].compactMap { $0?.rawValue }
        }
        if !existing.isManual(.protein) { result.protein = RecipeProtein(rawValue: tags.protein)?.rawValue }
        if !existing.isManual(.cuisine) { result.cuisine = RecipeCuisine(rawValue: tags.cuisine)?.rawValue }
        if !existing.isManual(.effort) { result.effort = RecipeEffort(rawValue: tags.effort)?.rawValue }
        if !existing.isManual(.method) { result.method = RecipeMethod(rawValue: tags.method)?.rawValue }
        if !existing.isManual(.kidFriendly) { result.kidFriendly = tags.kidFriendly }
        result.perishables = Array(
            tags.perishables
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
                .filter { !$0.isEmpty }
                .prefix(4)
        )
        result.autoSourceHash = hash
        result.autoTaggedAt = Date()
        return result
    }
}

@available(iOS 26.0, *)
@Generable
private struct GeneratedRecipeTags {
    @Guide(description: "What kind of dish this is.", .anyOf(RecipeCourse.allCases.map(\.rawValue)))
    let course: String
    @Guide(description: "Would a household eat this for breakfast?")
    let suitsBreakfast: Bool
    @Guide(description: "Would a household eat this for lunch?")
    let suitsLunch: Bool
    @Guide(description: "Would a household eat this for dinner?")
    let suitsDinner: Bool
    @Guide(description: "The main protein source.", .anyOf(RecipeProtein.allCases.map(\.rawValue)))
    let protein: String
    @Guide(description: "The closest cuisine.", .anyOf(RecipeCuisine.allCases.map(\.rawValue)))
    let cuisine: String
    @Guide(description: "How much time and work it takes.", .anyOf(RecipeEffort.allCases.map(\.rawValue)))
    let effort: String
    @Guide(description: "The main cooking method.", .anyOf(RecipeMethod.allCases.map(\.rawValue)))
    let method: String
    @Guide(description: "Whether most children would eat it.")
    let kidFriendly: Bool
    @Guide(description: "Fresh ingredients that spoil within about a week, short lowercase names.", .maximumCount(4))
    let perishables: [String]
}

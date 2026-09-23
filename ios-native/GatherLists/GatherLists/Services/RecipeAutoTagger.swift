import Foundation

/// Tags the user's recipes in the background with the on-device model: recipes with no
/// attributes yet, and recipes whose text changed since they were last tagged. Runs one
/// recipe at a time, a bounded batch per pass, and does nothing where the model is unavailable.
@MainActor
final class RecipeAutoTagger {
    static let shared = RecipeAutoTagger()

    private static let batchLimit = 25

    private var isRunning = false
    private var pendingRun: (recipes: [Recipe], userId: UUID)?

    private init() {}

    /// Starts a pass over `recipes` (those the user can edit). If a pass is already running,
    /// the latest request runs once it finishes.
    func run(recipes: [Recipe], userId: UUID) {
        guard RecipeTaggingService.isAvailable, !recipes.isEmpty else { return }
        if isRunning {
            pendingRun = (recipes, userId)
            return
        }
        isRunning = true
        Task(priority: .background) {
            await tagPass(recipes: recipes, userId: userId)
            isRunning = false
            if let next = pendingRun {
                pendingRun = nil
                run(recipes: next.recipes, userId: next.userId)
            }
        }
    }

    private func tagPass(recipes: [Recipe], userId: UUID) async {
        do {
            let existing = try await RecipeAttributeService.fetchAll()
            let attributesById = Dictionary(existing.map { ($0.recipeId, $0) }, uniquingKeysWith: { first, _ in first })

            // One query for every recipe's ingredients; fingerprints are compared locally so
            // only new or edited recipes cost a detail fetch and a model call.
            let ingredients = try await RecipeService.fetchIngredients(recipeIds: recipes.map(\.id))
            let ingredientsByRecipe = Dictionary(grouping: ingredients, by: \.recipeId)

            var tagged = 0
            for recipe in recipes.sorted(by: { $0.updatedAt > $1.updatedAt }) where tagged < Self.batchLimit {
                if Task.isCancelled { return }
                let ingredientNames = (ingredientsByRecipe[recipe.id] ?? [])
                    .sorted { $0.sortOrder < $1.sortOrder }
                    .map(\.name)
                guard !ingredientNames.isEmpty else { continue }

                let current = attributesById[recipe.id]
                let hash = RecipeTaggingService.sourceHash(
                    name: recipe.name,
                    description: recipe.description,
                    ingredients: ingredientNames
                )
                if current?.autoSourceHash == hash { continue }

                let steps = (try? await RecipeService.fetchRecipeDetail(recipeId: recipe.id).steps.map(\.instruction)) ?? []
                guard let result = await RecipeTaggingService.tag(
                    recipeId: recipe.id,
                    name: recipe.name,
                    description: recipe.description,
                    ingredients: ingredientNames,
                    steps: steps,
                    existing: current
                ) else { continue }

                try await RecipeAttributeService.upsert(result, userId: userId)
                tagged += 1
            }
            if tagged > 0 {
                print("[RecipeAutoTagger] Tagged \(tagged) recipe(s)")
            }
        } catch {
            print("[RecipeAutoTagger] Pass failed: \(error.localizedDescription)")
        }
    }
}

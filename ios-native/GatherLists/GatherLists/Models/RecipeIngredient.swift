import Foundation

/// An ingredient belonging to a recipe, mapped to the `recipe_ingredients` Supabase table.
struct RecipeIngredient: Codable, Identifiable, Hashable {
    let id: UUID
    let recipeId: UUID
    let name: String
    let quantity: String?
    let sortOrder: Int
    
    enum CodingKeys: String, CodingKey {
        case id
        case recipeId = "recipe_id"
        case name
        case quantity
        case sortOrder = "sort_order"
    }
}

// MARK: - Ingredients mentioned in a step

/// Matches a cooking step's text to the ingredients it mentions, so cook mode
/// can show their amounts under the step. Mirrors `ingredientsForStep` in the
/// web app (src/utils/stepIngredients.js) — keep the two in sync.
extension Array where Element == RecipeIngredient {
    /// Preparation and size words that describe an ingredient without naming it,
    /// so "large eggs, beaten" still matches a step that says "eggs".
    private static let descriptorWords: Set<String> = [
        "to", "taste", "optional", "divided", "plus", "more", "extra", "for", "serving",
        "large", "medium", "small", "whole", "fresh", "freshly", "chopped", "minced",
        "sliced", "diced", "grated", "shredded", "softened", "melted", "packed",
        "finely", "roughly", "thinly", "beaten", "peeled", "cubed", "crushed", "room",
        "temperature", "cold", "warm", "hot", "about"
    ]

    private static let minHeadLength = 3

    /// The ingredients `instruction` mentions, in ingredient-list order. An
    /// ingredient matches when its whole name appears in the step, or when its
    /// last word does (so "all-purpose flour" matches "add the flour") — unless
    /// another ingredient ends in the same word, where only the full name counts
    /// ("brown sugar" vs "white sugar").
    func mentioned(in instruction: String) -> [RecipeIngredient] {
        let stepTokens = Self.tokenize(instruction)
        let stepText = " \(stepTokens.joined(separator: " ")) "
        let stepWords = Set(stepTokens)

        let variantsByIndex = map { Self.nameVariants($0.name) }
        var headCounts: [String: Int] = [:]
        for variants in variantsByIndex {
            for head in Set(variants.compactMap(\.last)) {
                headCounts[head, default: 0] += 1
            }
        }

        return enumerated().compactMap { index, ingredient in
            let isMentioned = variantsByIndex[index].contains { tokens in
                if stepText.contains(" \(tokens.joined(separator: " ")) ") { return true }
                guard let head = tokens.last else { return false }
                return head.count >= Self.minHeadLength && headCounts[head] == 1 && stepWords.contains(head)
            }
            return isMentioned ? ingredient : nil
        }
    }

    /// Reduces a word to a rough singular form. Both the step and the ingredient
    /// go through this, so it only needs to be consistent, not grammatical.
    private static func singularize(_ word: String) -> String {
        guard word.count > 3 else { return word }
        if word.hasSuffix("ies") { return String(word.dropLast(3)) + "y" }
        if ["oes", "ches", "shes", "sses", "xes", "zes"].contains(where: word.hasSuffix) {
            return String(word.dropLast(2))
        }
        if word.hasSuffix("ss") { return word }
        if word.hasSuffix("s") { return String(word.dropLast()) }
        return word
    }

    /// Lowercases, keeps only a–z words, and singularizes each.
    private static func tokenize(_ text: String) -> [String] {
        text.lowercased()
            .split { !("a"..."z").contains($0) }
            .map { singularize(String($0)) }
    }

    /// The name variants to look for: the part before any comma or parenthesis,
    /// split on "and"/"or"/"&"/"/" so "salt and pepper" matches a step naming either.
    private static func nameVariants(_ name: String) -> [[String]] {
        let withoutParens = name.replacingOccurrences(of: #"\(.*?\)"#, with: " ", options: .regularExpression)
        let beforeComma = withoutParens.split(separator: ",", omittingEmptySubsequences: false).first.map(String.init) ?? ""
        return beforeComma
            .replacingOccurrences(of: #"\s+(and|or)\s+|&|/"#, with: "|", options: [.regularExpression, .caseInsensitive])
            .split(separator: "|")
            .map { tokenize(String($0)).filter { !descriptorWords.contains($0) } }
            .filter { !$0.isEmpty }
    }
}

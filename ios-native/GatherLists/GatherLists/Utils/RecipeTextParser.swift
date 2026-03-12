import Foundation

/// Parses recipe text into structured ingredient data.
/// Port of the React parseRecipeText and stripQuantity functions.
struct RecipeTextParser {
    
    /// Common cooking measurement units to strip from ingredient names.
    private static let units = [
        "cups?", "cup", "tbsp", "tablespoons?", "tsp", "teaspoons?",
        "oz", "ounces?", "lbs?", "pounds?", "grams?", "kg",
        "ml", "liters?", "quarts?", "pints?", "gallons?",
        "cloves?", "slices?", "pieces?", "cans?", "packages?",
        "bunches?", "heads?", "stalks?", "sprigs?", "pinch(?:es)?",
        "dash(?:es)?", "handful(?:s)?"
    ]
    
    /// Regex pattern to match leading numbers/fractions + unit words + optional "of"
    private static var unitPattern: NSRegularExpression? = {
        let pattern = "^[\\d./\\s-]+(?:\(units.joined(separator: "|")))\\s+(?:of\\s+)?"
        return try? NSRegularExpression(pattern: pattern, options: .caseInsensitive)
    }()
    
    /// Strips quantity and unit prefix from an ingredient line.
    /// - Parameter line: A single ingredient line like "2 cups flour"
    /// - Returns: The ingredient name without quantity/unit, like "flour"
    static func stripQuantity(_ line: String) -> String {
        var cleaned = line
        
        // Remove parenthetical notes: "(15 oz)" -> ""
        cleaned = cleaned.replacingOccurrences(
            of: "\\(.*?\\)",
            with: "",
            options: .regularExpression
        )
        
        // Remove everything after comma (prep instructions): "garlic, minced" -> "garlic"
        if let commaIndex = cleaned.firstIndex(of: ",") {
            cleaned = String(cleaned[..<commaIndex])
        }
        
        cleaned = cleaned.trimmingCharacters(in: .whitespaces)
        
        // Remove leading numbers and fractions: "2 1/2" -> ""
        cleaned = cleaned.replacingOccurrences(
            of: "^[\\d./\\s-]+",
            with: "",
            options: .regularExpression
        ).trimmingCharacters(in: .whitespaces)
        
        // Remove unit words
        if let pattern = unitPattern {
            let range = NSRange(cleaned.startIndex..., in: cleaned)
            cleaned = pattern.stringByReplacingMatches(
                in: cleaned,
                options: [],
                range: range,
                withTemplate: ""
            ).trimmingCharacters(in: .whitespaces)
        }
        
        // If stripping removed everything, fall back to original minus leading numbers
        if cleaned.isEmpty {
            cleaned = line.replacingOccurrences(
                of: "^[\\d./\\s-]+",
                with: "",
                options: .regularExpression
            ).trimmingCharacters(in: .whitespaces)
        }
        
        return cleaned
    }
    
    /// Parses raw recipe text into structured ingredient items.
    /// Handles various formats:
    /// - "2 cups flour"
    /// - "- 1 lb ground beef"
    /// - "3 cloves garlic, minced"
    /// - Parameters:
    ///   - text: Raw recipe text with one ingredient per line
    ///   - listType: The list type for auto-categorization (e.g., 'grocery', 'packing')
    /// - Returns: Array of tuples with (name, category) for each parsed ingredient
    static func parseRecipeText(_ text: String, listType: String? = nil) -> [(name: String, category: String)] {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return []
        }
        
        let bulletPattern = try? NSRegularExpression(pattern: "^[-*•]\\s*", options: [])
        let sectionHeaderPattern = try? NSRegularExpression(
            pattern: "^(instructions|directions|steps|method)",
            options: .caseInsensitive
        )
        
        let lines = text.components(separatedBy: .newlines)
            .map { line -> String in
                var cleaned = line
                if let pattern = bulletPattern {
                    let range = NSRange(cleaned.startIndex..., in: cleaned)
                    cleaned = pattern.stringByReplacingMatches(
                        in: cleaned,
                        options: [],
                        range: range,
                        withTemplate: ""
                    )
                }
                return cleaned.trimmingCharacters(in: .whitespaces)
            }
            .filter { line in
                guard !line.isEmpty else { return false }
                if let pattern = sectionHeaderPattern {
                    let range = NSRange(line.startIndex..., in: line)
                    return pattern.firstMatch(in: line, options: [], range: range) == nil
                }
                return true
            }
        
        var items: [(name: String, category: String)] = []
        var seen = Set<String>()
        
        for line in lines {
            let name = stripQuantity(line)
            let key = name.lowercased()
            
            // Skip names shorter than 2 characters or duplicates
            guard key.count >= 2, !seen.contains(key) else {
                continue
            }
            
            seen.insert(key)
            
            // Capitalize first letter
            let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
            let category = CategoryDefinitions.categorizeItem(name, listType: listType)
            
            items.append((name: capitalizedName, category: category))
        }
        
        return items
    }
}

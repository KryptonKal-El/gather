import Foundation

/// AI suggestion engine that recommends items based on shopping history, frequently purchased items, and common pairings.
enum SuggestionEngine {
    
    private static let itemPairings: [(String, String)] = [
        ("bread", "butter"),
        ("pasta", "tomato sauce"),
        ("chips", "salsa"),
        ("hamburger buns", "ground beef"),
        ("hot dog buns", "hot dogs"),
        ("cereal", "milk"),
        ("peanut butter", "jelly"),
        ("eggs", "bacon"),
        ("lettuce", "tomatoes"),
        ("tortillas", "cheese"),
        ("rice", "beans"),
        ("spaghetti", "parmesan"),
        ("coffee", "cream"),
        ("crackers", "cheese"),
        ("avocado", "lime"),
        ("chicken", "rice"),
        ("salmon", "lemon"),
        ("steak", "potatoes")
    ]
    
    /// Generates suggestions based on history and current list items.
    /// - Parameters:
    ///   - history: Past shopping history entries
    ///   - currentItems: Items currently in the list
    ///   - maxSuggestions: Maximum number of suggestions to return (default 8)
    /// - Returns: Array of item suggestions
    static func getSuggestions(
        history: [HistoryEntry],
        currentItems: [Item],
        maxSuggestions: Int = 8
    ) -> [ItemSuggestion] {
        let currentNames = Set(currentItems.map { $0.name.lowercased() })
        var suggestions: [ItemSuggestion] = []
        var seen = Set<String>()
        
        func addSuggestion(name: String, reason: String) {
            let key = name.lowercased()
            guard !currentNames.contains(key), !seen.contains(key) else { return }
            seen.insert(key)
            suggestions.append(ItemSuggestion(
                name: name,
                reason: reason,
                category: CategoryDefinitions.categorizeItem(name)
            ))
        }
        
        // 1. Pairing-based suggestions
        for (a, b) in itemPairings {
            if currentNames.contains(a) && !currentNames.contains(b) {
                addSuggestion(name: b, reason: "Often bought together")
            }
            if currentNames.contains(b) && !currentNames.contains(a) {
                addSuggestion(name: a, reason: "Often bought together")
            }
        }
        
        // 2. Frequency-based suggestions (top 20 by count, min 2)
        var freq: [String: Int] = [:]
        for entry in history {
            let key = entry.name.lowercased()
            freq[key, default: 0] += 1
        }
        let sorted = freq.sorted { $0.value > $1.value }.prefix(20)
        for (name, count) in sorted where count >= 2 {
            addSuggestion(name: name, reason: "Purchased \(count) times before")
        }
        
        // 3. Recency-based suggestions (last 30, reverse, deduplicate)
        let recentEntries = history.suffix(30).reversed()
        var seenRecent = Set<String>()
        for entry in recentEntries {
            let key = entry.name.lowercased()
            guard !seenRecent.contains(key) else { continue }
            seenRecent.insert(key)
            addSuggestion(name: entry.name, reason: "Recently purchased")
        }
        
        return Array(suggestions.prefix(maxSuggestions))
    }
}

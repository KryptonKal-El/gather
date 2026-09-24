import Foundation

/// "Plan my week" suggestion engine. A rule-for-rule port of `src/utils/mealPlanner.js`
/// (which has the unit tests); keep the two in step.
///
/// Variety comes from a per-recipe rest period scaled to how often it's usually made, weekly
/// caps on the same protein / cuisine, one "something new" slot, resurfacing long-forgotten
/// favourites, quick meals on weeknights, nudging recipes that share fresh ingredients onto
/// nearby days, and a little randomness between equal candidates.
enum MealPlanner {
    struct Slot: Hashable {
        let date: String
        let meal: MealType
        var key: String { "\(date)|\(meal.rawValue)" }
    }

    struct Filled {
        let date: String
        let meal: MealType
        let recipeId: UUID?
    }

    struct Suggestion {
        let date: String
        let meal: MealType
        let recipeId: UUID
        let reason: String
    }

    struct Input {
        var slots: [Slot]
        var filled: [Filled]
        var recipes: [Recipe]
        var attributes: [UUID: RecipeAttributes]
        /// Date keys of completed cooks per recipe.
        var cookDates: [UUID: [String]]
        /// Latest date key each recipe was planned before this week.
        var lastPlanned: [UUID: String]
        /// Recipe ids not to suggest per slot key (swaps / regenerate).
        var excluded: [String: Set<UUID>] = [:]
        var random: () -> Double = { Double.random(in: 0..<1) }
    }

    struct Result {
        let suggestions: [Suggestion]
        let libraryNote: String?
    }

    private static let defaultGapDays = 21.0
    private static let weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    private struct Profile {
        let recipe: Recipe
        let attrs: RecipeAttributes?
        let gap: Double
        let cookCount: Int
        let lastSeen: String?
        let isNew: Bool
    }

    private struct Reason {
        let weight: Double
        let text: String
    }

    // MARK: - Date helpers

    private static let utcCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }()

    private static func dayNumber(_ key: String) -> Int {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let date = utcCalendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
        else { return 0 }
        return Int((date.timeIntervalSince1970 / 86_400).rounded())
    }

    /// Whole days from date key `a` to date key `b`.
    static func daysBetween(_ a: String, _ b: String) -> Int {
        dayNumber(b) - dayNumber(a)
    }

    /// Monday = 0 … Sunday = 6.
    static func weekdayIndex(_ key: String) -> Int {
        // 1970-01-01 was a Thursday (index 3).
        ((dayNumber(key) + 3) % 7 + 7) % 7
    }

    /// Median days between cooks once made twice, clamped to 7…90; three weeks before that.
    static func typicalGapDays(_ cookKeys: [String]) -> Double {
        guard cookKeys.count >= 2 else { return defaultGapDays }
        let sorted = cookKeys.sorted()
        let gaps = zip(sorted, sorted.dropFirst()).map { daysBetween($0, $1) }.filter { $0 > 0 }.sorted()
        guard !gaps.isEmpty else { return defaultGapDays }
        let mid = gaps.count / 2
        let median = gaps.count % 2 == 1 ? Double(gaps[mid]) : Double(gaps[mid - 1] + gaps[mid]) / 2
        return min(90, max(7, median))
    }

    private static func isEligible(_ attrs: RecipeAttributes?, for meal: MealType) -> Bool {
        if let attrs {
            let course = attrs.course
            let isMain = course == nil || course == RecipeCourse.main.rawValue
            if !isMain && !(meal == .breakfast && course == RecipeCourse.snack.rawValue) { return false }
            if !attrs.mealTypes.isEmpty { return attrs.mealTypes.contains(meal.rawValue) }
        }
        return meal != .breakfast
    }

    private static func weeksText(_ days: Int) -> String {
        let weeks = Int((Double(days) / 7).rounded())
        return weeks <= 1 ? "over a week" : "\(weeks) weeks"
    }

    // MARK: - Planning

    static func planWeek(_ input: Input) -> Result {
        var chosen: [Filled] = input.filled.filter { $0.recipeId != nil }
        var suggestions: [Suggestion] = []
        var usedFallback = false

        var profiles: [UUID: Profile] = [:]
        for recipe in input.recipes {
            let cooks = input.cookDates[recipe.id] ?? []
            let lastCook = recipe.lastCookedAt.map { MealPlanWeek.key(for: $0) } ?? cooks.max()
            let planned = input.lastPlanned[recipe.id]
            let lastSeen = [lastCook, planned].compactMap { $0 }.max()
            profiles[recipe.id] = Profile(
                recipe: recipe,
                attrs: input.attributes[recipe.id],
                gap: typicalGapDays(cooks),
                cookCount: recipe.cookCount ?? cooks.count,
                lastSeen: lastSeen,
                isNew: lastCook == nil && planned == nil && (recipe.cookCount ?? 0) == 0
            )
        }
        // Stable iteration order, matching the JS Map insertion order (recipes array order).
        let ordered = input.recipes.compactMap { profiles[$0.id] }

        // A single-slot swap never claims the week's "something new" slot.
        let exploreSlot = input.slots.count < 2 ? nil
            : input.slots.first { $0.meal == .dinner && weekdayIndex($0.date) >= 2 }
                ?? input.slots.first { $0.meal == .dinner }

        func score(_ p: Profile, _ slot: Slot, relaxed: Bool) -> (score: Double, reason: String)? {
            let attrs = p.attrs
            guard isEligible(attrs, for: slot.meal) else { return nil }
            if input.excluded[slot.key]?.contains(p.recipe.id) == true { return nil }

            let weekChosen = chosen.compactMap { c -> (Filled, Profile)? in
                guard let id = c.recipeId, let profile = profiles[id] else { return nil }
                return (c, profile)
            }
            let alreadyThisWeek = weekChosen.contains { $0.0.recipeId == p.recipe.id }
            let sameDay = weekChosen.contains { $0.0.recipeId == p.recipe.id && $0.0.date == slot.date }
            if sameDay || (alreadyThisWeek && !relaxed) { return nil }

            let daysSince = p.lastSeen.map { daysBetween($0, slot.date) }
            if let daysSince, Double(daysSince) < 0.6 * p.gap, !relaxed { return nil }

            let protein = attrs?.protein
            let cuisine = attrs?.cuisine
            let proteinCount = (protein != nil && protein != RecipeProtein.none.rawValue)
                ? weekChosen.filter { $0.1.attrs?.protein == protein }.count : 0
            let cuisineCount = (cuisine != nil && cuisine != RecipeCuisine.other.rawValue)
                ? weekChosen.filter { $0.1.attrs?.cuisine == cuisine }.count : 0
            if !relaxed && (proteinCount >= 2 || cuisineCount >= 3) { return nil }

            var value = attrs?.mealTypes.contains(slot.meal.rawValue) == true ? 1.0 : 0.7
            var reasons: [Reason] = []

            value *= daysSince.map { min(1, Double($0) / p.gap) } ?? 1
            value *= 1 + 0.25 * log1p(Double(p.cookCount))

            if p.cookCount >= 2, let daysSince, Double(daysSince) >= 2 * p.gap {
                value *= 1.35
                reasons.append(Reason(weight: 3, text: "Haven't made this in \(weeksText(daysSince))"))
            }

            if p.isNew {
                let isExplore = exploreSlot == slot
                value *= isExplore ? 2.5 : 0.85
                if isExplore { reasons.append(Reason(weight: 4, text: "Something new to try")) }
            }

            value *= pow(0.6, Double(proteinCount))
            value *= pow(0.75, Double(cuisineCount))

            let weekday = weekdayIndex(slot.date)
            let isWeeknight = weekday <= 3 && slot.meal != .breakfast
            if attrs?.effort == RecipeEffort.project.rawValue {
                value *= isWeeknight ? 0.4 : (weekday >= 5 ? 1.1 : 1)
            }
            if attrs?.effort == RecipeEffort.quick.rawValue && isWeeknight {
                value *= 1.15
                reasons.append(Reason(weight: 1, text: "Quick for a weeknight"))
            }

            if let method = attrs?.method {
                let adjacentSameMethod = weekChosen.contains {
                    $0.0.meal == slot.meal && abs(daysBetween($0.0.date, slot.date)) == 1 && $0.1.attrs?.method == method
                }
                if adjacentSameMethod { value *= 0.85 }
            }

            let fresh = attrs?.perishables ?? []
            if !fresh.isEmpty {
                var shared: [(item: String, date: String)] = []
                for (c, profile) in weekChosen {
                    let distance = daysBetween(c.date, slot.date)
                    guard distance >= 0, distance <= 3 else { continue }
                    for item in profile.attrs?.perishables ?? [] where fresh.contains(item) && !shared.contains(where: { $0.item == item }) {
                        shared.append((item, c.date))
                    }
                }
                if let first = shared.first {
                    value *= 1 + 0.15 * Double(min(shared.count, 2))
                    reasons.append(Reason(weight: 2, text: "Uses the rest of \(weekdayNames[weekdayIndex(first.date)])'s \(first.item)"))
                }
            }

            if p.cookCount >= 3 { reasons.append(Reason(weight: 0.5, text: "A regular — made \(p.cookCount) times")) }
            if let daysSince, daysSince >= 14 { reasons.append(Reason(weight: 0.25, text: "Last made \(weeksText(daysSince)) ago")) }

            if relaxed { value *= 0.3 }
            value *= 0.85 + 0.3 * input.random()

            let reason = reasons.max { $0.weight < $1.weight }?.text ?? "Good for \(slot.meal.rawValue)"
            return (value, reason)
        }

        for slot in input.slots {
            var best: (score: Double, reason: String, recipeId: UUID)?
            for relaxed in [false, true] {
                for p in ordered {
                    if let result = score(p, slot, relaxed: relaxed), result.score > (best?.score ?? -1) {
                        best = (result.score, result.reason, p.recipe.id)
                    }
                }
                if best != nil {
                    if relaxed { usedFallback = true }
                    break
                }
            }
            guard let best else { continue }
            suggestions.append(Suggestion(date: slot.date, meal: slot.meal, recipeId: best.recipeId, reason: best.reason))
            chosen.append(Filled(date: slot.date, meal: slot.meal, recipeId: best.recipeId))
        }

        let library = ordered.filter { isEligible($0.attrs, for: .dinner) }.count
        var note: String?
        if library == 0 {
            note = "Add a few recipes to get suggestions."
        } else if usedFallback || library < 8 {
            let weeks = max(1, library / 5)
            note = "You have \(library) \(library == 1 ? "recipe" : "recipes") for main meals — enough for about \(weeks) week\(library >= 10 ? "s" : "") without repeats. Add more and the plan will repeat less."
        }
        return Result(suggestions: suggestions, libraryNote: note)
    }
}

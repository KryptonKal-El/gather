import Foundation
import FoundationModels

/// What the household said about their week, as planner settings. Every item can be switched
/// off by the person before planning.
struct WeekBrief: Equatable {
    enum SlotPlan: String, CaseIterable {
        case quick
        case eatingOut = "eating_out"
        case leftovers
        case skip

        var label: String {
            switch self {
            case .quick: return "something quick"
            case .eatingOut: return "eating out"
            case .leftovers: return "leftovers"
            case .skip: return "skip"
            }
        }
    }

    struct DayNote: Equatable, Identifiable {
        /// Monday = 0 … Sunday = 6.
        let weekday: Int
        /// Nil means every meal that day.
        let meal: MealType?
        let plan: SlotPlan
        var isOn = true

        var id: String { "\(weekday)-\(meal?.rawValue ?? "all")-\(plan.rawValue)" }
    }

    struct Term: Equatable, Identifiable {
        let text: String
        var isOn = true
        var id: String { text }
    }

    var dayNotes: [DayNote] = []
    var useUp: [Term] = []
    var avoid: [Term] = []
    var cuisines: [Term] = []
    var lightWeek = false

    var isEmpty: Bool {
        dayNotes.isEmpty && useUp.isEmpty && avoid.isEmpty && cuisines.isEmpty && !lightWeek
    }
}

/// Reads a free-text note about the week ("light week, soccer Wednesday, use up the spinach")
/// into `WeekBrief` settings, and rewrites suggestion reasons in a friendlier voice — both with
/// Apple's on-device model. Nothing leaves the device. It never picks recipes itself.
struct WeekBriefService {
    static let weekdayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

    static var isAvailable: Bool {
        RecipeTextParseService.isAvailable
    }

    private static let briefInstructions = """
        You read a household's short note about their coming week and list every fact in it \
        that matters for meal planning, one fact per item. Only list what the note says.
        Kinds:
        - busy_day: a day that needs a quick meal (sports, late work, busy). Give the day.
        - eating_out: a day they eat out, get takeaway, or are away. Give the day and meal.
        - leftovers: a day they eat leftovers. Give the day and meal.
        - skip: a day no meal is needed at home. Give the day and meal.
        - use_up: an ingredient to use up, including ones they have lots of or too much of. \
        One item per ingredient; put the ingredient in text.
        - avoid: an ingredient or food to avoid. Put it in text.
        - cuisine: a cuisine they want. Put it in text.
        - light_week: they want lighter or simpler meals all week.
        Use meal 'none' when the note doesn't name breakfast, lunch or dinner; 'all' for a whole day \
        away. Use day 'none' for facts that aren't about a day.
        Example note: "Soccer Tuesday, out for lunch Thursday, use up the kale, no fish"
        Example facts: busy_day tuesday none; eating_out thursday lunch; use_up none none "kale"; \
        avoid none none "fish".
        """

    private static let reasonInstructions = """
        You rewrite the short line shown under each suggested meal in a weekly meal plan so it \
        sounds warm and personal, at most 8 words. Connect it to the household's note when the \
        facts allow, but use only the facts given for that meal. Never mention other recipes or \
        ingredients. Return exactly one line per meal, in the same order.
        Example: note "soccer Wednesday"; meal "Wednesday dinner: Air Fry Tofu — Quick for a busy day" \
        becomes "Fast and easy before soccer".
        """

    /// Reads the note into settings. Returns nil when the model is unavailable or fails.
    /// Every fact is checked against the note's own words before it's used, because a small
    /// model will sometimes add things the note never said.
    static func read(note: String) async -> WeekBrief? {
        guard #available(iOS 26.0, *), isAvailable else { return nil }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        do {
            let session = LanguageModelSession(model: .default, instructions: briefInstructions)
            let response = try await session.respond(
                to: "Note: \(trimmed.prefix(600))",
                generating: GeneratedWeekFacts.self,
                options: GenerationOptions(samplingMode: .greedy)
            )
            return ground(response.content.facts.map { ($0.kind, $0.day, $0.meal, $0.text) }, in: trimmed)
        } catch {
            print("[WeekBriefService] Reading the note failed: \(error.localizedDescription)")
            return nil
        }
    }

    /// Rewrites planner reasons for the given meals. Returns nil (keep the planner's own
    /// reasons) when the model is unavailable, fails, or doesn't return one reason per meal.
    static func friendlierReasons(note: String, meals: [(title: String, slot: String, reason: String)]) async -> [String]? {
        guard #available(iOS 26.0, *), isAvailable, !meals.isEmpty else { return nil }
        let list = meals.enumerated()
            .map { "\($0.offset + 1). \($0.element.slot): \($0.element.title) — \($0.element.reason)" }
            .joined(separator: "\n")
        let prompt = "Household note: \(note.prefix(300))\n\nMeals:\n\(list)"
        do {
            let session = LanguageModelSession(model: .default, instructions: reasonInstructions)
            let response = try await session.respond(
                to: prompt,
                generating: GeneratedReasons.self,
                options: GenerationOptions(samplingMode: .greedy)
            )
            let reasons = response.content.reasons
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            guard reasons.count == meals.count, reasons.allSatisfy({ !$0.isEmpty && $0.count <= 80 }) else { return nil }
            return reasons
        } catch {
            print("[WeekBriefService] Rewriting reasons failed: \(error.localizedDescription)")
            return nil
        }
    }

    /// Keeps only facts the note actually supports:
    /// - day facts need the day named in the note; the meal comes from the words around that day
    ///   ("lunch", "breakfast", "all day"/"away"), falling back to dinner;
    /// - ingredients and cuisines must appear in the note;
    /// - a light week needs a word like "light", "simple" or "easy".
    static func ground(_ facts: [(kind: String, day: String, meal: String, text: String)], in note: String) -> WeekBrief {
        let lowered = note.lowercased()
        let clauses = lowered
            .components(separatedBy: CharacterSet(charactersIn: ",.;!\n"))
            .flatMap { $0.components(separatedBy: " and ") }
            .map { $0.trimmingCharacters(in: .whitespaces) }

        var brief = WeekBrief()
        var seenDays = Set<String>()
        var useUp: [String] = []
        var avoid: [String] = []
        var cuisines: [String] = []

        for fact in facts {
            let text = fact.text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            switch fact.kind {
            case "busy_day", "eating_out", "leftovers", "skip":
                guard let weekday = weekdayNames.firstIndex(of: fact.day.lowercased()) else { continue }
                let dayName = weekdayNames[weekday]
                guard let clause = clauses.first(where: { $0.contains(dayName) || $0.contains(String(dayName.prefix(3)) + " ") }) else { continue }
                let plan: WeekBrief.SlotPlan
                switch fact.kind {
                case "busy_day": plan = .quick
                case "eating_out": plan = .eatingOut
                case "leftovers": plan = .leftovers
                default: plan = .skip
                }
                let meal: MealType?
                if clause.contains("breakfast") {
                    meal = .breakfast
                } else if clause.contains("lunch") {
                    meal = .lunch
                } else if clause.contains("all day") || clause.contains("whole day") || clause.contains("away") {
                    meal = plan == .quick ? .dinner : nil
                } else {
                    meal = .dinner
                }
                let item = WeekBrief.DayNote(weekday: weekday, meal: meal, plan: plan)
                if seenDays.insert(item.id).inserted { brief.dayNotes.append(item) }
            case "use_up" where !text.isEmpty && lowered.contains(text):
                useUp.append(text)
            case "avoid" where !text.isEmpty && lowered.contains(text):
                avoid.append(text)
            case "cuisine":
                if let cuisine = RecipeCuisine.allCases.first(where: { $0.label.lowercased() == text || $0.rawValue == text }),
                   lowered.contains(cuisine.label.lowercased()) {
                    cuisines.append(cuisine.label)
                }
            default:
                continue
            }
        }
        // Backstop for day facts the model missed: a clause naming a day plus an obvious phrase.
        for (weekday, dayName) in weekdayNames.enumerated() where !brief.dayNotes.contains(where: { $0.weekday == weekday }) {
            for clause in clauses where clause.contains(dayName) {
                let plan: WeekBrief.SlotPlan?
                if ["eating out", "eat out", "takeaway", "takeout", "restaurant", "dinner out", "out for"].contains(where: clause.contains) {
                    plan = .eatingOut
                } else if clause.contains("leftover") {
                    plan = .leftovers
                } else if clause.contains("away") || clause.contains("no cooking") {
                    plan = .skip
                } else if ["busy", "quick", "soccer", "practice", "late", "rush"].contains(where: clause.contains) {
                    plan = .quick
                } else {
                    plan = nil
                }
                guard let plan else { continue }
                let meal: MealType? = clause.contains("breakfast") ? .breakfast
                    : clause.contains("lunch") ? .lunch
                    : (plan == .skip && clause.contains("away")) ? nil
                    : .dinner
                let item = WeekBrief.DayNote(weekday: weekday, meal: meal, plan: plan)
                if seenDays.insert(item.id).inserted { brief.dayNotes.append(item) }
            }
        }
        brief.dayNotes.sort { $0.weekday < $1.weekday }
        brief.useUp = terms(useUp)
        brief.avoid = terms(avoid)
        brief.cuisines = terms(cuisines).map { WeekBrief.Term(text: $0.text.capitalized) }
        let clearlyLight = ["light week", "lighter", "keep it light", "keep it simple", "simple meals", "easy meals", "easy week", "low effort", "low-effort"]
            .contains { lowered.contains($0) }
        let mentionsLight = ["light", "simple", "easy"].contains { lowered.contains($0) }
        brief.lightWeek = clearlyLight || (mentionsLight && facts.contains { $0.kind == "light_week" })
        return brief
    }

    private static func terms(_ values: [String]) -> [WeekBrief.Term] {
        var seen = Set<String>()
        return values
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
            .prefix(5)
            .map { WeekBrief.Term(text: $0) }
    }
}

@available(iOS 26.0, *)
@Generable
private struct GeneratedWeekFacts {
    @Guide(description: "Every meal-planning fact in the note, one per item.", .maximumCount(12))
    let facts: [GeneratedFact]
}

@available(iOS 26.0, *)
@Generable
private struct GeneratedFact {
    @Guide(description: "What kind of fact this is.", .anyOf(["busy_day", "eating_out", "leftovers", "skip", "use_up", "avoid", "cuisine", "light_week"]))
    let kind: String
    @Guide(description: "The day it's about, or 'none'.", .anyOf(WeekBriefService.weekdayNames + ["none"]))
    let day: String
    @Guide(description: "The meal it's about, 'all' for a whole day, or 'none'.", .anyOf(["breakfast", "lunch", "dinner", "all", "none"]))
    let meal: String
    @Guide(description: "The ingredient, food or cuisine for use_up / avoid / cuisine, else an empty string.")
    let text: String
}

@available(iOS 26.0, *)
@Generable
private struct GeneratedReasons {
    @Guide(description: "One short reason per meal, in the same order as the meals.", .maximumCount(21))
    let reasons: [String]
}

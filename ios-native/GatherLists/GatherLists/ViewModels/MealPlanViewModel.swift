import Foundation
import Observation
import Supabase
import Realtime

/// State and actions for the Plan tab: the active household meal plan, the visible week's slots,
/// the recipes that can be planned, and sharing.
@Observable
@MainActor
final class MealPlanViewModel {
    var plans: [MealPlan] = []
    var activePlanId: UUID?
    var weekStart: Date = MealPlanWeek.startOfWeek(containing: Date())
    /// Visible week's slots keyed by `dateKey|meal`.
    private(set) var entriesBySlot: [String: MealPlanEntry] = [:]
    var recipes: [Recipe] = []
    private(set) var collaborators: [Profile] = []
    var isLoading = false
    var error: String?
    var isShowingCachedData = false
    var isPlanning = false
    var libraryNote: String?

    let userId: UUID
    let userEmail: String

    private static let activePlanKey = "gather.activeMealPlanId"

    /// Recipes already swapped out of each slot, so Swap keeps moving forward.
    private var swappedOut: [String: Set<UUID>] = [:]

    nonisolated(unsafe) private var channel: RealtimeChannelV2?
    nonisolated(unsafe) private var realtimeTasks: [Task<Void, Never>] = []

    // MARK: - Computed

    var activePlan: MealPlan? {
        plans.first { $0.id == activePlanId }
    }

    var isOwner: Bool {
        activePlan?.ownerId == userId
    }

    var days: [Date] {
        MealPlanWeek.days(from: weekStart)
    }

    var enabledMeals: [MealType] {
        activePlan?.enabledMealTypes ?? MealType.allCases
    }

    var isCurrentWeek: Bool {
        MealPlanWeek.startOfWeek(containing: Date()) == weekStart
    }

    var recipesById: [UUID: Recipe] {
        Dictionary(recipes.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    }

    /// Recipe slots in the visible week, in day then meal order.
    var plannedRecipeEntries: [MealPlanEntry] {
        days.flatMap { day in
            MealType.allCases.compactMap { meal in
                guard let entry = entry(for: day, meal: meal), entry.kind == .recipe, entry.recipeId != nil else { return nil }
                return entry
            }
        }
    }

    func entry(for day: Date, meal: MealType) -> MealPlanEntry? {
        entriesBySlot[Self.slotKey(MealPlanWeek.key(for: day), meal)]
    }

    private static func slotKey(_ dateKey: String, _ meal: MealType) -> String {
        "\(dateKey)|\(meal.rawValue)"
    }

    // MARK: - Init

    init(userId: UUID, userEmail: String) {
        self.userId = userId
        self.userEmail = userEmail
        Task {
            await load()
            await subscribe()
        }
    }

    deinit {
        realtimeTasks.forEach { $0.cancel() }
        let channel = channel
        Task { await channel?.unsubscribe() }
    }

    // MARK: - Loading

    private var cacheKeyPrefix: String { "mealplan-\(userId.uuidString)" }

    func load() async {
        isLoading = true
        error = nil

        if plans.isEmpty {
            let cachedPlans: CachedEntry<[MealPlan]>? = await OfflineCache.shared.load(forKey: "\(cacheKeyPrefix)-plans")
            let cachedRecipes: CachedEntry<[Recipe]>? = await OfflineCache.shared.load(forKey: "\(cacheKeyPrefix)-recipes")
            if let cachedPlans {
                plans = cachedPlans.data
                activePlanId = chooseActivePlan(from: cachedPlans.data)
            }
            if let cachedRecipes { recipes = cachedRecipes.data }
            await loadCachedWeek()
        }

        do {
            try await refreshPlans()
            async let recipesResult = MealPlanService.fetchAccessibleRecipes()
            async let weekResult: Void = refreshWeek()
            recipes = try await recipesResult
            try await weekResult
            isShowingCachedData = false
            await OfflineCache.shared.save(recipes, forKey: "\(cacheKeyPrefix)-recipes")
            await loadCollaborators()
        } catch {
            self.error = "Couldn't load your meal plan."
            isShowingCachedData = !plans.isEmpty
            print("[MealPlanViewModel] Failed to load: \(error.localizedDescription)")
        }

        isLoading = false
    }

    /// Fetches plans, creating the user's own plan when they can see none.
    private func refreshPlans() async throws {
        var fetched = try await MealPlanService.fetchPlans()
        if fetched.isEmpty {
            do {
                fetched = [try await MealPlanService.createPlan(userId: userId)]
            } catch {
                // Another device may have just created it (one owned plan per user); use theirs.
                fetched = try await MealPlanService.fetchPlans()
                if fetched.isEmpty { throw error }
            }
        }
        plans = fetched
        activePlanId = chooseActivePlan(from: fetched)
        await OfflineCache.shared.save(fetched, forKey: "\(cacheKeyPrefix)-plans")
    }

    /// Keeps the remembered plan if still visible; otherwise prefers a plan someone shared with
    /// the user (they joined a household) over their own.
    private func chooseActivePlan(from plans: [MealPlan]) -> UUID? {
        if let current = activePlanId, plans.contains(where: { $0.id == current }) {
            return current
        }
        if let stored = UserDefaults.standard.string(forKey: Self.activePlanKey).flatMap(UUID.init(uuidString:)),
           plans.contains(where: { $0.id == stored }) {
            return stored
        }
        return plans.first(where: { $0.ownerId != userId })?.id ?? plans.first?.id
    }

    private var weekCacheKey: String? {
        guard let planId = activePlanId else { return nil }
        return "\(cacheKeyPrefix)-\(planId.uuidString)-\(MealPlanWeek.key(for: weekStart))"
    }

    private func loadCachedWeek() async {
        guard let key = weekCacheKey else { return }
        let cached: CachedEntry<[MealPlanEntry]>? = await OfflineCache.shared.load(forKey: key)
        if let cached { applyEntries(cached.data) }
    }

    private func refreshWeek() async throws {
        guard let planId = activePlanId else {
            entriesBySlot = [:]
            return
        }
        let requestedWeek = weekStart
        let days = MealPlanWeek.days(from: requestedWeek)
        guard let first = days.first, let last = days.last else { return }
        let fetched = try await MealPlanService.fetchEntries(
            planId: planId,
            fromKey: MealPlanWeek.key(for: first),
            toKey: MealPlanWeek.key(for: last)
        )
        // Drop the result if the user paged to another week or plan meanwhile.
        guard requestedWeek == weekStart, planId == activePlanId else { return }
        applyEntries(fetched)
        if let key = weekCacheKey {
            await OfflineCache.shared.save(fetched, forKey: key)
        }
    }

    private func applyEntries(_ entries: [MealPlanEntry]) {
        entriesBySlot = Dictionary(
            entries.map { (Self.slotKey($0.date, $0.meal), $0) },
            uniquingKeysWith: { first, _ in first }
        )
    }

    private func loadCollaborators() async {
        guard let planId = activePlanId else { return }
        do {
            collaborators = try await MealPlanService.fetchCollaborators(planId: planId)
        } catch {
            print("[MealPlanViewModel] Failed to load collaborators: \(error.localizedDescription)")
        }
    }

    func refresh() async {
        await load()
    }

    // MARK: - Realtime

    // No row filters: filters on non-PK columns silently drop UPDATE/DELETE events
    // (see docs/memory/supabase-realtime-replica-identity.md). RLS still scopes delivery.
    private func subscribe() async {
        guard channel == nil else { return }
        let newChannel = SupabaseManager.shared.client.realtimeV2.channel("meal-plan-\(userId.uuidString)")
        channel = newChannel

        let entryChanges = newChannel.postgresChange(AnyAction.self, schema: "public", table: "meal_plan_entries")
        let planChanges = newChannel.postgresChange(AnyAction.self, schema: "public", table: "meal_plans")
        let shareChanges = newChannel.postgresChange(AnyAction.self, schema: "public", table: "meal_plan_shares")

        do {
            try await newChannel.subscribeWithError()
        } catch {
            print("[MealPlanViewModel] Subscription failed: \(error.localizedDescription)")
            return
        }

        realtimeTasks.append(Task { [weak self] in
            for await _ in entryChanges {
                try? await self?.refreshWeek()
            }
        })
        realtimeTasks.append(Task { [weak self] in
            for await _ in planChanges {
                await self?.reloadPlansAndWeek()
            }
        })
        realtimeTasks.append(Task { [weak self] in
            for await _ in shareChanges {
                await self?.reloadPlansAndWeek()
            }
        })
    }

    private func reloadPlansAndWeek() async {
        do {
            try await refreshPlans()
            try await refreshWeek()
            await loadCollaborators()
        } catch {
            print("[MealPlanViewModel] Failed to reload plans: \(error.localizedDescription)")
        }
    }

    // MARK: - Navigation

    func goToWeek(offset: Int) async {
        weekStart = MealPlanWeek.shift(weekStart, byWeeks: offset)
        await changeWeek()
    }

    func goToCurrentWeek() async {
        weekStart = MealPlanWeek.startOfWeek(containing: Date())
        await changeWeek()
    }

    private func changeWeek() async {
        entriesBySlot = [:]
        libraryNote = nil
        swappedOut = [:]
        await loadCachedWeek()
        do {
            try await refreshWeek()
        } catch {
            self.error = "Couldn't load this week."
            print("[MealPlanViewModel] Failed to load week: \(error.localizedDescription)")
        }
    }

    func selectPlan(_ planId: UUID) async {
        guard planId != activePlanId else { return }
        activePlanId = planId
        UserDefaults.standard.set(planId.uuidString, forKey: Self.activePlanKey)
        collaborators = []
        await changeWeek()
        await loadCollaborators()
    }

    // MARK: - Slot Actions

    /// Sets a slot to a recipe.
    func setRecipe(_ recipe: Recipe, day: Date, meal: MealType, note: String?) async {
        let existing = entry(for: day, meal: meal)
        let keepCooked = existing?.recipeId == recipe.id ? existing?.cookedAt : nil
        await saveSlot(day: day, meal: meal, kind: .recipe, recipeId: recipe.id, title: recipe.name, note: note, cookedAt: keepCooked)
    }

    /// Sets a slot to a non-recipe marker (eating out, leftovers, skip, or a custom meal).
    func setMarker(_ kind: MealEntryKind, title: String?, day: Date, meal: MealType, note: String?) async {
        let trimmedTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines)
        await saveSlot(
            day: day,
            meal: meal,
            kind: kind,
            recipeId: nil,
            title: (trimmedTitle?.isEmpty ?? true) ? nil : trimmedTitle,
            note: note,
            cookedAt: nil
        )
    }

    private func saveSlot(day: Date, meal: MealType, kind: MealEntryKind, recipeId: UUID?, title: String?, note: String?, cookedAt: Date?) async {
        guard let planId = activePlanId else { return }
        error = nil
        let dateKey = MealPlanWeek.key(for: day)
        let trimmedNote = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let saved = try await MealPlanService.upsertEntry(
                planId: planId,
                dateKey: dateKey,
                meal: meal,
                kind: kind,
                recipeId: recipeId,
                title: title,
                note: (trimmedNote?.isEmpty ?? true) ? nil : trimmedNote,
                cookedAt: cookedAt,
                userId: userId
            )
            let previous = entriesBySlot[Self.slotKey(dateKey, meal)]
            entriesBySlot[Self.slotKey(dateKey, meal)] = saved
            if let previous, previous.isSuggested, let replaced = previous.recipeId, saved.recipeId != replaced {
                recordFeedback([(replaced, .swapped)])
            }
        } catch {
            self.error = "Couldn't save that meal. Try again."
            print("[MealPlanViewModel] Failed to save slot: \(error.localizedDescription)")
        }
    }

    func clearSlot(day: Date, meal: MealType) async {
        guard let existing = entry(for: day, meal: meal) else { return }
        error = nil
        let key = Self.slotKey(existing.date, meal)
        entriesBySlot[key] = nil
        do {
            try await MealPlanService.deleteEntry(entryId: existing.id)
        } catch {
            entriesBySlot[key] = existing
            self.error = "Couldn't clear that meal. Try again."
            print("[MealPlanViewModel] Failed to clear slot: \(error.localizedDescription)")
        }
    }

    // MARK: - Planning

    /// Whether Regenerate has anything to replace: unlocked suggestions from today on.
    var hasReplaceableSuggestions: Bool {
        let todayKey = MealPlanWeek.key(for: Date())
        return entriesBySlot.values.contains { $0.isSuggested && !$0.isLocked && $0.date >= todayKey }
    }

    /// Enabled slots from today onward, in day → meal order.
    private var upcomingSlots: [MealPlanner.Slot] {
        let todayKey = MealPlanWeek.key(for: Date())
        return days.flatMap { day in
            enabledMeals.map { MealPlanner.Slot(date: MealPlanWeek.key(for: day), meal: $0) }
        }
        .filter { $0.date >= todayKey }
    }

    private func filled(from entries: [String: MealPlanEntry]) -> [MealPlanner.Filled] {
        entries.values.map { MealPlanner.Filled(date: $0.date, meal: $0.meal, recipeId: $0.kind == .recipe ? $0.recipeId : nil) }
    }

    /// Runs the planner for `slots` and saves the result as suggested slots. Returns how many were saved.
    private func runPlanner(
        slots: [MealPlanner.Slot],
        entries: [String: MealPlanEntry],
        excluded: [String: Set<UUID>],
        brief: WeekBrief? = nil,
        note: String? = nil
    ) async throws -> Int {
        guard let planId = activePlanId else { return 0 }
        let lookbackStart = MealPlanWeek.shift(weekStart, byWeeks: -5)
        let dayBefore = MealPlanWeek.calendar.date(byAdding: .day, value: -1, to: weekStart) ?? weekStart
        let yearAgo = MealPlanWeek.calendar.date(byAdding: .year, value: -1, to: weekStart) ?? weekStart
        let halfYearAgo = MealPlanWeek.calendar.date(byAdding: .month, value: -6, to: weekStart) ?? weekStart

        async let attributesResult = RecipeAttributeService.fetchAll()
        async let cooksResult = MealPlanService.fetchCookDates(since: yearAgo)
        async let plannedResult = MealPlanService.fetchPlannedRecipeDates(
            planId: planId,
            fromKey: MealPlanWeek.key(for: lookbackStart),
            toKey: MealPlanWeek.key(for: dayBefore)
        )
        async let feedbackResult = MealPlanService.fetchFeedback(planId: planId, since: halfYearAgo)
        let (attributes, cooks, planned, feedback) = try await (attributesResult, cooksResult, plannedResult, feedbackResult)

        var cookDates: [UUID: [String]] = [:]
        for cook in cooks { cookDates[cook.recipeId, default: []].append(MealPlanWeek.key(for: cook.completedAt)) }
        var lastPlanned: [UUID: String] = [:]
        for item in planned where (lastPlanned[item.recipeId] ?? "") < item.date { lastPlanned[item.recipeId] = item.date }

        let preferences = MealPlanner.buildPreferences(
            todayKey: MealPlanWeek.key(for: Date()),
            cooks: cooks.map { ($0.recipeId, MealPlanWeek.key(for: $0.completedAt)) },
            feedback: feedback.map { ($0.recipeId, $0.event, MealPlanWeek.key(for: $0.createdAt)) },
            planned: planned
        )
        let calendar = MealPlanWeek.calendar
        var quickWeekdays = MealPlanner.learnQuickWeekdays(cooks.map { cook in
            let weekday = (calendar.component(.weekday, from: cook.startedAt) + 5) % 7
            return (weekday, cook.completedAt.timeIntervalSince(cook.startedAt) / 60)
        })
        let attributesById = Dictionary(attributes.map { ($0.recipeId, $0) }, uniquingKeysWith: { first, _ in first })
        var boosts: [UUID: (factor: Double, reason: String)] = [:]
        var avoided: Set<UUID> = []
        if let brief {
            let adjustments = try await briefAdjustments(brief, attributes: attributesById)
            boosts = adjustments.boosts
            avoided = adjustments.avoided
            quickWeekdays.formUnion(adjustments.quickWeekdays)
        }

        let result = MealPlanner.planWeek(MealPlanner.Input(
            slots: slots,
            filled: filled(from: entries),
            recipes: recipes,
            attributes: attributesById,
            cookDates: cookDates,
            lastPlanned: lastPlanned,
            excluded: excluded,
            preferences: preferences,
            quickWeekdays: quickWeekdays,
            boosts: boosts,
            avoided: avoided
        ))
        let titles = Dictionary(recipes.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        var suggestions = result.suggestions
        if let note, !suggestions.isEmpty {
            let meals = suggestions.map { suggestion -> (title: String, slot: String, reason: String) in
                let day = MealPlanWeek.date(fromKey: suggestion.date)?.formatted(.dateTime.weekday(.wide)) ?? suggestion.date
                return (titles[suggestion.recipeId] ?? "", "\(day) \(suggestion.meal.rawValue)", suggestion.reason)
            }
            if let friendlier = await WeekBriefService.friendlierReasons(note: note, meals: meals) {
                suggestions = zip(suggestions, friendlier).map {
                    MealPlanner.Suggestion(date: $0.date, meal: $0.meal, recipeId: $0.recipeId, reason: $1)
                }
            }
        }
        let saved = try await MealPlanService.saveSuggestions(planId: planId, suggestions: suggestions, titles: titles, userId: userId)
        for entry in saved { entriesBySlot[Self.slotKey(entry.date, entry.meal)] = entry }
        libraryNote = result.libraryNote
        return saved.count
    }

    /// Records reactions to suggestions so the planner learns. Best-effort: the user's action
    /// already succeeded, so a failure is only logged.
    private func recordFeedback(_ events: [(recipeId: UUID, event: MealPlanner.FeedbackEvent)]) {
        guard let planId = activePlanId, !events.isEmpty else { return }
        let userId = userId
        Task {
            do {
                try await MealPlanService.recordFeedback(planId: planId, events: events, userId: userId)
            } catch {
                print("[MealPlanViewModel] Failed to record feedback: \(error.localizedDescription)")
            }
        }
    }

    /// Turns the switched-on parts of a week note into planner inputs: recipes to nudge (with the
    /// reason shown), recipes to leave out, and extra quick days.
    private func briefAdjustments(
        _ brief: WeekBrief,
        attributes: [UUID: RecipeAttributes]
    ) async throws -> (boosts: [UUID: (factor: Double, reason: String)], avoided: Set<UUID>, quickWeekdays: Set<Int>) {
        let useUp = brief.useUp.filter(\.isOn).map(\.text)
        let avoid = brief.avoid.filter(\.isOn).map(\.text)
        let cuisines = Set(brief.cuisines.filter(\.isOn).map(\.text))

        var ingredientsByRecipe: [UUID: [String]] = [:]
        if !useUp.isEmpty || !avoid.isEmpty {
            let ingredients = try await RecipeService.fetchIngredients(recipeIds: recipes.map(\.id))
            for ingredient in ingredients {
                ingredientsByRecipe[ingredient.recipeId, default: []].append(ingredient.name.lowercased())
            }
        }
        func mentions(_ recipe: Recipe, _ term: String) -> Bool {
            recipe.name.lowercased().contains(term)
                || (ingredientsByRecipe[recipe.id] ?? []).contains { $0.contains(term) }
        }

        var boosts: [UUID: (factor: Double, reason: String)] = [:]
        var avoided: Set<UUID> = []
        for recipe in recipes {
            let attrs = attributes[recipe.id]
            if avoid.contains(where: { term in mentions(recipe, term) || attrs?.protein == term || attrs?.proteinValue?.label.lowercased() == term }) {
                avoided.insert(recipe.id)
                continue
            }
            if let term = useUp.first(where: { mentions(recipe, $0) }) {
                boosts[recipe.id] = (1.5, "Uses up your \(term)")
            } else if let cuisine = attrs?.cuisineValue?.label, cuisines.contains(cuisine) {
                boosts[recipe.id] = (1.3, "You're in the mood for \(cuisine)")
            }
        }

        var quick = Set(brief.dayNotes.filter { $0.isOn && $0.plan == .quick }.map(\.weekday))
        if brief.lightWeek { quick.formUnion(0..<7) }
        return (boosts, avoided, quick)
    }

    /// Fills every empty upcoming slot with a suggestion.
    func planMyWeek() async {
        await planMyWeek(brief: nil, note: nil)
    }

    /// Plans the week using a note the household wrote about it: marks the days they're out or
    /// having leftovers, then fills the rest with suggestions shaped by the note.
    func planMyWeek(brief: WeekBrief?, note: String?) async {
        isPlanning = true
        error = nil
        defer { isPlanning = false }
        if let brief { await applyDayNotes(brief) }
        let slots = upcomingSlots.filter { entriesBySlot[$0.key] == nil }
        guard !slots.isEmpty else { return }
        do {
            _ = try await runPlanner(slots: slots, entries: entriesBySlot, excluded: [:], brief: brief, note: note)
        } catch {
            self.error = "Couldn't plan the week. Try again."
            print("[MealPlanViewModel] Failed to plan: \(error.localizedDescription)")
        }
    }

    /// Marks empty upcoming slots the note says are eating out, leftovers or skipped. Slots that
    /// already hold something are left as they are.
    private func applyDayNotes(_ brief: WeekBrief) async {
        let todayKey = MealPlanWeek.key(for: Date())
        let weekDays = days
        for note in brief.dayNotes where note.isOn && note.plan != .quick && weekDays.indices.contains(note.weekday) {
            let day = weekDays[note.weekday]
            guard MealPlanWeek.key(for: day) >= todayKey else { continue }
            let kind: MealEntryKind
            switch note.plan {
            case .eatingOut: kind = .eatingOut
            case .leftovers: kind = .leftovers
            case .skip: kind = .skip
            case .quick: continue
            }
            let meals = note.meal.map { [$0] } ?? enabledMeals
            for meal in meals where enabledMeals.contains(meal) && entry(for: day, meal: meal) == nil {
                await setMarker(kind, title: nil, day: day, meal: meal, note: nil)
            }
        }
    }

    /// Replaces every unlocked suggestion from today on, keeping manual and locked meals.
    func regenerate() async {
        isPlanning = true
        error = nil
        defer { isPlanning = false }
        let todayKey = MealPlanWeek.key(for: Date())
        let replaceable = entriesBySlot.values.filter { $0.isSuggested && !$0.isLocked && $0.date >= todayKey }
        // Previously suggested recipes step aside this round so Regenerate really changes things.
        var excluded: [String: Set<UUID>] = [:]
        for entry in replaceable {
            if let recipeId = entry.recipeId { excluded[Self.slotKey(entry.date, entry.meal)] = [recipeId] }
        }
        do {
            try await MealPlanService.deleteEntries(ids: replaceable.map(\.id))
            recordFeedback(replaceable.compactMap { entry in entry.recipeId.map { ($0, .regenerated) } })
            for entry in replaceable { entriesBySlot[Self.slotKey(entry.date, entry.meal)] = nil }
            let slots = upcomingSlots.filter { entriesBySlot[$0.key] == nil }
            _ = try await runPlanner(slots: slots, entries: entriesBySlot, excluded: excluded)
        } catch {
            self.error = "Couldn't regenerate suggestions. Try again."
            print("[MealPlanViewModel] Failed to regenerate: \(error.localizedDescription)")
        }
    }

    /// Replaces one slot with the next-best suggestion, never repeating one already swapped out.
    func swap(day: Date, meal: MealType) async {
        let key = Self.slotKey(MealPlanWeek.key(for: day), meal)
        var seen = swappedOut[key] ?? []
        if let current = entriesBySlot[key]?.recipeId { seen.insert(current) }
        swappedOut[key] = seen
        var others = entriesBySlot
        others[key] = nil
        error = nil
        if let current = entriesBySlot[key]?.recipeId { recordFeedback([(current, .swapped)]) }
        do {
            let count = try await runPlanner(
                slots: [MealPlanner.Slot(date: MealPlanWeek.key(for: day), meal: meal)],
                entries: others,
                excluded: [key: seen]
            )
            if count == 0 { error = "No other recipes fit this meal right now." }
        } catch {
            self.error = "Couldn't swap that meal. Try again."
            print("[MealPlanViewModel] Failed to swap: \(error.localizedDescription)")
        }
    }

    func toggleLock(day: Date, meal: MealType) async {
        let key = Self.slotKey(MealPlanWeek.key(for: day), meal)
        guard var entry = entriesBySlot[key] else { return }
        let original = entry
        entry.isLocked.toggle()
        entriesBySlot[key] = entry
        do {
            let saved = try await MealPlanService.setLocked(entryId: entry.id, isLocked: entry.isLocked)
            entriesBySlot[key] = saved
            if saved.isLocked, let recipeId = saved.recipeId { recordFeedback([(recipeId, .kept)]) }
        } catch {
            entriesBySlot[key] = original
            self.error = "Couldn't update that meal."
            print("[MealPlanViewModel] Failed to toggle lock: \(error.localizedDescription)")
        }
    }

    // MARK: - Plan Settings

    func setMeal(_ meal: MealType, enabled: Bool) async {
        guard let plan = activePlan, let index = plans.firstIndex(where: { $0.id == plan.id }) else { return }
        var meals = plan.enabledMealTypes
        if enabled {
            if !meals.contains(meal) { meals.append(meal) }
        } else {
            meals.removeAll { $0 == meal }
        }
        let ordered = MealType.allCases.filter { meals.contains($0) }
        guard !ordered.isEmpty else { return }

        let previous = plans[index].enabledMeals
        plans[index].enabledMeals = ordered.map(\.rawValue)
        do {
            try await MealPlanService.updateEnabledMeals(planId: plan.id, meals: ordered)
        } catch {
            plans[index].enabledMeals = previous
            self.error = "Couldn't update the meals shown."
            print("[MealPlanViewModel] Failed to update meals: \(error.localizedDescription)")
        }
    }

    // MARK: - Sharing

    func share(email: String) async throws {
        guard let planId = activePlanId else { return }
        try await MealPlanService.share(planId: planId, email: email, sharedBy: userId)
        await loadCollaborators()
    }

    func unshare(email: String) async throws {
        guard let planId = activePlanId else { return }
        try await MealPlanService.unshare(planId: planId, email: email)
        await loadCollaborators()
    }

    /// Leaves a plan someone else shared, then falls back to another visible plan.
    func leaveActivePlan() async {
        guard let planId = activePlanId, !isOwner else { return }
        do {
            try await MealPlanService.unshare(planId: planId, email: userEmail)
            activePlanId = nil
            UserDefaults.standard.removeObject(forKey: Self.activePlanKey)
            try await refreshPlans()
            entriesBySlot = [:]
            try await refreshWeek()
            await loadCollaborators()
        } catch {
            self.error = "Couldn't leave this plan."
            print("[MealPlanViewModel] Failed to leave plan: \(error.localizedDescription)")
        }
    }

    // MARK: - Shopping

    /// Ingredients for every planned recipe this week, merged by name. An ingredient used by
    /// several recipes is counted once per recipe so the list quantity reflects the week.
    func weekIngredients() async throws -> [(name: String, quantity: String?, amount: Double?, unit: String?)] {
        let recipeIds = plannedRecipeEntries.compactMap(\.recipeId)
        let ingredients = try await RecipeService.fetchIngredients(recipeIds: Array(Set(recipeIds)))
        let byRecipe = Dictionary(grouping: ingredients, by: \.recipeId)

        var order: [String] = []
        var merged: [String: (name: String, quantity: String?, count: Int)] = [:]
        for recipeId in recipeIds {
            for ingredient in byRecipe[recipeId] ?? [] {
                let key = ingredient.name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                guard !key.isEmpty else { continue }
                if var existing = merged[key] {
                    existing.count += 1
                    merged[key] = existing
                } else {
                    order.append(key)
                    merged[key] = (ingredient.name, ingredient.quantity, 1)
                }
            }
        }
        return order.compactMap { key in
            guard let item = merged[key] else { return nil }
            return (name: item.name, quantity: item.quantity, amount: Double(item.count), unit: nil)
        }
    }
}

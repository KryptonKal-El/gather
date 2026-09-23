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

    let userId: UUID
    let userEmail: String

    private static let activePlanKey = "gather.activeMealPlanId"

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
            entriesBySlot[Self.slotKey(dateKey, meal)] = saved
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
        let ingredients = try await MealPlanService.fetchIngredients(recipeIds: Array(Set(recipeIds)))
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

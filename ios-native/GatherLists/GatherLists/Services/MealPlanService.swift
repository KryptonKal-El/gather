import Foundation
import Supabase

/// Service layer wrapping Supabase queries for meal plans, their shares, and meal slots.
struct MealPlanService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }

    // MARK: - Plans

    /// Fetches every plan the user can see (owned and shared), oldest first. RLS scopes the rows.
    static func fetchPlans() async throws -> [MealPlan] {
        try await client
            .from("meal_plans")
            .select()
            .order("created_at", ascending: true)
            .execute()
            .value
    }

    /// Creates a new plan owned by the user.
    static func createPlan(userId: UUID) async throws -> MealPlan {
        try await client
            .from("meal_plans")
            .insert(NewMealPlan(ownerId: userId))
            .select()
            .single()
            .execute()
            .value
    }

    /// Replaces which meals the plan shows.
    static func updateEnabledMeals(planId: UUID, meals: [MealType]) async throws {
        try await client
            .from("meal_plans")
            .update(EnabledMealsUpdate(enabledMeals: meals.map(\.rawValue), updatedAt: Date()))
            .eq("id", value: planId)
            .execute()
    }

    // MARK: - Entries

    /// Fetches the plan's slots between two calendar-day keys, inclusive.
    static func fetchEntries(planId: UUID, fromKey: String, toKey: String) async throws -> [MealPlanEntry] {
        try await client
            .from("meal_plan_entries")
            .select()
            .eq("meal_plan_id", value: planId)
            .gte("date", value: fromKey)
            .lte("date", value: toKey)
            .execute()
            .value
    }

    /// Creates or replaces the slot for (plan, date, meal) as set by a person, and returns the
    /// saved row. It becomes a manual slot and loses any suggestion reason.
    static func upsertEntry(
        planId: UUID,
        dateKey: String,
        meal: MealType,
        kind: MealEntryKind,
        recipeId: UUID?,
        title: String?,
        note: String?,
        cookedAt: Date?,
        userId: UUID
    ) async throws -> MealPlanEntry {
        let entry = MealPlanEntryUpsert(
            mealPlanId: planId,
            date: dateKey,
            meal: meal.rawValue,
            kind: kind.rawValue,
            recipeId: recipeId,
            title: title,
            note: note,
            cookedAt: cookedAt,
            createdBy: userId,
            updatedAt: Date()
        )
        return try await client
            .from("meal_plan_entries")
            .upsert(entry, onConflict: "meal_plan_id,date,meal")
            .select()
            .single()
            .execute()
            .value
    }

    /// Saves planner suggestions in one request; each replaces whatever was in its slot.
    static func saveSuggestions(planId: UUID, suggestions: [MealPlanner.Suggestion], titles: [UUID: String], userId: UUID) async throws -> [MealPlanEntry] {
        guard !suggestions.isEmpty else { return [] }
        let now = Date()
        let rows = suggestions.map {
            SuggestedEntryUpsert(
                mealPlanId: planId,
                date: $0.date,
                meal: $0.meal.rawValue,
                recipeId: $0.recipeId,
                title: titles[$0.recipeId],
                suggestionReason: $0.reason,
                createdBy: userId,
                updatedAt: now
            )
        }
        return try await client
            .from("meal_plan_entries")
            .upsert(rows, onConflict: "meal_plan_id,date,meal")
            .select()
            .execute()
            .value
    }

    /// Removes several slots at once (used by Regenerate).
    static func deleteEntries(ids: [UUID]) async throws {
        guard !ids.isEmpty else { return }
        try await client
            .from("meal_plan_entries")
            .delete()
            .in("id", values: ids)
            .execute()
    }

    /// Locks or unlocks a slot so Regenerate leaves it alone.
    static func setLocked(entryId: UUID, isLocked: Bool) async throws -> MealPlanEntry {
        try await client
            .from("meal_plan_entries")
            .update(LockUpdate(isLocked: isLocked, updatedAt: Date()))
            .eq("id", value: entryId)
            .select()
            .single()
            .execute()
            .value
    }

    /// Recipe slots planned between two date keys, for the planner's recency signal.
    static func fetchPlannedRecipeDates(planId: UUID, fromKey: String, toKey: String) async throws -> [(recipeId: UUID, date: String)] {
        let rows: [PlannedRecipeRow] = try await client
            .from("meal_plan_entries")
            .select("recipe_id, date")
            .eq("meal_plan_id", value: planId)
            .eq("kind", value: MealEntryKind.recipe.rawValue)
            .not("recipe_id", operator: .is, value: "null")
            .gte("date", value: fromKey)
            .lte("date", value: toKey)
            .execute()
            .value
        return rows.compactMap { row in row.recipeId.map { ($0, row.date) } }
    }

    /// Completed cook dates since `since`, for recipes the user can see.
    static func fetchCookDates(since: Date) async throws -> [(recipeId: UUID, completedAt: Date)] {
        let rows: [CookDateRow] = try await client
            .from("cook_sessions")
            .select("recipe_id, completed_at")
            .not("completed_at", operator: .is, value: "null")
            .gte("completed_at", value: since)
            .execute()
            .value
        return rows.compactMap { row in row.completedAt.map { (row.recipeId, $0) } }
    }

    /// Clears a slot.
    static func deleteEntry(entryId: UUID) async throws {
        try await client
            .from("meal_plan_entries")
            .delete()
            .eq("id", value: entryId)
            .execute()
    }

    // MARK: - Recipes

    /// Fetches every recipe the user can see: their own, shared collections, and ones planned in their plans.
    static func fetchAccessibleRecipes() async throws -> [Recipe] {
        try await client
            .from("recipes")
            .select()
            .order("name", ascending: true)
            .execute()
            .value
    }

    // MARK: - Sharing

    static func fetchShares(planId: UUID) async throws -> [MealPlanShare] {
        try await client
            .from("meal_plan_shares")
            .select()
            .eq("meal_plan_id", value: planId)
            .order("added_at", ascending: true)
            .execute()
            .value
    }

    static func share(planId: UUID, email: String, sharedBy: UUID) async throws {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        try await client
            .from("meal_plan_shares")
            .insert(NewMealPlanShare(mealPlanId: planId, sharedWithEmail: normalizedEmail, sharedBy: sharedBy, permission: "write"))
            .execute()
    }

    /// Removes a share. Owners use this to remove someone; recipients use it to leave.
    static func unshare(planId: UUID, email: String) async throws {
        let normalizedEmail = email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        try await client
            .from("meal_plan_shares")
            .delete()
            .eq("meal_plan_id", value: planId)
            .eq("shared_with_email", value: normalizedEmail)
            .execute()
    }

    /// Fetches the other members of a plan (owner + recipients, excluding the caller).
    static func fetchCollaborators(planId: UUID) async throws -> [Profile] {
        let response: [MealPlanCollaboratorResponse] = try await client
            .rpc("get_meal_plan_collaborators", params: ["p_meal_plan_id": planId])
            .execute()
            .value
        return response.map { Profile(id: $0.userId, avatarUrl: $0.avatarUrl, displayName: $0.displayName) }
    }
}

// MARK: - DTOs

private struct MealPlanCollaboratorResponse: Decodable {
    let userId: UUID
    let displayName: String?
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
    }
}

private struct NewMealPlan: Encodable {
    let ownerId: UUID

    enum CodingKeys: String, CodingKey {
        case ownerId = "owner_id"
    }
}

private struct EnabledMealsUpdate: Encodable {
    let enabledMeals: [String]
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case enabledMeals = "enabled_meals"
        case updatedAt = "updated_at"
    }
}

private struct MealPlanEntryUpsert: Encodable {
    let mealPlanId: UUID
    let date: String
    let meal: String
    let kind: String
    let recipeId: UUID?
    let title: String?
    let note: String?
    let cookedAt: Date?
    let createdBy: UUID
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case mealPlanId = "meal_plan_id"
        case date
        case meal
        case kind
        case recipeId = "recipe_id"
        case title
        case note
        case cookedAt = "cooked_at"
        case source
        case suggestionReason = "suggestion_reason"
        case createdBy = "created_by"
        case updatedAt = "updated_at"
    }

    // Encode nils explicitly so replacing a recipe slot with "Eating out" clears the old recipe and cooked mark.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(mealPlanId, forKey: .mealPlanId)
        try container.encode(date, forKey: .date)
        try container.encode(meal, forKey: .meal)
        try container.encode(kind, forKey: .kind)
        try container.encode(recipeId, forKey: .recipeId)
        try container.encode(title, forKey: .title)
        try container.encode(note, forKey: .note)
        try container.encode(cookedAt, forKey: .cookedAt)
        try container.encode("manual", forKey: .source)
        try container.encodeNil(forKey: .suggestionReason)
        try container.encode(createdBy, forKey: .createdBy)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

private struct NewMealPlanShare: Encodable {
    let mealPlanId: UUID
    let sharedWithEmail: String
    let sharedBy: UUID
    let permission: String

    enum CodingKeys: String, CodingKey {
        case mealPlanId = "meal_plan_id"
        case sharedWithEmail = "shared_with_email"
        case sharedBy = "shared_by"
        case permission
    }
}

private struct SuggestedEntryUpsert: Encodable {
    let mealPlanId: UUID
    let date: String
    let meal: String
    let recipeId: UUID
    let title: String?
    let suggestionReason: String
    let createdBy: UUID
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case mealPlanId = "meal_plan_id"
        case date, meal, kind, title, note, source
        case recipeId = "recipe_id"
        case cookedAt = "cooked_at"
        case isLocked = "is_locked"
        case suggestionReason = "suggestion_reason"
        case createdBy = "created_by"
        case updatedAt = "updated_at"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(mealPlanId, forKey: .mealPlanId)
        try container.encode(date, forKey: .date)
        try container.encode(meal, forKey: .meal)
        try container.encode(MealEntryKind.recipe.rawValue, forKey: .kind)
        try container.encode(recipeId, forKey: .recipeId)
        try container.encode(title, forKey: .title)
        try container.encodeNil(forKey: .note)
        try container.encodeNil(forKey: .cookedAt)
        try container.encode(false, forKey: .isLocked)
        try container.encode("suggested", forKey: .source)
        try container.encode(suggestionReason, forKey: .suggestionReason)
        try container.encode(createdBy, forKey: .createdBy)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

private struct LockUpdate: Encodable {
    let isLocked: Bool
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case isLocked = "is_locked"
        case updatedAt = "updated_at"
    }
}

private struct PlannedRecipeRow: Decodable {
    let recipeId: UUID?
    let date: String

    enum CodingKeys: String, CodingKey {
        case recipeId = "recipe_id"
        case date
    }
}

private struct CookDateRow: Decodable {
    let recipeId: UUID
    let completedAt: Date?

    enum CodingKeys: String, CodingKey {
        case recipeId = "recipe_id"
        case completedAt = "completed_at"
    }
}

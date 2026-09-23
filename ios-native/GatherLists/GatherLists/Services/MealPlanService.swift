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

    /// Creates or replaces the slot for (plan, date, meal) and returns the saved row.
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

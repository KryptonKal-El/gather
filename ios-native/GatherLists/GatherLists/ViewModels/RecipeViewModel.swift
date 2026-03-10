import Foundation
import Observation
import Supabase
import Realtime

@Observable
@MainActor
final class RecipeViewModel {
    // MARK: - Published State
    var collections: [RecipeCollection] = []
    var sharedCollections: [RecipeCollection] = []
    var recipes: [Recipe] = []
    var activeCollectionId: UUID?
    var activeRecipeId: UUID?
    var activeRecipeDetail: (recipe: Recipe, ingredients: [RecipeIngredient], steps: [RecipeStep])?
    var isLoading = false
    var error: String?
    var searchQuery = ""
    var isShowingCachedData = false
    var cachedAt: Date?
    
    let userId: UUID
    let userEmail: String
    
    // MARK: - Realtime Channels
    nonisolated(unsafe) private var collectionsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var sharesChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var recipesChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var collectionsTask: Task<Void, Never>?
    nonisolated(unsafe) private var sharesTask: Task<Void, Never>?
    nonisolated(unsafe) private var recipesTask: Task<Void, Never>?
    
    // MARK: - Computed
    
    var activeCollectionRecipes: [Recipe] {
        guard let collectionId = activeCollectionId else { return [] }
        return recipes.filter { $0.collectionId == collectionId }
    }
    
    var allCollections: [RecipeCollection] {
        collections + sharedCollections
    }
    
    var filteredCollections: [RecipeCollection] {
        guard !searchQuery.isEmpty else { return allCollections }
        let query = searchQuery.lowercased()
        return allCollections.filter { c in
            c.name.lowercased().contains(query) ||
            (c.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
    // MARK: - Init
    
    init(userId: UUID, userEmail: String) {
        self.userId = userId
        self.userEmail = userEmail
        
        Task {
            await loadData()
            await setupRealtimeSubscriptions()
        }
    }
    
    // MARK: - Data Loading
    
    private func loadData() async {
        isLoading = true
        error = nil
        
        let cachedCollections: CachedEntry<[RecipeCollection]>? = await OfflineCache.shared.load(forKey: "collections-owned-\(userId.uuidString)")
        let cachedShared: CachedEntry<[RecipeCollection]>? = await OfflineCache.shared.load(forKey: "collections-shared-\(userId.uuidString)")
        let cachedRecipes: CachedEntry<[Recipe]>? = await OfflineCache.shared.load(forKey: "recipes-\(userId.uuidString)")
        
        if let cachedCollections {
            collections = cachedCollections.data
        }
        if let cachedShared {
            sharedCollections = cachedShared.data
        }
        if let cachedRecipes {
            recipes = cachedRecipes.data
        }
        cachedAt = cachedCollections?.cachedAt ?? cachedShared?.cachedAt ?? cachedRecipes?.cachedAt
        if activeCollectionId == nil, let firstCollection = collections.first {
            activeCollectionId = firstCollection.id
        }
        
        do {
            let defaultCollection = try await RecipeService.ensureDefaultCollection(userId: userId)
            
            async let owned = RecipeService.fetchCollections(userId: userId)
            async let shared = RecipeService.fetchSharedCollections(email: userEmail)
            async let allRecipes = RecipeService.fetchRecipes(userId: userId)
            
            let (ownedResult, sharedResult, recipesResult) = try await (owned, shared, allRecipes)
            collections = ownedResult
            sharedCollections = sharedResult
            recipes = recipesResult
            isShowingCachedData = false
            cachedAt = nil
            
            if activeCollectionId == nil {
                activeCollectionId = defaultCollection.id
            }
            
            await OfflineCache.shared.save(ownedResult, forKey: "collections-owned-\(userId.uuidString)")
            await OfflineCache.shared.save(sharedResult, forKey: "collections-shared-\(userId.uuidString)")
            await OfflineCache.shared.save(recipesResult, forKey: "recipes-\(userId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            isShowingCachedData = !collections.isEmpty || !sharedCollections.isEmpty || !recipes.isEmpty
            print("[RecipeViewModel] Failed to load data: \(error.localizedDescription)")
        }
        
        isLoading = false
    }
    
    // MARK: - Realtime Subscriptions
    
    private func setupRealtimeSubscriptions() async {
        guard collectionsChannel == nil else { return }
        
        let client = SupabaseManager.shared.client
        
        // Channel 1: collections (owned)
        let collChannel = client.realtimeV2.channel("recipe-collections-\(userId.uuidString)")
        collectionsChannel = collChannel
        
        let collChanges = collChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "collections",
            filter: "owner_id=eq.\(userId.uuidString)"
        )
        
        collectionsTask = Task {
            await collChannel.subscribe()
            for await _ in collChanges {
                await refetchAllData()
            }
        }
        
        // Channel 2: collection_shares (for shared collections)
        let normalizedEmail = userEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let shareChannel = client.realtimeV2.channel("recipe-shares-\(normalizedEmail)")
        sharesChannel = shareChannel
        
        let shareChanges = shareChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "collection_shares",
            filter: "shared_with_email=eq.\(normalizedEmail)"
        )
        
        sharesTask = Task {
            await shareChannel.subscribe()
            for await _ in shareChanges {
                await refetchAllData()
            }
        }
        
        // Channel 3: recipes (owned)
        let recipeChannel = client.realtimeV2.channel("recipes-\(userId.uuidString)")
        recipesChannel = recipeChannel
        
        let recipeChanges = recipeChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "recipes",
            filter: "owner_id=eq.\(userId.uuidString)"
        )
        
        recipesTask = Task {
            await recipeChannel.subscribe()
            for await _ in recipeChanges {
                await refetchAllData()
            }
        }
    }
    
    private func refetchAllData() async {
        do {
            async let owned = RecipeService.fetchCollections(userId: userId)
            async let shared = RecipeService.fetchSharedCollections(email: userEmail)
            async let allRecipes = RecipeService.fetchRecipes(userId: userId)
            
            let (ownedResult, sharedResult, recipesResult) = try await (owned, shared, allRecipes)
            collections = ownedResult
            sharedCollections = sharedResult
            recipes = recipesResult
            
            if let activeId = activeCollectionId, !allCollections.contains(where: { $0.id == activeId }) {
                activeCollectionId = collections.first?.id
            }
            
            await OfflineCache.shared.save(ownedResult, forKey: "collections-owned-\(userId.uuidString)")
            await OfflineCache.shared.save(sharedResult, forKey: "collections-shared-\(userId.uuidString)")
            await OfflineCache.shared.save(recipesResult, forKey: "recipes-\(userId.uuidString)")
            isShowingCachedData = false
            cachedAt = nil
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to refetch data: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Refresh
    
    func refresh() async {
        await refetchAllData()
    }
    
    // MARK: - Collection Actions
    
    func createCollection(name: String, emoji: String?, description: String?) async {
        error = nil
        do {
            let newCollection = try await RecipeService.createCollection(
                userId: userId, name: name, emoji: emoji, description: description
            )
            collections.append(newCollection)
            activeCollectionId = newCollection.id
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to create collection: \(error.localizedDescription)")
        }
    }
    
    func updateCollection(id: UUID, name: String?, emoji: String?, description: String?) async {
        error = nil
        do {
            try await RecipeService.updateCollection(
                collectionId: id, name: name, emoji: emoji, description: description
            )
            if let index = collections.firstIndex(where: { $0.id == id }) {
                if let name { collections[index].name = name }
                collections[index].emoji = emoji
                if let description { collections[index].description = description }
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to update collection: \(error.localizedDescription)")
        }
    }
    
    func deleteCollection(id: UUID, deleteRecipes: Bool) async {
        guard collections.contains(where: { $0.id == id }) else {
            error = "Cannot delete a collection you don't own"
            return
        }
        
        if let collection = collections.first(where: { $0.id == id }), collection.isDefault {
            error = "Cannot delete the default collection"
            return
        }
        
        error = nil
        do {
            if !deleteRecipes {
                let defaultCollection = try await RecipeService.ensureDefaultCollection(userId: userId)
                let recipesToMove = recipes.filter { $0.collectionId == id }
                for recipe in recipesToMove {
                    try await RecipeService.moveRecipeToCollection(recipeId: recipe.id, collectionId: defaultCollection.id)
                }
            } else {
                let recipesToDelete = recipes.filter { $0.collectionId == id }
                for recipe in recipesToDelete {
                    try await RecipeService.deleteRecipe(recipeId: recipe.id)
                }
            }
            
            try await RecipeService.deleteCollection(collectionId: id)
            collections.removeAll { $0.id == id }
            recipes.removeAll { $0.collectionId == id }
            
            if activeCollectionId == id {
                activeCollectionId = collections.first?.id
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to delete collection: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Recipe Actions
    
    func createRecipe(
        name: String,
        description: String?,
        ingredients: [(name: String, quantity: String?)],
        steps: [String]
    ) async {
        guard let collectionId = activeCollectionId else {
            error = "No collection selected"
            return
        }
        
        error = nil
        do {
            let newRecipe = try await RecipeService.createRecipe(
                userId: userId,
                name: name,
                description: description,
                collectionId: collectionId,
                ingredients: ingredients,
                steps: steps
            )
            recipes.append(newRecipe)
            activeRecipeId = newRecipe.id
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to create recipe: \(error.localizedDescription)")
        }
    }
    
    func updateRecipe(id: UUID, name: String?, description: String?) async {
        error = nil
        do {
            try await RecipeService.updateRecipe(recipeId: id, name: name, description: description)
            if let index = recipes.firstIndex(where: { $0.id == id }) {
                if let name { recipes[index].name = name }
                if let description { recipes[index].description = description }
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to update recipe: \(error.localizedDescription)")
        }
    }
    
    func deleteRecipe(id: UUID) async {
        error = nil
        do {
            try await RecipeService.deleteRecipe(recipeId: id)
            recipes.removeAll { $0.id == id }
            if activeRecipeId == id {
                activeRecipeId = nil
                activeRecipeDetail = nil
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to delete recipe: \(error.localizedDescription)")
        }
    }
    
    func updateIngredients(recipeId: UUID, ingredients: [(name: String, quantity: String?)]) async {
        error = nil
        do {
            try await RecipeService.updateRecipeIngredients(recipeId: recipeId, ingredients: ingredients)
            if activeRecipeId == recipeId {
                await selectRecipe(id: recipeId)
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to update ingredients: \(error.localizedDescription)")
        }
    }
    
    func updateSteps(recipeId: UUID, steps: [String]) async {
        error = nil
        do {
            try await RecipeService.updateRecipeSteps(recipeId: recipeId, steps: steps)
            if activeRecipeId == recipeId {
                await selectRecipe(id: recipeId)
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to update steps: \(error.localizedDescription)")
        }
    }
    
    func moveRecipe(recipeId: UUID, toCollectionId: UUID) async {
        error = nil
        do {
            try await RecipeService.moveRecipeToCollection(recipeId: recipeId, collectionId: toCollectionId)
            if let index = recipes.firstIndex(where: { $0.id == recipeId }) {
                recipes[index].collectionId = toCollectionId
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to move recipe: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Image Actions
    
    func uploadRecipeImage(recipeId: UUID, imageData: Data, fileExtension: String) async throws {
        error = nil
        do {
            let imageUrl = try await StorageService.uploadRecipeImage(
                userId: userId,
                recipeId: recipeId,
                imageData: imageData,
                fileExtension: fileExtension
            )
            if let index = recipes.firstIndex(where: { $0.id == recipeId }) {
                recipes[index].imageUrl = imageUrl
            }
            if activeRecipeDetail?.recipe.id == recipeId {
                activeRecipeDetail?.recipe.imageUrl = imageUrl
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to upload recipe image: \(error.localizedDescription)")
            throw error
        }
    }
    
    func updateRecipeImageUrl(recipeId: UUID, imageUrl: String) async throws {
        error = nil
        do {
            try await RecipeService.updateRecipeImage(recipeId: recipeId, imageUrl: imageUrl)
            if let index = recipes.firstIndex(where: { $0.id == recipeId }) {
                recipes[index].imageUrl = imageUrl
            }
            if activeRecipeDetail?.recipe.id == recipeId {
                activeRecipeDetail?.recipe.imageUrl = imageUrl
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to update recipe image URL: \(error.localizedDescription)")
            throw error
        }
    }
    
    func removeRecipeImage(recipeId: UUID) async throws {
        error = nil
        do {
            try await RecipeService.removeRecipeImage(recipeId: recipeId)
            if let index = recipes.firstIndex(where: { $0.id == recipeId }) {
                recipes[index].imageUrl = nil
            }
            if activeRecipeDetail?.recipe.id == recipeId {
                activeRecipeDetail?.recipe.imageUrl = nil
            }
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to remove recipe image: \(error.localizedDescription)")
            throw error
        }
    }
    
    // MARK: - Selection Actions
    
    func selectCollection(id: UUID) {
        activeCollectionId = id
        activeRecipeId = nil
        activeRecipeDetail = nil
    }
    
    func selectRecipe(id: UUID) async {
        activeRecipeId = id
        do {
            activeRecipeDetail = try await RecipeService.fetchRecipeDetail(recipeId: id)
        } catch {
            self.error = error.localizedDescription
            print("[RecipeViewModel] Failed to fetch recipe detail: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Share Actions
    
    func shareCollection(id: UUID, email: String) async throws {
        try await RecipeService.shareCollection(collectionId: id, email: email, sharedBy: userId)
    }
    
    func unshareCollection(id: UUID, email: String) async throws {
        try await RecipeService.unshareCollection(collectionId: id, email: email)
    }
    
    // MARK: - Deinit
    
    deinit {
        collectionsTask?.cancel()
        sharesTask?.cancel()
        recipesTask?.cancel()
        
        let collChannel = collectionsChannel
        let shareChannel = sharesChannel
        let recipeChannel = recipesChannel
        
        Task {
            await collChannel?.unsubscribe()
            await shareChannel?.unsubscribe()
            await recipeChannel?.unsubscribe()
        }
    }
}

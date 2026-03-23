import Foundation
import Observation
import Supabase
import Realtime
import WidgetKit

/// Manages list state with realtime subscriptions for owned and shared lists.
@Observable
@MainActor
final class ListViewModel {
    private(set) var ownedLists: [GatherList] = []
    private(set) var sharedLists: [GatherList] = []
    var shareSortConfigs: [UUID: [String]] = [:]
    private(set) var collaboratorsByListId: [UUID: [Profile]] = [:]
    var activeListId: UUID?
    var isLoading = false
    var error: String?
    var searchQuery = ""
    var isShowingCachedData = false
    var cachedAt: Date?
    
    /// Unified list ordering (owned + shared), with order stored in UserDefaults.
    private(set) var allLists: [GatherList] = []
    
    private let userId: UUID
    private let userEmail: String
    
    private static let listOrderKey = "gather_list_order"
    
    nonisolated(unsafe) private var ownedListsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var sharedListsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var ownedListsTask: Task<Void, Never>?
    nonisolated(unsafe) private var sharedListsTask: Task<Void, Never>?
    nonisolated(unsafe) private var persistListIdTask: Task<Void, Never>?
    nonisolated(unsafe) private var listOrderSyncTask: Task<Void, Never>?
    
    /// Filtered lists based on search query matching name or emoji.
    var filteredLists: [GatherList] {
        guard !searchQuery.isEmpty else { return allLists }
        let query = searchQuery.lowercased()
        return allLists.filter { list in
            list.name.lowercased().contains(query) ||
            (list.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
    // MARK: - Unified List Ordering
    
    /// Rebuilds `allLists` by merging owned and shared lists, then sorting
    /// according to the cached order stored in UserDefaults.
    private func rebuildAllLists() {
        let merged = ownedLists + sharedLists
        let cachedOrder = UserDefaults.standard.stringArray(forKey: Self.listOrderKey) ?? []
        
        // Build a lookup from ID string to position in cached order
        var orderMap: [String: Int] = [:]
        for (index, idString) in cachedOrder.enumerated() {
            orderMap[idString] = index
        }
        
        // Sort: items in cache come first (by their cached position), others appended at end
        let sorted = merged.sorted { a, b in
            let aIndex = orderMap[a.id.uuidString.lowercased()] ?? Int.max
            let bIndex = orderMap[b.id.uuidString.lowercased()] ?? Int.max
            if aIndex != bIndex {
                return aIndex < bIndex
            }
            // Fallback: maintain relative order (owned before shared if both are new)
            let aIsOwned = ownedLists.contains { $0.id == a.id }
            let bIsOwned = ownedLists.contains { $0.id == b.id }
            if aIsOwned != bIsOwned {
                return aIsOwned
            }
            return false
        }
        
        allLists = sorted
        
        // Sync to shared container for widget access
        Task {
            await SharedDataStore.shared.saveLists(sorted)
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
    
    /// Saves the current allLists order to UserDefaults.
    private func saveListOrderToCache() {
        let idStrings = allLists.map { $0.id.uuidString.lowercased() }
        UserDefaults.standard.set(idStrings, forKey: Self.listOrderKey)
    }
    
    /// Clears the cached list order (call on sign out).
    static func clearCachedListOrder() {
        UserDefaults.standard.removeObject(forKey: listOrderKey)
    }
    
    init(userId: UUID, userEmail: String) {
        self.userId = userId
        self.userEmail = userEmail
        
        NotificationCenter.default.addObserver(forName: .listOrderDidChange, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                self?.rebuildAllLists()
            }
        }
        
        Task {
            await loadData()
            await setupRealtimeSubscriptions()
            await PreferenceRealtimeManager.shared.startSubscription(userId: userId)
        }
    }
    
    // MARK: - Data Loading
    
    private func loadData() async {
        isLoading = true
        error = nil
        
        // Read cached last list ID from UserDefaults for instant restore
        let cachedLastListId = PreferenceService.getCachedLastListId()
        
        // Load cached data first for instant display
        let cachedOwned: CachedEntry<[GatherList]>? = await OfflineCache.shared.load(forKey: "lists-owned-\(userId.uuidString)")
        let cachedShared: CachedEntry<[GatherList]>? = await OfflineCache.shared.load(forKey: "lists-shared-\(userId.uuidString)")
        
        if let cachedOwned {
            ownedLists = cachedOwned.data
        }
        if let cachedShared {
            sharedLists = cachedShared.data
        }
        rebuildAllLists()
        cachedAt = cachedOwned?.cachedAt ?? cachedShared?.cachedAt
        
        // Set activeListId from cached preference (no auto-navigation)
        if activeListId == nil && !allLists.isEmpty {
            if let cachedId = cachedLastListId, allLists.contains(where: { $0.id == cachedId }) {
                activeListId = cachedId
            } else if let cachedId = cachedLastListId {
                clearInvalidLastListId()
                if let firstList = allLists.first {
                    activeListId = firstList.id
                    persistLastListIdDebounced(firstList.id)
                }
            } else if let firstList = allLists.first {
                activeListId = firstList.id
                persistLastListIdDebounced(firstList.id)
            }
        }
        
        // Fetch fresh data from Supabase
        do {
            async let owned = ListService.fetchOwnedLists(userId: userId)
            async let shared = ListService.fetchSharedWithMeRefs(email: userEmail)
            
            let (ownedResult, sharedRefs) = try await (owned, shared)
            ownedLists = ownedResult
            sharedLists = sharedRefs.map { $0.list }
            shareSortConfigs = Dictionary(uniqueKeysWithValues: sharedRefs.compactMap { ref in
                guard let config = ref.shareSortConfig else { return nil }
                return (ref.list.id, config)
            })
            rebuildAllLists()
            isShowingCachedData = false
            cachedAt = nil
            
            // Set activeListId from cached preference if not already set (no auto-navigation)
            if activeListId == nil && !allLists.isEmpty {
                if let cachedId = cachedLastListId, allLists.contains(where: { $0.id == cachedId }) {
                    activeListId = cachedId
                } else if let cachedId = cachedLastListId {
                    clearInvalidLastListId()
                    if let firstList = allLists.first {
                        activeListId = firstList.id
                        persistLastListIdDebounced(firstList.id)
                    }
                } else if let firstList = allLists.first {
                    activeListId = firstList.id
                    persistLastListIdDebounced(firstList.id)
                }
            }
            
            // Reconcile server preferences with UserDefaults cache
            await reconcileServerPreferences()
            
            // Load collaborators for shared lists
            await loadCollaborators()
            
            // Cache the fresh data
            await OfflineCache.shared.save(ownedResult, forKey: "lists-owned-\(userId.uuidString)")
            await OfflineCache.shared.save(sharedLists, forKey: "lists-shared-\(userId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            isShowingCachedData = !ownedLists.isEmpty || !sharedLists.isEmpty
            print("[ListViewModel] Failed to load data: \(error.localizedDescription)")
        }
        
        isLoading = false
    }
    
    /// Fetches server preferences and updates UserDefaults cache if different.
    /// Clears invalid last list IDs that don't exist in current lists.
    private func reconcileServerPreferences() async {
        do {
            let serverPrefs = try await PreferenceService.fetchUserPreferences()
            let serverLastListId = serverPrefs.lastListId
            let cachedLastListId = PreferenceService.getCachedLastListId()
            
            // Check if server's last list ID is invalid (doesn't exist in current lists)
            if let serverId = serverLastListId, !allLists.contains(where: { $0.id == serverId }) {
                // Clear invalid ID from both UserDefaults and Supabase
                clearInvalidLastListId()
            } else if serverLastListId != cachedLastListId {
                // Update UserDefaults cache with server value (for next launch)
                PreferenceService.setCachedLastListId(serverLastListId)
            }
        } catch {
            print("[ListViewModel] Failed to reconcile server preferences: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Realtime Subscriptions
    
    private func setupRealtimeSubscriptions() async {
        // Guard against duplicate channel setup
        guard ownedListsChannel == nil else { return }
        
        let client = SupabaseManager.shared.client
        
        // Channel for owned lists
        let ownedChannel = client.realtimeV2.channel("owned-lists-\(userId.uuidString)")
        ownedListsChannel = ownedChannel
        
        let ownedChanges = ownedChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "lists",
            filter: "owner_id=eq.\(userId.uuidString)"
        )
        
        ownedListsTask = Task {
            await ownedChannel.subscribe()
            for await _ in ownedChanges {
                await refetchAllData()
            }
        }
        
        // Channel for shared lists
        let normalizedEmail = userEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let sharedChannel = client.realtimeV2.channel("shared-lists-\(normalizedEmail)")
        sharedListsChannel = sharedChannel
        
        let sharedChanges = sharedChannel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "list_shares",
            filter: "shared_with_email=eq.\(normalizedEmail)"
        )
        
        sharedListsTask = Task {
            await sharedChannel.subscribe()
            for await _ in sharedChanges {
                await refetchAllData()
            }
        }
    }
    
    private func refetchAllData() async {
        do {
            async let owned = ListService.fetchOwnedLists(userId: userId)
            async let shared = ListService.fetchSharedWithMeRefs(email: userEmail)
            
            let (ownedResult, sharedRefs) = try await (owned, shared)
            ownedLists = ownedResult
            sharedLists = sharedRefs.map { $0.list }
            shareSortConfigs = Dictionary(uniqueKeysWithValues: sharedRefs.compactMap { ref in
                guard let config = ref.shareSortConfig else { return nil }
                return (ref.list.id, config)
            })
            rebuildAllLists()
            isShowingCachedData = false
            cachedAt = nil
            
            // Refresh collaborators
            await loadCollaborators()
            
            // Verify active list still exists
            if let activeId = activeListId, !allLists.contains(where: { $0.id == activeId }) {
                let newActiveId = allLists.first?.id
                activeListId = newActiveId
                persistLastListIdDebounced(newActiveId)
            }
            
            // Update cache
            await OfflineCache.shared.save(ownedResult, forKey: "lists-owned-\(userId.uuidString)")
            await OfflineCache.shared.save(sharedLists, forKey: "lists-shared-\(userId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to refetch data: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Actions
    
    /// Manual refresh — re-fetches all list data.
    func refresh() async {
        await refetchAllData()
    }
    
    func createList(name: String, emoji: String?, color: String, type: String = "grocery", customCategories: [CategoryDef]? = nil) async {
        error = nil
        do {
            let newList = try await ListService.createList(userId: userId, name: name, emoji: emoji, color: color, sortOrder: ownedLists.count, type: type)
            
            var categoriesToSeed: [CategoryDef]?
            if let custom = customCategories {
                categoriesToSeed = custom
            } else {
                categoriesToSeed = await getSeedCategories(for: type, userId: userId)
            }
            
            if let categories = categoriesToSeed {
                try await ListService.updateList(listId: newList.id, name: nil, emoji: nil, color: nil, categories: categories)
                var seededList = newList
                seededList.categories = categories
                ownedLists.append(seededList)
            } else {
                ownedLists.append(newList)
            }
            
            rebuildAllLists()
            saveListOrderToCache()
            activeListId = newList.id
            persistLastListIdDebounced(newList.id)
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to create list: \(error.localizedDescription)")
        }
    }
    
    private func getSeedCategories(for type: String, userId: UUID) async -> [CategoryDef]? {
        guard !["basic", "guest_list"].contains(type) else { return nil }
        
        if let defaults = try? await UserCategoryDefaultService.fetchDefaults(userId: userId),
           let match = defaults.first(where: { $0.listType == type }),
           !match.categories.isEmpty {
            return match.categories
        }
        
        return CategoryService.getSystemDefaults(for: type)
    }
    
    func getPreviewCategories(for type: String) async -> [CategoryDef] {
        guard !["basic", "guest_list"].contains(type) else { return [] }
        
        if let defaults = try? await UserCategoryDefaultService.fetchDefaults(userId: userId),
           let match = defaults.first(where: { $0.listType == type }),
           !match.categories.isEmpty {
            return match.categories
        }
        
        return CategoryService.getSystemDefaults(for: type) ?? []
    }
    
    func updateList(id: UUID, name: String?, emoji: String?, color: String?, type: String? = nil, categories: [CategoryDef]? = nil) async {
        error = nil
        do {
            try await ListService.updateList(listId: id, name: name, emoji: emoji, color: color, type: type, categories: categories)
            
            // Update local state
            if let index = ownedLists.firstIndex(where: { $0.id == id }) {
                if let name { ownedLists[index].name = name }
                // Always update emoji (allows clearing by passing empty string)
                ownedLists[index].emoji = emoji
                if let color { ownedLists[index].color = color }
                if let type { ownedLists[index].type = type }
                if let categories { ownedLists[index].categories = categories }
                rebuildAllLists()
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to update list: \(error.localizedDescription)")
        }
    }
    
    func deleteList(id: UUID) async {
        // Only allow deleting owned lists
        guard ownedLists.contains(where: { $0.id == id }) else {
            error = "Cannot delete a list you don't own"
            return
        }
        
        error = nil
        do {
            try await ListService.deleteList(listId: id)
            ownedLists.removeAll { $0.id == id }
            rebuildAllLists()
            saveListOrderToCache()
            
            // Auto-select next available if deleted list was active
            if activeListId == id {
                let newActiveId = allLists.first?.id
                activeListId = newActiveId
                persistLastListIdDebounced(newActiveId)
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to delete list: \(error.localizedDescription)")
        }
    }
    
    func selectList(id: UUID) {
        activeListId = id
        persistLastListIdDebounced(id)
    }
    
    private func persistLastListIdDebounced(_ listId: UUID?) {
        // Update UserDefaults cache immediately for fast launch restore
        PreferenceService.setCachedLastListId(listId)
        
        persistListIdTask?.cancel()
        persistListIdTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            try? await PreferenceService.updateLastListId(listId)
        }
    }
    
    /// Clears an invalid last list ID from UserDefaults and Supabase (fire-and-forget).
    private func clearInvalidLastListId() {
        PreferenceService.setCachedLastListId(nil)
        Task {
            try? await PreferenceService.updateLastListId(nil)
        }
    }
    
    func moveList(from source: IndexSet, to destination: Int) {
        // Operate on the unified allLists array
        allLists.move(fromOffsets: source, toOffset: destination)
        
        // Save the unified order to UserDefaults
        saveListOrderToCache()
        
        // Debounced sync to Supabase (list order in user_preferences)
        let idStrings = allLists.map { $0.id.uuidString.lowercased() }
        listOrderSyncTask?.cancel()
        listOrderSyncTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 300ms debounce
            guard !Task.isCancelled else { return }
            try? await PreferenceService.updateListOrder(idStrings)
        }
        
        // Extract owned lists in their new order and sync to Supabase
        let reorderedOwned = allLists.filter { list in
            ownedLists.contains { $0.id == list.id }
        }
        
        let userId = self.userId
        Task {
            do {
                try await ListService.saveListOrder(userId: userId, lists: reorderedOwned)
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                }
                print("[ListViewModel] Failed to save list order: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Share Actions
    
    func shareList(id: UUID, email: String, sortConfig: [String]? = nil) async throws {
        try await ListService.shareList(listId: id, email: email, sortConfig: sortConfig)
    }
    
    func unshareList(id: UUID, email: String) async throws {
        try await ListService.unshareList(listId: id, email: email)
    }
    
    // MARK: - Collaborator Loading
    
    /// Batch-fetches collaborators for all shared lists.
    private func loadCollaborators() async {
        let allSharedListIds = Set(sharedLists.map(\.id))
        let ownedListIds = ownedLists.map(\.id)
        let listsToFetch = ownedListIds + Array(allSharedListIds)
        
        guard !listsToFetch.isEmpty else { return }
        
        await withTaskGroup(of: (UUID, [Profile]?).self) { group in
            for listId in listsToFetch {
                group.addTask {
                    do {
                        let collaborators = try await ListService.fetchListCollaborators(listId: listId)
                        return (listId, collaborators)
                    } catch {
                        return (listId, nil)
                    }
                }
            }
            
            for await (listId, collaborators) in group {
                if let collaborators {
                    collaboratorsByListId[listId] = collaborators
                }
            }
        }
    }
    
    deinit {
        ownedListsTask?.cancel()
        sharedListsTask?.cancel()
        persistListIdTask?.cancel()
        listOrderSyncTask?.cancel()
        
        let ownedChannel = ownedListsChannel
        let sharedChannel = sharedListsChannel
        
        Task {
            await ownedChannel?.unsubscribe()
            await sharedChannel?.unsubscribe()
            await PreferenceRealtimeManager.shared.stopSubscription()
        }
    }
}

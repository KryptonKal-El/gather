import Foundation
import Observation
import Supabase
import Realtime

/// Manages list state with realtime subscriptions for owned and shared lists.
@Observable
@MainActor
final class ListViewModel {
    var ownedLists: [GatherList] = []
    var sharedLists: [GatherList] = []
    var shareSortConfigs: [UUID: [String]] = [:]
    var activeListId: UUID?
    var isLoading = false
    var error: String?
    var searchQuery = ""
    var isShowingCachedData = false
    var cachedAt: Date?
    
    /// Set on launch if a valid cached last list should auto-navigate. Cleared after use.
    var pendingAutoNavigateList: GatherList?
    
    private let userId: UUID
    private let userEmail: String
    private var hasAttemptedLaunchRestore = false
    
    nonisolated(unsafe) private var ownedListsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var sharedListsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var ownedListsTask: Task<Void, Never>?
    nonisolated(unsafe) private var sharedListsTask: Task<Void, Never>?
    nonisolated(unsafe) private var persistListIdTask: Task<Void, Never>?
    
    /// All lists merged: owned first, then shared.
    var allLists: [GatherList] {
        ownedLists + sharedLists
    }
    
    /// Filtered lists based on search query matching name or emoji.
    var filteredLists: [GatherList] {
        guard !searchQuery.isEmpty else { return allLists }
        let query = searchQuery.lowercased()
        return allLists.filter { list in
            list.name.lowercased().contains(query) ||
            (list.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
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
        cachedAt = cachedOwned?.cachedAt ?? cachedShared?.cachedAt
        
        // Attempt launch restore from UserDefaults cached last list ID
        if !hasAttemptedLaunchRestore && !allLists.isEmpty {
            hasAttemptedLaunchRestore = true
            if let cachedId = cachedLastListId, let targetList = allLists.first(where: { $0.id == cachedId }) {
                activeListId = cachedId
                pendingAutoNavigateList = targetList
            } else if let cachedId = cachedLastListId {
                // Invalid cached list ID — clear it silently
                clearInvalidLastListId()
                if activeListId == nil, let firstList = allLists.first {
                    activeListId = firstList.id
                    persistLastListIdDebounced(firstList.id)
                }
            } else if activeListId == nil, let firstList = allLists.first {
                activeListId = firstList.id
                persistLastListIdDebounced(firstList.id)
            }
        } else if activeListId == nil, let firstList = allLists.first {
            activeListId = firstList.id
            persistLastListIdDebounced(firstList.id)
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
            isShowingCachedData = false
            cachedAt = nil
            
            // Attempt launch restore after network data if not already done
            if !hasAttemptedLaunchRestore && !allLists.isEmpty {
                hasAttemptedLaunchRestore = true
                if let cachedId = cachedLastListId, let targetList = allLists.first(where: { $0.id == cachedId }) {
                    activeListId = cachedId
                    pendingAutoNavigateList = targetList
                } else if let cachedId = cachedLastListId {
                    // Invalid cached list ID — clear it silently
                    clearInvalidLastListId()
                    if activeListId == nil, let firstList = allLists.first {
                        activeListId = firstList.id
                        persistLastListIdDebounced(firstList.id)
                    }
                } else if activeListId == nil, let firstList = allLists.first {
                    activeListId = firstList.id
                    persistLastListIdDebounced(firstList.id)
                }
            } else if activeListId == nil, let firstList = allLists.first {
                activeListId = firstList.id
                persistLastListIdDebounced(firstList.id)
            }
            
            // Reconcile server preferences with UserDefaults cache
            await reconcileServerPreferences()
            
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
            isShowingCachedData = false
            cachedAt = nil
            
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
    
    func createList(name: String, emoji: String?, color: String, type: String = "grocery") async {
        error = nil
        do {
            let newList = try await ListService.createList(userId: userId, name: name, emoji: emoji, color: color, sortOrder: ownedLists.count, type: type)
            ownedLists.append(newList)
            activeListId = newList.id
            persistLastListIdDebounced(newList.id)
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to create list: \(error.localizedDescription)")
        }
    }
    
    func updateList(id: UUID, name: String?, emoji: String?, color: String?, type: String? = nil) async {
        error = nil
        do {
            try await ListService.updateList(listId: id, name: name, emoji: emoji, color: color, type: type)
            
            // Update local state
            if let index = ownedLists.firstIndex(where: { $0.id == id }) {
                if let name { ownedLists[index].name = name }
                // Always update emoji (allows clearing by passing empty string)
                ownedLists[index].emoji = emoji
                if let color { ownedLists[index].color = color }
                if let type { ownedLists[index].type = type }
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
        ownedLists.move(fromOffsets: source, toOffset: destination)
        
        let userId = self.userId
        let currentLists = self.ownedLists
        Task {
            do {
                try await ListService.saveListOrder(userId: userId, lists: currentLists)
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
    
    deinit {
        ownedListsTask?.cancel()
        sharedListsTask?.cancel()
        persistListIdTask?.cancel()
        
        let ownedChannel = ownedListsChannel
        let sharedChannel = sharedListsChannel
        
        Task {
            await ownedChannel?.unsubscribe()
            await sharedChannel?.unsubscribe()
        }
    }
}

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
    var activeListId: UUID?
    var isLoading = false
    var error: String?
    var searchQuery = ""
    
    private let userId: UUID
    private let userEmail: String
    
    nonisolated(unsafe) private var ownedListsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var sharedListsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var ownedListsTask: Task<Void, Never>?
    nonisolated(unsafe) private var sharedListsTask: Task<Void, Never>?
    
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
        
        do {
            async let owned = ListService.fetchOwnedLists(userId: userId)
            async let shared = ListService.fetchSharedWithMe(email: userEmail)
            
            let (ownedResult, sharedResult) = try await (owned, shared)
            ownedLists = ownedResult
            sharedLists = sharedResult
            
            if activeListId == nil, let firstList = allLists.first {
                activeListId = firstList.id
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to load data: \(error.localizedDescription)")
        }
        
        isLoading = false
    }
    
    // MARK: - Realtime Subscriptions
    
    private func setupRealtimeSubscriptions() async {
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
            async let shared = ListService.fetchSharedWithMe(email: userEmail)
            
            let (ownedResult, sharedResult) = try await (owned, shared)
            ownedLists = ownedResult
            sharedLists = sharedResult
            
            // Verify active list still exists
            if let activeId = activeListId, !allLists.contains(where: { $0.id == activeId }) {
                activeListId = allLists.first?.id
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to refetch data: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Actions
    
    func createList(name: String, emoji: String?, color: String) async {
        error = nil
        do {
            let newList = try await ListService.createList(userId: userId, name: name, emoji: emoji, color: color)
            ownedLists.append(newList)
            activeListId = newList.id
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to create list: \(error.localizedDescription)")
        }
    }
    
    func updateList(id: UUID, name: String?, emoji: String?, color: String?) async {
        error = nil
        do {
            try await ListService.updateList(listId: id, name: name, emoji: emoji, color: color)
            
            // Update local state
            if let index = ownedLists.firstIndex(where: { $0.id == id }) {
                if let name { ownedLists[index].name = name }
                // Always update emoji (allows clearing by passing empty string)
                ownedLists[index].emoji = emoji
                if let color { ownedLists[index].color = color }
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
                activeListId = allLists.first?.id
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListViewModel] Failed to delete list: \(error.localizedDescription)")
        }
    }
    
    func selectList(id: UUID) {
        activeListId = id
    }
    
    // MARK: - Share Actions
    
    func shareList(id: UUID, email: String) async throws {
        try await ListService.shareList(listId: id, email: email)
    }
    
    func unshareList(id: UUID, email: String) async throws {
        try await ListService.unshareList(listId: id, email: email)
    }
    
    deinit {
        ownedListsTask?.cancel()
        sharedListsTask?.cancel()
        
        let ownedChannel = ownedListsChannel
        let sharedChannel = sharedListsChannel
        
        Task {
            await ownedChannel?.unsubscribe()
            await sharedChannel?.unsubscribe()
        }
    }
}

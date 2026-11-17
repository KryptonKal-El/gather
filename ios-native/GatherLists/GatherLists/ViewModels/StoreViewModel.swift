import Foundation
import Observation
import Supabase
import Realtime

/// Manages store list state with realtime subscriptions for the Stores tab.
@Observable
@MainActor
final class StoreViewModel {
    var stores: [Store] = []
    var isLoading = false
    var error: String?
    var isShowingCachedData = false
    var cachedAt: Date?
    
    private let listId: UUID
    
    @ObservationIgnored private let realtime = RealtimeSubscriptions(label: "StoreViewModel")
    
    init(listId: UUID) {
        self.listId = listId
    }
    
    /// Call this from the view's `.task` modifier to begin loading.
    func start() async {
        await loadData()
        setupRealtimeSubscription()
    }
    
    // MARK: - Data Loading
    
    private func loadData() async {
        isLoading = true
        error = nil
        
        // Load cached data first for instant display
        if let cached: CachedEntry<[Store]> = await OfflineCache.shared.load(forKey: "stores-\(listId.uuidString)") {
            stores = cached.data
            cachedAt = cached.cachedAt
        }
        
        // Fetch fresh data from Supabase
        do {
            stores = try await StoreService.fetchStores(listId: listId)
            isShowingCachedData = false
            cachedAt = nil
            await OfflineCache.shared.save(stores, forKey: "stores-\(listId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            isShowingCachedData = !stores.isEmpty
            print("[StoreViewModel] Failed to load stores: \(error.localizedDescription)")
        }
        
        isLoading = false
    }
    
    // MARK: - Realtime
    
    // No row filter: filters on non-PK columns silently drop UPDATE/DELETE events
    // (see docs/memory/supabase-realtime-replica-identity.md).
    private func setupRealtimeSubscription() {
        guard !realtime.isStarted else { return }

        let channel = realtime.channel("stores-list-\(listId.uuidString)")
        realtime.on(channel.postgresChange(AnyAction.self, schema: "public", table: "stores")) { [weak self] in
            await self?.refetchStores()
        }

        realtime.start { [weak self] in
            await self?.refetchStores()
        }
    }

    private func refetchStores() async {
        do {
            stores = try await StoreService.fetchStores(listId: listId)
            isShowingCachedData = false
            cachedAt = nil
            await OfflineCache.shared.save(stores, forKey: "stores-\(listId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            print("[StoreViewModel] Failed to refetch stores: \(error.localizedDescription)")
        }
    }
    
    /// Manual refresh, in place: flipping `isLoading` here would swap the list out mid-pull.
    func refresh() async {
        await refetchStores()
    }
    
    // MARK: - Actions
    
    func addStore(name: String, color: String) async {
        error = nil
        do {
            let newStore = try await StoreService.createStore(
                listId: listId,
                name: name,
                color: color
            )
            stores.append(newStore)
        } catch {
            self.error = error.localizedDescription
            print("[StoreViewModel] Failed to add store: \(error.localizedDescription)")
        }
    }
    
    func updateStore(_ storeId: UUID, name: String? = nil, color: String? = nil) async {
        error = nil
        do {
            try await StoreService.updateStore(storeId: storeId, name: name, color: color)
            
            // Update local state for instant feedback
            if let index = stores.firstIndex(where: { $0.id == storeId }) {
                if let name { stores[index].name = name }
                if let color { stores[index].color = color }
            }
        } catch {
            self.error = error.localizedDescription
            print("[StoreViewModel] Failed to update store: \(error.localizedDescription)")
        }
    }
    
    func deleteStore(_ storeId: UUID) async {
        error = nil
        do {
            try await StoreService.deleteStore(storeId: storeId)
            stores.removeAll { $0.id == storeId }
        } catch {
            self.error = error.localizedDescription
            print("[StoreViewModel] Failed to delete store: \(error.localizedDescription)")
        }
    }
    
    func moveStore(from source: IndexSet, to destination: Int) {
        stores.move(fromOffsets: source, toOffset: destination)
        
        let listId = self.listId
        let currentStores = self.stores
        Task {
            do {
                try await StoreService.saveStoreOrder(listId: listId, stores: currentStores)
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                }
                print("[StoreViewModel] Failed to save store order: \(error.localizedDescription)")
            }
        }
    }
}

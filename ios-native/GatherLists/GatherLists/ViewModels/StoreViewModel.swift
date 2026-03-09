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
    
    private let userId: UUID
    
    nonisolated(unsafe) private var storesChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var storesTask: Task<Void, Never>?
    
    init(userId: UUID) {
        self.userId = userId
        
        Task {
            await loadData()
            await setupRealtimeSubscription()
        }
    }
    
    // MARK: - Data Loading
    
    private func loadData() async {
        isLoading = true
        error = nil
        
        do {
            stores = try await StoreService.fetchStores(userId: userId)
        } catch {
            self.error = error.localizedDescription
            print("[StoreViewModel] Failed to load stores: \(error.localizedDescription)")
        }
        
        isLoading = false
    }
    
    // MARK: - Realtime
    
    private func setupRealtimeSubscription() async {
        guard storesChannel == nil else { return }
        
        let client = SupabaseManager.shared.client
        let channel = client.realtimeV2.channel("stores-tab-\(userId.uuidString)")
        storesChannel = channel
        
        let changes = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "stores",
            filter: "user_id=eq.\(userId.uuidString)"
        )
        
        storesTask = Task {
            await channel.subscribe()
            for await _ in changes {
                await refetchStores()
            }
        }
    }
    
    private func refetchStores() async {
        do {
            stores = try await StoreService.fetchStores(userId: userId)
        } catch {
            self.error = error.localizedDescription
            print("[StoreViewModel] Failed to refetch stores: \(error.localizedDescription)")
        }
    }
    
    /// Manual refresh.
    func refresh() async {
        await loadData()
    }
    
    // MARK: - Actions
    
    func addStore(name: String, color: String) async {
        error = nil
        do {
            let newStore = try await StoreService.createStore(
                userId: userId,
                name: name,
                color: color,
                categories: []
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
        
        let userId = self.userId
        let currentStores = self.stores
        Task {
            do {
                try await StoreService.saveStoreOrder(userId: userId, stores: currentStores)
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                }
                print("[StoreViewModel] Failed to save store order: \(error.localizedDescription)")
            }
        }
    }
    
    func updateCategories(_ storeId: UUID, categories: [CategoryDef]) async {
        error = nil
        do {
            try await StoreService.updateStore(storeId: storeId, categories: categories)
            
            if let index = stores.firstIndex(where: { $0.id == storeId }) {
                stores[index].categories = categories
            }
        } catch {
            self.error = error.localizedDescription
            print("[StoreViewModel] Failed to update categories: \(error.localizedDescription)")
        }
    }
    
    deinit {
        storesTask?.cancel()
        
        let channel = storesChannel
        Task {
            await channel?.unsubscribe()
        }
    }
}

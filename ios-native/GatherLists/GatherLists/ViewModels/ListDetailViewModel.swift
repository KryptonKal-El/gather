import Foundation
import Observation
import Supabase
import Realtime

/// Manages item list state with realtime subscriptions for items, stores, and history.
@Observable
@MainActor
final class ListDetailViewModel {
    // Published state
    var items: [Item] = []
    var stores: [Store] = []
    var historyEntries: [HistoryEntry] = []
    var isLoading = false
    var error: String?
    var isShowingCachedData = false
    var cachedAt: Date?
    
    // List categories (resolved via CategoryService)
    private(set) var listCategories: [CategoryDef] = []
    
    // Identifiers
    private let listId: UUID
    private let userId: UUID
    private let ownerId: UUID
    let listType: String
    private var list: GatherList?
    
    var isSharedList: Bool { ownerId != userId }
    
    var typeConfig: ListTypeConfig { ListTypes.getConfig(listType) }
    
    // Realtime channels and tasks
    nonisolated(unsafe) private var itemsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var storesChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var historyChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var itemsTask: Task<Void, Never>?
    nonisolated(unsafe) private var storesTask: Task<Void, Never>?
    nonisolated(unsafe) private var sharedStoresChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var sharedStoresTask: Task<Void, Never>?
    nonisolated(unsafe) private var historyTask: Task<Void, Never>?
    
    // MARK: - Computed Properties
    
    /// Items where isChecked is false, preserving fetch order.
    var uncheckedItems: [Item] {
        items.filter { !$0.isChecked }
    }
    
    /// Items where isChecked is true, preserving fetch order.
    var checkedItems: [Item] {
        items.filter { $0.isChecked }
    }
    
    /// Deduplicated names from historyEntries (case-insensitive), sorted alphabetically.
    var uniqueHistoryNames: [String] {
        var seen = Set<String>()
        var result: [String] = []
        for entry in historyEntries {
            let lowercased = entry.name.lowercased()
            if !seen.contains(lowercased) {
                seen.insert(lowercased)
                result.append(entry.name)
            }
        }
        return result.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }
    
    // MARK: - Pipeline Methods
    
    /// Applies the sort pipeline to unchecked items with the given effective config.
    func pipelineResult(for config: [SortLevel]) -> SortPipeline.PipelineResult {
        SortPipeline.apply(items: uncheckedItems, config: config, stores: stores, listCategories: listCategories, listType: listType)
    }
    
    /// Applies the sort pipeline to checked items with the given effective config.
    func checkedPipelineResult(for config: [SortLevel]) -> SortPipeline.PipelineResult {
        SortPipeline.apply(items: checkedItems, config: config, stores: stores, listCategories: listCategories, listType: listType)
    }
    
    // MARK: - Initialization
    
    init(list: GatherList, userId: UUID) {
        self.listId = list.id
        self.userId = userId
        self.ownerId = list.ownerId
        self.listType = list.type
        self.list = list
        self.listCategories = CategoryService.getEffectiveCategories(list: list) ?? []
        
        Task {
            await loadData()
            await setupRealtimeSubscriptions()
        }
    }
    
    func updateCategories(_ categories: [CategoryDef]) {
        self.listCategories = categories
    }
    
    // MARK: - Data Loading
    
    private func loadData() async {
        isLoading = true
        error = nil
        
        // Load cached data first for instant display
        let cachedItems: CachedEntry<[Item]>? = await OfflineCache.shared.load(forKey: "items-\(listId.uuidString)")
        if let cachedItems {
            items = cachedItems.data
            cachedAt = cachedItems.cachedAt
        }
        if let cachedStores: CachedEntry<[Store]> = await OfflineCache.shared.load(forKey: "stores-\(userId.uuidString)") {
            stores = cachedStores.data
        }
        if let cachedHistory: CachedEntry<[HistoryEntry]> = await OfflineCache.shared.load(forKey: "history-\(userId.uuidString)") {
            historyEntries = cachedHistory.data
        }
        
        // Fetch fresh data from Supabase
        do {
            async let fetchedItems = ItemService.fetchItems(listId: listId)
            async let fetchedStores = StoreService.fetchStores(userId: userId)
            async let fetchedHistory = HistoryService.fetchHistory(userId: userId)
            
            let (itemsResult, storesResult, historyResult) = try await (fetchedItems, fetchedStores, fetchedHistory)
            items = itemsResult
            stores = storesResult
            historyEntries = historyResult
            
            if isSharedList {
                let ownStoreIds = Set(storesResult.map { $0.id })
                let missingStoreIds = Set(itemsResult.compactMap { $0.storeId }).subtracting(ownStoreIds)
                if !missingStoreIds.isEmpty {
                    let sharedStores = try await StoreService.fetchStoresByIds(Array(missingStoreIds))
                    stores = storesResult + sharedStores
                }
            }
            
            isShowingCachedData = false
            cachedAt = nil
            
            // Cache the fresh data
            await OfflineCache.shared.save(itemsResult, forKey: "items-\(listId.uuidString)")
            await OfflineCache.shared.save(storesResult, forKey: "stores-\(userId.uuidString)")
            await OfflineCache.shared.save(historyResult, forKey: "history-\(userId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            isShowingCachedData = !items.isEmpty
            print("[ListDetailViewModel] Failed to load data: \(error.localizedDescription)")
        }
        
        isLoading = false
    }
    
    // MARK: - Realtime Subscriptions
    
    private func setupRealtimeSubscriptions() async {
        guard itemsChannel == nil else { return }
        
        let client = SupabaseManager.shared.client
        
        // Channel for items
        let itemsCh = client.realtimeV2.channel("list-items-\(listId.uuidString)")
        itemsChannel = itemsCh
        
        let itemsChanges = itemsCh.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "items",
            filter: "list_id=eq.\(listId.uuidString)"
        )
        
        itemsTask = Task {
            await itemsCh.subscribe()
            for await _ in itemsChanges {
                await refetchItems()
            }
        }
        
        // Channel for stores
        let storesCh = client.realtimeV2.channel("user-stores-\(userId.uuidString)")
        storesChannel = storesCh
        
        let storesChanges = storesCh.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "stores",
            filter: "user_id=eq.\(userId.uuidString)"
        )
        
        storesTask = Task {
            await storesCh.subscribe()
            for await _ in storesChanges {
                await refetchStores()
            }
        }
        
        // Channel for owner's stores (shared lists only)
        if isSharedList {
            let sharedStoresCh = client.realtimeV2.channel("owner-stores-\(ownerId.uuidString)")
            sharedStoresChannel = sharedStoresCh
            
            let sharedStoresChanges = sharedStoresCh.postgresChange(
                AnyAction.self,
                schema: "public",
                table: "stores",
                filter: "user_id=eq.\(ownerId.uuidString)"
            )
            
            sharedStoresTask = Task {
                await sharedStoresCh.subscribe()
                for await _ in sharedStoresChanges {
                    await refetchStores()
                }
            }
        }
        
        // Channel for history
        let historyCh = client.realtimeV2.channel("user-history-\(userId.uuidString)")
        historyChannel = historyCh
        
        let historyChanges = historyCh.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "history",
            filter: "user_id=eq.\(userId.uuidString)"
        )
        
        historyTask = Task {
            await historyCh.subscribe()
            for await _ in historyChanges {
                await refetchHistory()
            }
        }
    }
    
    // MARK: - Refetch Helpers
    
    private func refetchItems() async {
        do {
            items = try await ItemService.fetchItems(listId: listId)
            isShowingCachedData = false
            cachedAt = nil
            await OfflineCache.shared.save(items, forKey: "items-\(listId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to refetch items: \(error.localizedDescription)")
        }
    }
    
    private func refetchStores() async {
        do {
            var result = try await StoreService.fetchStores(userId: userId)
            if isSharedList {
                let ownStoreIds = Set(result.map { $0.id })
                let missingStoreIds = Set(items.compactMap { $0.storeId }).subtracting(ownStoreIds)
                if !missingStoreIds.isEmpty {
                    let sharedStores = try await StoreService.fetchStoresByIds(Array(missingStoreIds))
                    result += sharedStores
                }
            }
            stores = result
            await OfflineCache.shared.save(stores, forKey: "stores-\(userId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to refetch stores: \(error.localizedDescription)")
        }
    }
    
    private func refetchHistory() async {
        do {
            historyEntries = try await HistoryService.fetchHistory(userId: userId)
            await OfflineCache.shared.save(historyEntries, forKey: "history-\(userId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to refetch history: \(error.localizedDescription)")
        }
    }
    
    /// Manual refresh — re-fetches all data.
    func refresh() async {
        await loadData()
    }
    
    // MARK: - Action Methods
    
    func addItem(name: String, storeId: UUID?) async {
        do {
            let rsvpDefault: String? = listType == "guest_list" ? "invited" : nil
            let newItem = try await ItemService.addItem(
                listId: listId,
                name: name,
                category: nil,
                storeId: storeId,
                listCategories: listCategories,
                listType: listType,
                rsvpStatus: rsvpDefault
            )
            items.append(newItem)
            
            let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
            try await HistoryService.addHistoryEntry(userId: userId, name: capitalizedName)
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to add item: \(error.localizedDescription)")
        }
    }
    
    /// Adds an item from a history suggestion, carrying over data from the most recent past item.
    func addItemFromSuggestion(name: String, fallbackStoreId: UUID?) async {
        do {
            let pastItem = try await ItemService.fetchLastItemByName(name, userId: userId)
            
            let storeId = pastItem?.storeId ?? fallbackStoreId
            let rsvpDefault: String? = pastItem?.rsvpStatus ?? (listType == "guest_list" ? "invited" : nil)
            let newItem = try await ItemService.addItem(
                listId: listId,
                name: name,
                category: pastItem?.category,
                storeId: storeId,
                listCategories: listCategories,
                listType: listType,
                quantity: pastItem?.quantity ?? 1,
                price: pastItem?.price,
                imageUrl: pastItem?.imageUrl,
                unit: pastItem?.unit ?? "each",
                rsvpStatus: rsvpDefault
            )
            items.append(newItem)
            
            let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
            try await HistoryService.addHistoryEntry(userId: userId, name: capitalizedName)
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to add item from suggestion: \(error.localizedDescription)")
        }
    }
    
    func toggleItem(_ item: Item) async {
        do {
            try await ItemService.toggleItem(itemId: item.id, isChecked: !item.isChecked)
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index].isChecked.toggle()
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to toggle item: \(error.localizedDescription)")
        }
    }
    
    @discardableResult
    func deleteItem(_ item: Item) async -> Item? {
        do {
            try await ItemService.deleteItem(itemId: item.id)
            items.removeAll { $0.id == item.id }
            return item
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to delete item: \(error.localizedDescription)")
            return nil
        }
    }
    
    func updateItem(
        _ itemId: UUID,
        name: String? = nil,
        category: String? = nil,
        isChecked: Bool? = nil,
        storeId: UUID? = nil,
        clearStoreId: Bool = false,
        quantity: Int? = nil,
        price: Decimal? = nil,
        clearPrice: Bool = false,
        imageUrl: String? = nil,
        unit: String? = nil,
        rsvpStatus: String? = nil,
        clearRsvpStatus: Bool = false
    ) async {
        do {
            try await ItemService.updateItem(
                itemId: itemId,
                name: name,
                category: category,
                isChecked: isChecked,
                storeId: storeId,
                clearStoreId: clearStoreId,
                quantity: quantity,
                price: price,
                clearPrice: clearPrice,
                imageUrl: imageUrl,
                unit: unit,
                rsvpStatus: rsvpStatus,
                clearRsvpStatus: clearRsvpStatus
            )
            
            // Update local state for instant feedback
            if let index = items.firstIndex(where: { $0.id == itemId }) {
                if let name = name { items[index].name = name }
                if let category = category { items[index].category = category }
                if let isChecked = isChecked { items[index].isChecked = isChecked }
                if clearStoreId {
                    items[index].storeId = nil
                } else if let storeId = storeId {
                    items[index].storeId = storeId
                }
                if let quantity = quantity { items[index].quantity = quantity }
                if clearPrice {
                    items[index].price = nil
                } else if let price = price {
                    items[index].price = price
                }
                if let imageUrl = imageUrl { items[index].imageUrl = imageUrl }
                if let unit = unit { items[index].unit = unit }
                if clearRsvpStatus {
                    items[index].rsvpStatus = nil
                } else if let rsvpStatus = rsvpStatus {
                    items[index].rsvpStatus = rsvpStatus
                }
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to update item: \(error.localizedDescription)")
        }
    }
    
    @discardableResult
    func clearChecked() async -> [Item] {
        let checkedItems = items.filter { $0.isChecked }
        guard !checkedItems.isEmpty else { return [] }
        let checkedIds = checkedItems.map { $0.id }
        
        do {
            try await ItemService.deleteItems(itemIds: checkedIds)
            items.removeAll { $0.isChecked }
            return checkedItems
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to clear checked items: \(error.localizedDescription)")
            return []
        }
    }
    
    func restoreItem(_ item: Item) async {
        do {
            let restoredItem = try await ItemService.restoreItem(
                listId: listId,
                name: item.name,
                category: item.category,
                storeId: item.storeId,
                quantity: item.quantity,
                isChecked: item.isChecked,
                price: item.price,
                imageUrl: item.imageUrl,
                rsvpStatus: item.rsvpStatus
            )
            items.append(restoredItem)
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to restore item: \(error.localizedDescription)")
        }
    }
    
    func restoreItems(_ itemsToRestore: [Item]) async {
        do {
            let restored = try await ItemService.restoreItems(listId: listId, items: itemsToRestore)
            items.append(contentsOf: restored)
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to restore items: \(error.localizedDescription)")
        }
    }
    
    deinit {
        itemsTask?.cancel()
        storesTask?.cancel()
        sharedStoresTask?.cancel()
        historyTask?.cancel()
        
        let itemsCh = itemsChannel
        let storesCh = storesChannel
        let sharedStoresCh = sharedStoresChannel
        let historyCh = historyChannel
        
        Task {
            await itemsCh?.unsubscribe()
            await storesCh?.unsubscribe()
            await sharedStoresCh?.unsubscribe()
            await historyCh?.unsubscribe()
        }
    }
}

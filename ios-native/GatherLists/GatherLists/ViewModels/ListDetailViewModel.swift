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
    
    // Identifiers
    private let listId: UUID
    private let userId: UUID
    
    // Realtime channels and tasks
    nonisolated(unsafe) private var itemsChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var storesChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var historyChannel: RealtimeChannelV2?
    nonisolated(unsafe) private var itemsTask: Task<Void, Never>?
    nonisolated(unsafe) private var storesTask: Task<Void, Never>?
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
    
    /// Groups unchecked items by storeId, ordered by store's sortOrder, nil store at end.
    var groupedByStore: [(store: Store?, items: [Item])] {
        var storeGroups: [UUID: [Item]] = [:]
        var noStoreItems: [Item] = []
        
        for item in uncheckedItems {
            if let storeId = item.storeId {
                storeGroups[storeId, default: []].append(item)
            } else {
                noStoreItems.append(item)
            }
        }
        
        // Sort stores by sortOrder
        let sortedStores = stores.sorted { $0.sortOrder < $1.sortOrder }
        
        var result: [(store: Store?, items: [Item])] = []
        for store in sortedStores {
            if let items = storeGroups[store.id], !items.isEmpty {
                result.append((store: store, items: items))
            }
        }
        
        if !noStoreItems.isEmpty {
            result.append((store: nil, items: noStoreItems))
        }
        
        return result
    }
    
    // MARK: - Methods
    
    /// Groups items by category using store's categories or defaults.
    func groupByCategory(_ items: [Item], store: Store?) -> [(category: CategoryDef, items: [Item])] {
        let categoryList: [CategoryDef]
        if let store = store, !store.categories.isEmpty {
            categoryList = store.categories
        } else {
            categoryList = CategoryDefinitions.defaults
        }
        
        var categoryGroups: [String: [Item]] = [:]
        var otherItems: [Item] = []
        
        let categoryKeys = Set(categoryList.map { $0.key })
        
        for item in items {
            if let category = item.category, categoryKeys.contains(category) {
                categoryGroups[category, default: []].append(item)
            } else {
                otherItems.append(item)
            }
        }
        
        var result: [(category: CategoryDef, items: [Item])] = []
        for categoryDef in categoryList {
            if let groupItems = categoryGroups[categoryDef.key], !groupItems.isEmpty {
                result.append((category: categoryDef, items: groupItems))
            }
        }
        
        // Add "Other" group at the end if there are uncategorized items
        if !otherItems.isEmpty {
            let otherCategory = categoryList.first { $0.key == "other" }
                ?? CategoryDef(key: "other", name: "Other", color: "#9e9e9e", keywords: [])
            result.append((category: otherCategory, items: otherItems))
        }
        
        return result
    }
    
    // MARK: - Initialization
    
    init(listId: UUID, userId: UUID) {
        self.listId = listId
        self.userId = userId
        
        Task {
            await loadData()
            await setupRealtimeSubscriptions()
        }
    }
    
    // MARK: - Data Loading
    
    private func loadData() async {
        isLoading = true
        error = nil
        
        // Load cached data first for instant display
        if let cachedItems: CachedEntry<[Item]> = await OfflineCache.shared.load(forKey: "items-\(listId.uuidString)") {
            items = cachedItems.data
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
            isShowingCachedData = false
            
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
            await OfflineCache.shared.save(items, forKey: "items-\(listId.uuidString)")
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to refetch items: \(error.localizedDescription)")
        }
    }
    
    private func refetchStores() async {
        do {
            stores = try await StoreService.fetchStores(userId: userId)
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
            let newItem = try await ItemService.addItem(
                listId: listId,
                name: name,
                category: nil,
                storeId: storeId,
                stores: stores
            )
            items.append(newItem)
            
            let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
            try await HistoryService.addHistoryEntry(userId: userId, name: capitalizedName)
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to add item: \(error.localizedDescription)")
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
        imageUrl: String? = nil
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
                imageUrl: imageUrl
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
                imageUrl: item.imageUrl
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
        historyTask?.cancel()
        
        let itemsCh = itemsChannel
        let storesCh = storesChannel
        let historyCh = historyChannel
        
        Task {
            await itemsCh?.unsubscribe()
            await storesCh?.unsubscribe()
            await historyCh?.unsubscribe()
        }
    }
}

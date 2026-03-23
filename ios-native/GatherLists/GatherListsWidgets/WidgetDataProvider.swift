import Foundation
import WidgetKit

/// Provides data to widget timelines by reading from the SharedDataStore.
/// This actor ensures thread-safe access to cached list and item data.
actor WidgetDataProvider {
    static let shared = WidgetDataProvider()
    
    private init() {}
    
    /// Fetches all cached lists from the shared data store.
    func fetchLists() async -> [GatherList] {
        return await SharedDataStore.shared.loadLists() ?? []
    }
    
    /// Fetches items for a specific list from the shared data store.
    func fetchItems(listId: UUID) async -> [Item] {
        return await SharedDataStore.shared.loadItems(for: listId) ?? []
    }
    
    /// Fetches items with due dates, optionally filtered by list.
    /// - Parameter listId: If provided, only returns items from that list. If nil, returns items from all lists.
    /// - Returns: Items with non-nil due dates, sorted by due date ascending.
    func fetchDueItems(listId: UUID? = nil) async -> [Item] {
        if let listId = listId {
            let items = await fetchItems(listId: listId)
            return filterAndSortDueItems(items)
        }
        
        let lists = await fetchLists()
        var allDueItems: [Item] = []
        
        for list in lists {
            let items = await fetchItems(listId: list.id)
            allDueItems.append(contentsOf: filterAndSortDueItems(items))
        }
        
        return allDueItems.sorted { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    }
    
    /// Fetches unchecked items for a specific list.
    func fetchUncheckedItems(listId: UUID) async -> [Item] {
        let items = await fetchItems(listId: listId)
        return items.filter { !$0.isChecked }
    }
    
    /// Fetches the count of unchecked items for a list.
    func fetchUncheckedCount(listId: UUID) async -> Int {
        let items = await fetchItems(listId: listId)
        return items.filter { !$0.isChecked }.count
    }
    
    // MARK: - Private Helpers
    
    private func filterAndSortDueItems(_ items: [Item]) -> [Item] {
        items
            .filter { $0.dueDate != nil && !$0.isChecked }
            .sorted { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    }
}

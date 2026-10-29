import Foundation
import Observation
import Supabase
import Realtime
import WidgetKit

/// Manages item list state with realtime subscriptions for items, stores, and history.
@Observable
@MainActor
final class ListDetailViewModel {
    private final class RuntimeState {
        var itemsChannel: RealtimeChannelV2?
        var storesChannel: RealtimeChannelV2?
        var historyChannel: RealtimeChannelV2?
        var itemsTask: Task<Void, Never>?
        var storesTask: Task<Void, Never>?
        var sharedStoresChannel: RealtimeChannelV2?
        var sharedStoresTask: Task<Void, Never>?
        var historyTask: Task<Void, Never>?
        var pendingToggleTasks: [UUID: Task<Void, Never>] = [:]
        var pendingToggleOriginals: [UUID: Bool] = [:]
    }

    // Published state
    var items: [Item] = []
    var stores: [Store] = []
    var historyEntries: [HistoryEntry] = []
    var isLoading = false
    var error: String?
    var isShowingCachedData = false
    var cachedAt: Date?
    
    /// ID of the most recently added item, used for auto-scrolling.
    var lastAddedItemId: UUID?

    /// ID of an item whose quantity should briefly highlight — either merged up from a re-add, or
    /// a fresh add carrying a non-default quantity. Cleared automatically after the highlight plays.
    var quantityBumpedItemId: UUID?
    /// Whether the current highlight should also show the "Quantity updated" toast. True for a
    /// merge, false for a fresh add (highlight only).
    private(set) var quantityBumpShowsToast = false
    @ObservationIgnored private var quantityBumpTask: Task<Void, Never>?

    // List categories (resolved via CategoryService)
    private(set) var listCategories: [CategoryDef] = []
    
    // Identifiers
    private let listId: UUID
    private let userId: UUID
    private let ownerId: UUID
    let listType: String
    private var list: GatherList?
    @ObservationIgnored private let runtime = RuntimeState()

    /// The environment undo manager, injected by the view so crossing an item
    /// off (or on) can register a shake-to-undo action.
    @ObservationIgnored weak var undoManager: UndoManager?
    
    var isSharedList: Bool { ownerId != userId }
    
    var typeConfig: ListTypeConfig { ListTypes.getConfig(listType) }

    private(set) var pendingToggleStates: [UUID: Bool] = [:]
    
    // MARK: - Computed Properties
    
    /// Items where isChecked is false, preserving fetch order.
    var uncheckedItems: [Item] {
        items.filter { !$0.isChecked }
    }
    
    /// Items where isChecked is true, preserving fetch order.
    var checkedItems: [Item] {
        items.filter { $0.isChecked }
    }
    
    /// A typeahead suggestion from history: an item name plus the store it was
    /// saved with, so the same product bought at different stores stays distinct.
    struct HistorySuggestion: Identifiable, Hashable {
        let name: String
        let storeId: UUID?
        var id: String { "\(name.lowercased())|\(storeId?.uuidString ?? "")" }
    }

    /// Deduplicated (name, store) suggestions from historyEntries
    /// (case-insensitive on name), sorted alphabetically by name.
    var historySuggestions: [HistorySuggestion] {
        var seen = Set<String>()
        var result: [HistorySuggestion] = []
        for entry in historyEntries {
            let key = "\(entry.name.lowercased())|\(entry.storeId?.uuidString ?? "")"
            if !seen.contains(key) {
                seen.insert(key)
                result.append(HistorySuggestion(name: entry.name, storeId: entry.storeId))
            }
        }
        return result.sorted {
            let order = $0.name.localizedCaseInsensitiveCompare($1.name)
            if order != .orderedSame { return order == .orderedAscending }
            return storeName(for: $0.storeId) ?? "" < storeName(for: $1.storeId) ?? ""
        }
    }

    /// Resolves a store id to its name within this list's stores.
    func storeName(for storeId: UUID?) -> String? {
        guard let storeId else { return nil }
        return stores.first(where: { $0.id == storeId })?.name
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
        if let cachedStores: CachedEntry<[Store]> = await OfflineCache.shared.load(forKey: "stores-\(listId.uuidString)") {
            stores = cachedStores.data
        }
        if let cachedHistory: CachedEntry<[HistoryEntry]> = await OfflineCache.shared.load(forKey: "history-\(listId.uuidString)") {
            historyEntries = cachedHistory.data
        }
        
        // Fetch fresh data from Supabase
         do {
             async let fetchedItems = ItemService.fetchItems(listId: listId)
             async let fetchedStores = StoreService.fetchStores(listId: listId)
             async let fetchedHistory = HistoryService.fetchHistory(listId: listId)
             
             let (itemsResult, storesResult, historyResult) = try await (fetchedItems, fetchedStores, fetchedHistory)
             items = itemsResult
             stores = storesResult
             historyEntries = historyResult
             
             isShowingCachedData = false
             cachedAt = nil
             
             // Cache the fresh data
             await OfflineCache.shared.save(itemsResult, forKey: "items-\(listId.uuidString)")
             await OfflineCache.shared.save(storesResult, forKey: "stores-\(listId.uuidString)")
             await OfflineCache.shared.save(historyResult, forKey: "history-\(listId.uuidString)")
            
            // Sync items to shared container for widget access
            await SharedDataStore.shared.saveItems(itemsResult, for: listId)
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            self.error = error.localizedDescription
            isShowingCachedData = !items.isEmpty
            if let decodingError = error as? DecodingError {
                print("[ListDetailViewModel] Decoding error: \(decodingError)")
            } else {
                print("[ListDetailViewModel] Failed to load data: \(error.localizedDescription)")
            }
        }
        
        isLoading = false
    }
    
    // MARK: - Realtime Subscriptions
    
    private func setupRealtimeSubscriptions() async {
        guard runtime.itemsChannel == nil else { return }
        
        let client = SupabaseManager.shared.client
        
        // Channel for items
        let itemsCh = client.realtimeV2.channel("list-items-\(listId.uuidString)")
        runtime.itemsChannel = itemsCh
        
        let itemsChanges = itemsCh.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "items"
        )
        
        runtime.itemsTask = Task {
            do {
                try await itemsCh.subscribeWithError()
            } catch {
                print("[ListDetailViewModel] Items subscription failed: \(error.localizedDescription)")
                return
            }
            for await _ in itemsChanges {
                await refetchItems()
                clearStalePendingToggles()
            }
        }
        
        // Channel for stores
         let storesCh = client.realtimeV2.channel("list-stores-\(listId.uuidString)")
         runtime.storesChannel = storesCh
         
         let storesChanges = storesCh.postgresChange(
             AnyAction.self,
             schema: "public",
             table: "stores"
         )
         
         runtime.storesTask = Task {
             do {
                 try await storesCh.subscribeWithError()
             } catch {
                 print("[ListDetailViewModel] Stores subscription failed: \(error.localizedDescription)")
                 return
             }
             for await _ in storesChanges {
                 await refetchStores()
             }
         }
         
         // Channel for history
        let historyCh = client.realtimeV2.channel("list-history-\(listId.uuidString)")
        runtime.historyChannel = historyCh
        
        let historyChanges = historyCh.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "history",
            filter: .eq("user_id", value: userId)
        )
        
        runtime.historyTask = Task {
            do {
                try await historyCh.subscribeWithError()
            } catch {
                print("[ListDetailViewModel] History subscription failed: \(error.localizedDescription)")
                return
            }
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
            
            // Sync to shared container for widget access
            await SharedDataStore.shared.saveItems(items, for: listId)
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to refetch items: \(error.localizedDescription)")
        }
    }
    
     private func refetchStores() async {
         do {
             let result = try await StoreService.fetchStores(listId: listId)
             stores = result
             await OfflineCache.shared.save(stores, forKey: "stores-\(listId.uuidString)")
         } catch {
             self.error = error.localizedDescription
             print("[ListDetailViewModel] Failed to refetch stores: \(error.localizedDescription)")
         }
     }
    
    private func refetchHistory() async {
        do {
            historyEntries = try await HistoryService.fetchHistory(listId: listId)
            await OfflineCache.shared.save(historyEntries, forKey: "history-\(listId.uuidString)")
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
            // If the item is already on the list (unchecked), bump its quantity instead of
            // adding a duplicate row.
            if let existing = mergeTarget(name: name, storeId: storeId) {
                try await bumpQuantity(of: existing, by: 1)
                try await addMergeHistory(for: existing, name: name)
                return
            }

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
            lastAddedItemId = newItem.id

            let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
            try await HistoryService.addHistoryEntry(
                userId: userId, listId: listId, name: capitalizedName,
                imageUrl: newItem.imageUrl, category: newItem.category, storeId: newItem.storeId,
                quantity: newItem.quantity, price: newItem.price, unit: newItem.unit, note: newItem.note
            )
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to add item: \(error.localizedDescription)")
        }
    }

    /// An existing unchecked item to merge a re-added item into: same name (case-insensitive),
    /// preferring one in the same store. Returns nil when the item isn't already on the list.
    private func mergeTarget(name: String, storeId: UUID?) -> Item? {
        let key = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let matches = items.filter { !$0.isChecked && $0.name.lowercased() == key }
        guard !matches.isEmpty else { return nil }
        return matches.first(where: { $0.storeId == storeId }) ?? matches.first
    }

    /// Bumps an existing item's quantity, updates it locally, and flags it so the row's quantity
    /// highlights and the list scrolls to it.
    private func bumpQuantity(of existing: Item, by addQuantity: Int) async throws {
        let newQuantity = existing.quantity + addQuantity
        try await ItemService.updateItem(itemId: existing.id, quantity: newQuantity)
        if let index = items.firstIndex(where: { $0.id == existing.id }) {
            items[index].quantity = newQuantity
        }
        lastAddedItemId = existing.id
        flagQuantityBump(existing.id, showToast: true)
    }

    /// Flags an item's quantity for the brief highlight and schedules the flag to clear. `showToast`
    /// is read by the view: true for a merge (also shows the "Quantity updated" toast), false for a
    /// fresh add carrying a non-default quantity (highlight only).
    private func flagQuantityBump(_ id: UUID, showToast: Bool) {
        quantityBumpShowsToast = showToast
        quantityBumpedItemId = id
        quantityBumpTask?.cancel()
        quantityBumpTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1.1))
            guard !Task.isCancelled else { return }
            self?.quantityBumpedItemId = nil
        }
    }

    /// Records the re-add in history, mirroring the merged item's reusable fields.
    private func addMergeHistory(for item: Item, name: String) async throws {
        let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
        try await HistoryService.addHistoryEntry(
            userId: userId, listId: listId, name: capitalizedName,
            imageUrl: item.imageUrl, category: item.category, storeId: item.storeId,
            quantity: item.quantity, price: item.price, unit: item.unit, note: item.note
        )
    }

    /// Most recent history record for a (name, store) pair on this list — the
    /// item's mirrored "template". history is ordered oldest-first, so the last
    /// match is newest. Sourced from history (not the live items table) so reuse
    /// survives the item being removed and works on shared lists.
    private func latestHistoryEntry(for name: String, storeId: UUID?) -> HistoryEntry? {
        let key = name.lowercased()
        return historyEntries.last(where: { $0.name.lowercased() == key && $0.storeId == storeId })
    }

    /// Adds an item from a history suggestion, restoring the item's latest saved
    /// fields from the template matching the suggestion's name and store.
    func addItemFromSuggestion(name: String, storeId: UUID?, fallbackStoreId: UUID?) async {
        do {
            let template = latestHistoryEntry(for: name, storeId: storeId)
            // Reuse the same merge behavior so a suggestion for an item already on the list bumps
            // its quantity instead of duplicating it.
            if let existing = mergeTarget(name: name, storeId: template?.storeId ?? storeId ?? fallbackStoreId) {
                try await bumpQuantity(of: existing, by: template?.quantity ?? 1)
                try await addMergeHistory(for: existing, name: name)
                return
            }
            let rsvpDefault: String? = listType == "guest_list" ? "invited" : nil
            let newItem = try await ItemService.addItem(
                listId: listId,
                name: name,
                note: template?.note,
                category: template?.category,
                storeId: template?.storeId ?? storeId ?? fallbackStoreId,
                listCategories: listCategories,
                listType: listType,
                quantity: template?.quantity ?? 1,
                price: template?.price,
                imageUrl: template?.imageUrl,
                unit: template?.unit ?? "each",
                rsvpStatus: rsvpDefault
            )
            items.append(newItem)
            lastAddedItemId = newItem.id
            // A suggestion can restore a saved quantity; flash it so a non-default amount is noticed.
            if newItem.quantity != 1 {
                flagQuantityBump(newItem.id, showToast: false)
            }

            let capitalizedName = name.prefix(1).uppercased() + name.dropFirst()
            try await HistoryService.addHistoryEntry(
                userId: userId, listId: listId, name: capitalizedName,
                imageUrl: newItem.imageUrl, category: newItem.category, storeId: newItem.storeId,
                quantity: newItem.quantity, price: newItem.price, unit: newItem.unit, note: newItem.note
            )
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to add item from suggestion: \(error.localizedDescription)")
        }
    }
    
    func toggleItem(_ item: Item) async {
        do {
            let newChecked = !item.isChecked
            try await ItemService.toggleItem(itemId: item.id, isChecked: newChecked)
            if let index = items.firstIndex(where: { $0.id == item.id }) {
                items[index].isChecked = newChecked
            }
            registerToggleUndo(item: item, newChecked: newChecked)
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to toggle item: \(error.localizedDescription)")
        }
    }

    /// Returns the checked state used for rendering while a delayed toggle is pending.
    func effectiveIsChecked(for item: Item) -> Bool {
        pendingToggleStates[item.id] ?? item.isChecked
    }

    /// Schedules a delayed item toggle, or cancels the pending toggle if one already exists.
    func scheduleToggleItem(_ item: Item) {
        if runtime.pendingToggleTasks[item.id] != nil {
            clearPendingToggle(itemId: item.id)
            return
        }

        pendingToggleStates[item.id] = !item.isChecked
        runtime.pendingToggleOriginals[item.id] = item.isChecked

        let itemId = item.id
        runtime.pendingToggleTasks[itemId] = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(1500))
            guard !Task.isCancelled else { return }
            guard let self else { return }
            await self.commitPendingToggle(itemId: itemId)
        }
    }

    private func commitPendingToggle(itemId: UUID) async {
        guard let index = items.firstIndex(where: { $0.id == itemId }) else {
            clearPendingToggle(itemId: itemId)
            return
        }

        let currentItem = items[index]
        let nextChecked = pendingToggleStates[itemId] ?? !currentItem.isChecked

        do {
            try await ItemService.toggleItem(itemId: itemId, isChecked: nextChecked)
            if let updatedIndex = items.firstIndex(where: { $0.id == itemId }) {
                items[updatedIndex].isChecked = nextChecked
            }
            registerToggleUndo(item: currentItem, newChecked: nextChecked)
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to commit pending toggle for item \(itemId): \(error.localizedDescription)")
        }

        clearPendingToggle(itemId: itemId)
    }

    private func clearPendingToggle(itemId: UUID) {
        runtime.pendingToggleTasks[itemId]?.cancel()
        runtime.pendingToggleTasks.removeValue(forKey: itemId)
        runtime.pendingToggleOriginals.removeValue(forKey: itemId)
        pendingToggleStates.removeValue(forKey: itemId)
    }

    /// Clears pending toggles whose item was changed remotely (or removed) while
    /// the delay was running. A realtime echo of one item's own commit must not
    /// cancel other items' still-pending toggles.
    private func clearStalePendingToggles() {
        for (itemId, originalChecked) in runtime.pendingToggleOriginals {
            let currentItem = items.first(where: { $0.id == itemId })
            if let currentItem, currentItem.isChecked == originalChecked {
                continue
            }
            clearPendingToggle(itemId: itemId)
        }
    }

    /// Sets an item's checked state to an explicit value. Used by shake-to-undo
    /// to reverse a cross-off without depending on the current state.
    func setChecked(_ itemId: UUID, to checked: Bool) async {
        do {
            try await ItemService.toggleItem(itemId: itemId, isChecked: checked)
            if let index = items.firstIndex(where: { $0.id == itemId }) {
                items[index].isChecked = checked
            }
        } catch {
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to set checked for item \(itemId): \(error.localizedDescription)")
        }
    }

    /// Registers a shake-to-undo action that reverses crossing an item off (or on).
    /// Called once the toggle has actually committed so a cancelled pending
    /// toggle never leaves a stale undo on the stack.
    private func registerToggleUndo(item: Item, newChecked: Bool) {
        guard let undoManager else { return }
        let itemId = item.id
        let previous = !newChecked
        undoManager.registerUndo(withTarget: UndoHelper.shared) { [weak self] _ in
            Task { @MainActor in
                await self?.setChecked(itemId, to: previous)
            }
        }
        undoManager.setActionName(newChecked ? "Cross Off \(item.name)" : "Uncross \(item.name)")
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
        note: String? = nil,
        clearNote: Bool = false,
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
        clearRsvpStatus: Bool = false,
        dueDate: Date? = nil,
        clearDueDate: Bool = false,
        recurrenceRule: RecurrenceRule? = nil,
        clearRecurrenceRule: Bool = false,
        reminderDaysBefore: Int? = nil,
        clearReminderDaysBefore: Bool = false
    ) async {
        do {
            try await ItemService.updateItem(
                itemId: itemId,
                name: name,
                note: note,
                clearNote: clearNote,
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
                clearRsvpStatus: clearRsvpStatus,
                dueDate: dueDate,
                clearDueDate: clearDueDate,
                recurrenceRule: recurrenceRule,
                clearRecurrenceRule: clearRecurrenceRule,
                reminderDaysBefore: reminderDaysBefore,
                clearReminderDaysBefore: clearReminderDaysBefore
            )
            
            // Update local state for instant feedback
            if let index = items.firstIndex(where: { $0.id == itemId }) {
                if let name = name { items[index].name = name }
                if clearNote {
                    items[index].note = nil
                } else if let note = note {
                    items[index].note = note
                }
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
                if clearDueDate {
                    items[index].dueDate = nil
                } else if let dueDate = dueDate {
                    items[index].dueDate = dueDate
                }
                if clearRecurrenceRule {
                    items[index].recurrenceRule = nil
                } else if let recurrenceRule = recurrenceRule {
                    items[index].recurrenceRule = recurrenceRule
                }
                if clearReminderDaysBefore {
                    items[index].reminderDaysBefore = nil
                } else if let reminderDaysBefore = reminderDaysBefore {
                    items[index].reminderDaysBefore = reminderDaysBefore
                }
            }

            // Item -> history sync (rename, image, and every mirrored field) is
            // handled by a DB trigger; see 20260803120000_mirror_items_to_history.sql.
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

    func resetRsvp() async -> Int? {
        guard ownerId == userId else {
            error = "Only the list owner can reset RSVP statuses"
            print("[ListDetailViewModel] Failed to reset RSVP: Only the list owner can reset RSVP statuses")
            return nil
        }

        let affectedIds: Set<UUID> = Set(items.filter { ($0.rsvpStatus ?? "not_invited") != "not_invited" }.map { $0.id })
        guard !affectedIds.isEmpty else { return 0 }

        let snapshot: [UUID: String?] = Dictionary(
            uniqueKeysWithValues: items
                .filter { affectedIds.contains($0.id) }
                .map { ($0.id, $0.rsvpStatus) }
        )

        for index in items.indices where affectedIds.contains(items[index].id) {
            items[index].rsvpStatus = "not_invited"
        }

        do {
            let count = try await ItemService.resetRsvpStatuses(listId: listId)
            return count
        } catch {
            for (id, originalStatus) in snapshot {
                guard let index = items.firstIndex(where: { $0.id == id }) else { continue }
                items[index].rsvpStatus = originalStatus
            }
            self.error = error.localizedDescription
            print("[ListDetailViewModel] Failed to reset RSVP: \(error.localizedDescription)")
            return nil
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
        for task in runtime.pendingToggleTasks.values {
            task.cancel()
        }

        runtime.itemsTask?.cancel()
        runtime.storesTask?.cancel()
        runtime.sharedStoresTask?.cancel()
        runtime.historyTask?.cancel()
        
        let itemsCh = runtime.itemsChannel
        let storesCh = runtime.storesChannel
        let sharedStoresCh = runtime.sharedStoresChannel
        let historyCh = runtime.historyChannel
        
        Task {
            await itemsCh?.unsubscribe()
            await storesCh?.unsubscribe()
            await sharedStoresCh?.unsubscribe()
            await historyCh?.unsubscribe()
        }
    }
}

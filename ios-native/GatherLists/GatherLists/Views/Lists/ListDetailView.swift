import SwiftUI

/// Detail view for a single list showing items grouped by store and category.
struct ListDetailView: View {
    let list: GatherList
    let viewModel: ListViewModel
    let isOwned: Bool
    
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.undoManager) private var undoManager
    
    @State private var detailViewModel: ListDetailViewModel?
    @State private var shareCount: Int = 0
    @State private var isLoadingShares = false
    @State private var itemName: String = ""
    @State private var selectedStoreId: UUID?
    @FocusState private var isInputFocused: Bool
    
    @State private var collapsedStores: Set<String> = []
    @State private var showClearCheckedAlert = false
    
    // Context menu edit states
    @State private var editingItem: Item?
    @State private var showEditNameAlert = false
    @State private var editNameText = ""
    @State private var showEditPriceAlert = false
    @State private var editPriceText = ""
    @State private var showCustomQuantityAlert = false
    @State private var customQuantityText = ""
    
    // Image picker state
    @State private var imagePickerItem: Item?
    
    // Edit sheet state
    @State private var editSheetItem: Item?
    
    private let unassignedKey = "__unassigned__"
    
    private var navigationTitle: String {
        if let emoji = list.emoji, !emoji.isEmpty {
            return "\(emoji) \(list.name)"
        }
        return list.name
    }
    
    private var listColor: Color {
        Color(hex: list.color)
    }
    
    private var isItemNameEmpty: Bool {
        itemName.trimmingCharacters(in: .whitespaces).isEmpty
    }
    
    private var filteredSuggestions: [String] {
        guard !isItemNameEmpty, let vm = detailViewModel else { return [] }
        let query = itemName.lowercased()
        return vm.uniqueHistoryNames
            .filter { $0.lowercased().contains(query) }
            .prefix(5)
            .map { $0 }
    }
    
    private var showSuggestions: Bool {
        isInputFocused && !filteredSuggestions.isEmpty
    }
    
    private var aiSuggestions: [ItemSuggestion] {
        SuggestionEngine.getSuggestions(
            history: detailViewModel?.historyEntries ?? [],
            currentItems: detailViewModel?.uncheckedItems ?? []
        )
    }
    
    private var showAISuggestions: Bool {
        !(detailViewModel?.historyEntries.isEmpty ?? true) && !aiSuggestions.isEmpty
    }
    
    var body: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                if detailViewModel?.isShowingCachedData == true {
                    CachedDataBanner(cachedAt: detailViewModel?.cachedAt)
                }
                
                if detailViewModel == nil || detailViewModel?.isLoading == true {
                    loadingState
                } else if detailViewModel?.items.isEmpty ?? true {
                    emptyState
                } else {
                    itemListContent
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            VStack(spacing: 0) {
                if showSuggestions {
                    suggestionsOverlay
                }
                addItemToolbar
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(listColor, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                shareStatusIndicator
            }
        }
        .alert("Clear checked items?", isPresented: $showClearCheckedAlert) {
            Button("Cancel", role: .cancel) { }
            Button("Clear", role: .destructive) {
                Task {
                    let cleared = await detailViewModel?.clearChecked() ?? []
                    if !cleared.isEmpty {
                        registerClearCheckedUndo(for: cleared)
                    }
                }
            }
        } message: {
            Text("This will permanently delete all checked items.")
        }
        .alert("Edit Name", isPresented: $showEditNameAlert) {
            TextField("Item name", text: $editNameText)
            Button("Cancel", role: .cancel) { }
            Button("Save") {
                guard let item = editingItem,
                      !editNameText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                Task {
                    await detailViewModel?.updateItem(
                        item.id,
                        name: editNameText.trimmingCharacters(in: .whitespaces)
                    )
                }
            }
        }
        .alert("Set Price", isPresented: $showEditPriceAlert) {
            TextField("Price", text: $editPriceText)
                .keyboardType(.decimalPad)
            Button("Cancel", role: .cancel) { }
            Button("Save") {
                guard let item = editingItem else { return }
                if let price = Decimal(string: editPriceText) {
                    Task {
                        await detailViewModel?.updateItem(item.id, price: price)
                    }
                }
            }
        }
        .alert("Custom Quantity", isPresented: $showCustomQuantityAlert) {
            TextField("Quantity", text: $customQuantityText)
                .keyboardType(.numberPad)
            Button("Cancel", role: .cancel) { }
            Button("Save") {
                guard let item = editingItem,
                      let qty = Int(customQuantityText),
                      qty >= 1 else { return }
                Task {
                    await detailViewModel?.updateItem(item.id, quantity: qty)
                }
            }
        }
        .sheet(item: $imagePickerItem) { item in
            ItemImagePickerSheet(
                item: item,
                userId: authViewModel.currentUser?.id ?? UUID(),
                onImageUrlSet: { url in
                    if let index = detailViewModel?.items.firstIndex(where: { $0.id == item.id }) {
                        detailViewModel?.items[index].imageUrl = url
                    }
                },
                onImageRemoved: {
                    if let index = detailViewModel?.items.firstIndex(where: { $0.id == item.id }) {
                        detailViewModel?.items[index].imageUrl = nil
                    }
                }
            )
        }
        .sheet(item: $editSheetItem) { item in
            EditItemSheet(
                item: item,
                stores: detailViewModel?.stores ?? [],
                onSave: { name, quantity, price, storeId, clearStoreId, category in
                    Task {
                        await detailViewModel?.updateItem(
                            item.id,
                            name: name,
                            category: category,
                            storeId: storeId,
                            clearStoreId: clearStoreId,
                            quantity: quantity,
                            price: price,
                            clearPrice: item.price != nil && price == nil
                        )
                    }
                },
                onImageTap: {
                    imagePickerItem = item
                }
            )
        }
        .task {
            await initializeDetailViewModel()
            await loadShareInfo()
        }
    }
    
    // MARK: - Loading State
    
    private var loadingState: some View {
        VStack {
            ProgressView()
                .scaleEffect(1.2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Empty State
    
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "cart")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("Your list is empty")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Add items below")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Item List Content
    
    private var itemListContent: some View {
        List {
            uncheckedItemsSection
            
            if let vm = detailViewModel, !vm.checkedItems.isEmpty {
                checkedItemsSection
            }
        }
        .listStyle(.plain)
        .contentMargins(.bottom, 80, for: .scrollContent)
        .refreshable {
            await detailViewModel?.refresh()
        }
    }
    
    // MARK: - Unchecked Items Section
    
    @ViewBuilder
    private var uncheckedItemsSection: some View {
        if let vm = detailViewModel {
            let groupedByStore = vm.groupedByStore
            let hasStores = vm.stores.count > 0
            
            ForEach(Array(groupedByStore.enumerated()), id: \.offset) { index, group in
                let store = group.store
                let items = group.items
                let storeKey = store?.id.uuidString ?? unassignedKey
                let isCollapsed = collapsedStores.contains(storeKey)
                
                if hasStores {
                    storeHeader(store: store, itemCount: items.count, isCollapsed: isCollapsed) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if isCollapsed {
                                collapsedStores.remove(storeKey)
                            } else {
                                collapsedStores.insert(storeKey)
                            }
                        }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    
                    if !isCollapsed {
                        categoryGroupsView(items: items, store: store)
                    }
                } else {
                    categoryGroupsView(items: items, store: nil)
                }
            }
        }
    }
    
    // MARK: - Store Header
    
    private func storeHeader(
        store: Store?,
        itemCount: Int,
        isCollapsed: Bool,
        onTap: @escaping () -> Void
    ) -> some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .rotationEffect(.degrees(isCollapsed ? 0 : 90))
                
                Circle()
                    .fill(Color(hex: store?.color ?? "#9e9e9e"))
                    .frame(width: 10, height: 10)
                
                Text(store?.name ?? "Unassigned")
                    .font(.headline)
                    .foregroundStyle(.primary)
                
                Text("(\(itemCount))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemGroupedBackground))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
    
    // MARK: - Category Groups View
    
    private func categoryGroupsView(items: [Item], store: Store?) -> some View {
        let categoryGroups = detailViewModel?.groupByCategory(items, store: store) ?? []
        
        return ForEach(Array(categoryGroups.enumerated()), id: \.offset) { index, group in
            let category = group.category
            let categoryItems = group.items
            
            categoryHeader(category: category, itemCount: categoryItems.count)
                .listRowInsets(EdgeInsets())
                .listRowSeparator(.hidden)
                .listRowBackground(Color.clear)
            
            ForEach(categoryItems) { item in
                itemRow(item: item, isChecked: false)
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            Task {
                                if await detailViewModel?.deleteItem(item) != nil {
                                    registerDeleteUndo(for: item)
                                }
                            }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
            }
        }
    }
    
    // MARK: - Category Header
    
    private func categoryHeader(category: CategoryDef, itemCount: Int) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color(hex: category.color))
                .frame(width: 8, height: 8)
            
            Text(category.name)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
            
            Text("(\(itemCount))")
                .font(.caption)
                .foregroundStyle(.tertiary)
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .padding(.leading, 20)
    }
    
    // MARK: - Item Row
    
    private func itemRow(item: Item, isChecked: Bool) -> some View {
        HStack(spacing: 0) {
            // Main row content
            HStack(spacing: 12) {
                Button {
                    Task {
                        await detailViewModel?.toggleItem(item)
                    }
                } label: {
                    Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(isChecked ? .secondary : listColor)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                
                itemThumbnail(item: item)
                
                Text(item.name)
                    .strikethrough(isChecked)
                    .foregroundStyle(isChecked ? .secondary : .primary)
                
                if item.quantity > 1 {
                    Text("×\(item.quantity)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(Color(.systemGray))
                        )
                }
                
                Spacer()
                
                if let price = item.price {
                    Text(formatPrice(price))
                        .font(.subheadline)
                        .foregroundStyle(isChecked ? .tertiary : .secondary)
                }
            }
            .padding(.leading, 28)
            .padding(.trailing, 12)
            .padding(.vertical, 10)
            
            // Vertical separator
            Rectangle()
                .fill(Color(.separator))
                .frame(width: 1)
                .padding(.vertical, 6)
            
            // Edit button zone
            Button {
                editSheetItem = item
            } label: {
                Image(systemName: "pencil")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(width: 44)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .background(Color(.secondarySystemBackground))
        }
        .padding(.horizontal, 16)
        .background(Color(.systemBackground))
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            Task {
                await detailViewModel?.toggleItem(item)
            }
        }
        .contextMenu {
            itemContextMenu(item: item)
        }
    }
    
    // MARK: - Item Thumbnail
    
    @ViewBuilder
    private func itemThumbnail(item: Item) -> some View {
        if let imageUrl = item.imageUrl, !imageUrl.isEmpty, let url = URL(string: imageUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color(.systemGray5))
                        .overlay {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                case .empty:
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color(.systemGray5))
                @unknown default:
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color(.systemGray5))
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .onTapGesture {
                imagePickerItem = item
            }
        } else {
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(.systemGray5))
                .frame(width: 36, height: 36)
                .overlay {
                    Image(systemName: "plus")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .onTapGesture {
                    imagePickerItem = item
                }
        }
    }
    
    // MARK: - Item Context Menu
    
    @ViewBuilder
    private func itemContextMenu(item: Item) -> some View {
        // Edit Name
        Button {
            editingItem = item
            editNameText = item.name
            showEditNameAlert = true
        } label: {
            Label("Edit Name", systemImage: "pencil")
        }
        
        // Quantity submenu
        Menu {
            ForEach(1...10, id: \.self) { qty in
                Button {
                    Task {
                        await detailViewModel?.updateItem(item.id, quantity: qty)
                    }
                } label: {
                    HStack {
                        Text("\(qty)")
                        if item.quantity == qty {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
            
            Divider()
            
            Button {
                editingItem = item
                customQuantityText = "\(item.quantity)"
                showCustomQuantityAlert = true
            } label: {
                Label("Custom...", systemImage: "number")
            }
        } label: {
            Label("Quantity: \(item.quantity)", systemImage: "number.circle")
        }
        
        // Price submenu
        Menu {
            Button {
                editingItem = item
                editPriceText = item.price.map { "\($0)" } ?? ""
                showEditPriceAlert = true
            } label: {
                Label("Set Price...", systemImage: "dollarsign.circle")
            }
            
            if item.price != nil {
                Button(role: .destructive) {
                    Task {
                        await detailViewModel?.updateItem(item.id, clearPrice: true)
                    }
                } label: {
                    Label("Remove Price", systemImage: "xmark.circle")
                }
            }
        } label: {
            let priceLabel = item.price.map { formatPrice($0) } ?? "None"
            Label("Price: \(priceLabel)", systemImage: "dollarsign.circle")
        }
        
        // Store submenu
        Menu {
            Button {
                Task {
                    await detailViewModel?.updateItem(item.id, clearStoreId: true)
                }
            } label: {
                HStack {
                    Text("No store")
                    if item.storeId == nil {
                        Image(systemName: "checkmark")
                    }
                }
            }
            
            Divider()
            
            ForEach(detailViewModel?.stores ?? []) { store in
                Button {
                    Task {
                        await detailViewModel?.updateItem(item.id, storeId: store.id)
                    }
                } label: {
                    HStack {
                        Text(store.name)
                        if item.storeId == store.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            let storeName: String = {
                if let storeId = item.storeId,
                   let store = detailViewModel?.stores.first(where: { $0.id == storeId }) {
                    return store.name
                }
                return "None"
            }()
            Label("Store: \(storeName)", systemImage: "storefront")
        }
        
        // Category submenu
        Menu {
            let categories = categoriesForItem(item)
            
            Button {
                Task {
                    await detailViewModel?.updateItem(item.id, category: "other")
                }
            } label: {
                HStack {
                    Text("No category")
                    if item.category == nil || item.category == "other" {
                        Image(systemName: "checkmark")
                    }
                }
            }
            
            Divider()
            
            ForEach(categories.filter { $0.key != "other" }, id: \.key) { cat in
                Button {
                    Task {
                        await detailViewModel?.updateItem(item.id, category: cat.key)
                    }
                } label: {
                    HStack {
                        Text(cat.name)
                        if item.category == cat.key {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            let categoryName = categoryNameForItem(item)
            Label("Category: \(categoryName)", systemImage: "tag")
        }
        
        // Image actions
        Button {
            imagePickerItem = item
        } label: {
            if item.imageUrl != nil && !(item.imageUrl?.isEmpty ?? true) {
                Label("Change Image", systemImage: "photo")
            } else {
                Label("Set Image", systemImage: "photo")
            }
        }
        
        if item.imageUrl != nil && !(item.imageUrl?.isEmpty ?? true) {
            Button(role: .destructive) {
                Task {
                    guard let userId = authViewModel.currentUser?.id else { return }
                    try? await StorageService.deleteItemImage(userId: userId, itemId: item.id)
                    if let index = detailViewModel?.items.firstIndex(where: { $0.id == item.id }) {
                        detailViewModel?.items[index].imageUrl = nil
                    }
                }
            } label: {
                Label("Remove Image", systemImage: "xmark.circle")
            }
        }
        
        Divider()
        
        // Delete
        Button(role: .destructive) {
            Task {
                if await detailViewModel?.deleteItem(item) != nil {
                    registerDeleteUndo(for: item)
                }
            }
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }
    
    // MARK: - Context Menu Helpers
    
    private func categoriesForItem(_ item: Item) -> [CategoryDef] {
        if let storeId = item.storeId,
           let store = detailViewModel?.stores.first(where: { $0.id == storeId }),
           !store.categories.isEmpty {
            return store.categories
        }
        return CategoryDefinitions.defaults
    }
    
    private func categoryNameForItem(_ item: Item) -> String {
        let categories = categoriesForItem(item)
        if let categoryKey = item.category,
           let cat = categories.first(where: { $0.key == categoryKey }) {
            return cat.name
        }
        return "None"
    }
    
    // MARK: - Checked Items Section
    
    @ViewBuilder
    private var checkedItemsSection: some View {
        if let vm = detailViewModel {
            let checkedItems = vm.checkedItems
            
            HStack {
                Text("Checked (\(checkedItems.count))")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                Button("Clear checked") {
                    showClearCheckedAlert = true
                }
                .font(.subheadline)
                .foregroundStyle(.red)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .padding(.top, 8)
            .background(Color(.secondarySystemGroupedBackground))
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            
            ForEach(checkedItems) { item in
                itemRow(item: item, isChecked: true)
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            Task {
                                if await detailViewModel?.deleteItem(item) != nil {
                                    registerDeleteUndo(for: item)
                                }
                            }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
            }
        }
    }
    
    // MARK: - Price Formatting
    
    private func formatPrice(_ price: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: price as NSDecimalNumber) ?? "$\(price)"
    }
    
    // MARK: - Share Status Indicator
    
    @ViewBuilder
    private var shareStatusIndicator: some View {
        if isLoadingShares {
            ProgressView()
                .tint(.white)
        } else if isOwned {
            if shareCount > 0 {
                Label {
                    Text("\(shareCount)")
                } icon: {
                    Image(systemName: "person.2.fill")
                }
                .font(.subheadline)
                .foregroundStyle(.white)
            }
        } else {
            Label {
                Text("Shared")
            } icon: {
                Image(systemName: "person.fill")
            }
            .font(.subheadline)
            .foregroundStyle(.white)
        }
    }
    
    // MARK: - Suggestions Overlay
    
    private var suggestionsOverlay: some View {
        VStack(spacing: 0) {
            ForEach(filteredSuggestions, id: \.self) { suggestion in
                Button {
                    let storeId = selectedStoreId
                    itemName = ""
                    isInputFocused = true
                    Task {
                        await detailViewModel?.addItemFromSuggestion(name: suggestion, fallbackStoreId: storeId)
                    }
                } label: {
                    HStack {
                        Image(systemName: "clock.arrow.circlepath")
                            .foregroundStyle(.secondary)
                            .font(.subheadline)
                        Text(suggestion)
                            .foregroundStyle(.primary)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                
                if suggestion != filteredSuggestions.last {
                    Divider()
                        .padding(.leading, 44)
                }
            }
        }
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }
    
    // MARK: - Add Item Toolbar
    
    private var addItemToolbar: some View {
        HStack(spacing: 12) {
            if let vm = detailViewModel, !vm.stores.isEmpty {
                storePicker(stores: vm.stores)
            }
            
            TextField("Add an item...", text: $itemName)
                .textFieldStyle(.plain)
                .focused($isInputFocused)
                .submitLabel(.done)
                .onSubmit {
                    handleAddItem()
                }
            
            Button {
                handleAddItem()
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.title2)
                    .foregroundStyle(isItemNameEmpty ? Color(.tertiaryLabel) : listColor)
            }
            .disabled(isItemNameEmpty)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }
    
    // MARK: - Store Picker
    
    private func storePicker(stores: [Store]) -> some View {
        Menu {
            Button {
                selectedStoreId = nil
            } label: {
                HStack {
                    Text("No store")
                    if selectedStoreId == nil {
                        Image(systemName: "checkmark")
                    }
                }
            }
            
            Divider()
            
            ForEach(stores) { store in
                Button {
                    selectedStoreId = store.id
                } label: {
                    HStack {
                        Text(store.name)
                        if selectedStoreId == store.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
        } label: {
            if let storeId = selectedStoreId,
               let store = stores.first(where: { $0.id == storeId }) {
                let storeColor = store.color.flatMap { Color(hex: $0) } ?? Color.secondary
                VStack(spacing: 2) {
                    Image(systemName: "storefront")
                        .font(.subheadline)
                        .foregroundStyle(storeColor)
                    Text(store.name)
                        .font(.caption2)
                        .foregroundStyle(storeColor)
                        .lineLimit(1)
                }
            } else {
                Image(systemName: "storefront")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .menuStyle(.borderlessButton)
    }
    
    // MARK: - Actions
    
    private func handleAddItem() {
        let trimmedName = itemName.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        
        Task {
            await detailViewModel?.addItem(name: trimmedName, storeId: selectedStoreId)
            itemName = ""
            isInputFocused = true
        }
    }
    
    // MARK: - Data Loading
    
    private func initializeDetailViewModel() async {
        guard let userId = authViewModel.currentUser?.id else {
            print("[ListDetailView] No authenticated user, cannot create detail view model")
            return
        }
        detailViewModel = ListDetailViewModel(listId: list.id, userId: userId, ownerId: list.ownerId)
    }
    
    private func loadShareInfo() async {
        guard isOwned else { return }
        isLoadingShares = true
        do {
            let shares = try await ListService.fetchSharesForList(listId: list.id)
            shareCount = shares.count
        } catch {
            print("[ListDetailView] Failed to load shares: \(error.localizedDescription)")
        }
        isLoadingShares = false
    }
    
    // MARK: - Undo Registration
    
    private func registerDeleteUndo(for item: Item) {
        guard let undoManager else { return }
        undoManager.registerUndo(withTarget: UndoHelper.shared) { _ in
            Task { @MainActor in
                await self.detailViewModel?.restoreItem(item)
            }
        }
        undoManager.setActionName("Delete \(item.name)")
    }
    
    private func registerClearCheckedUndo(for items: [Item]) {
        guard let undoManager, !items.isEmpty else { return }
        undoManager.registerUndo(withTarget: UndoHelper.shared) { _ in
            Task { @MainActor in
                await self.detailViewModel?.restoreItems(items)
            }
        }
        let count = items.count
        undoManager.setActionName("Clear \(count) Checked Item\(count == 1 ? "" : "s")")
    }
}

/// NSObject target for UndoManager since SwiftUI views are value types.
final class UndoHelper: NSObject {
    static let shared = UndoHelper()
}

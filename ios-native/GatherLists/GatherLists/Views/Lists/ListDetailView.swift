import SwiftUI
import Supabase
import Realtime

/// Detail view for a single list showing items grouped by store and category.
struct ListDetailView: View {
    let list: GatherList
    let viewModel: ListViewModel
    let isOwned: Bool
    let shareSortConfig: [String]?
    
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
    
    // Notification sheet state
    @State private var showNotificationSheet = false
    @State private var hasNotificationsEnabled = false
    
    // Share sheet state
    @State private var showShareSheet = false
    
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
    
    // Sort preferences
    @State private var userPreferences: UserPreferences?
    @State private var activeSortConfig: [SortLevel] = SortPipeline.systemDefault
    @State private var preferencesTask: Task<Void, Never>?
    @State private var showSortSheet = false
    
    // Change type state
    @State private var showChangeTypeSheet = false
    @State private var pendingTypeChange: String?
    @State private var pendingCategories: [CategoryDef]?
    @State private var showTypeChangeConfirm = false
    @State private var typeChangeMessage: String = ""
    
    // Auto-scroll target after adding item
    @State private var scrollTarget: UUID?
    
    private var navigationTitle: String {
        if let emoji = list.emoji, !emoji.isEmpty {
            return "\(emoji) \(list.name)"
        }
        return list.name
    }
    
    private var listColor: Color {
        Color(hex: list.color)
    }
    
    private var isSharedList: Bool {
        !isOwned || shareCount > 0
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
            currentItems: detailViewModel?.uncheckedItems ?? [],
            listType: list.type,
            listCategories: detailViewModel?.listCategories
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
            ToolbarItemGroup(placement: .topBarTrailing) {
                if isSharedList {
                    Button {
                        showNotificationSheet = true
                    } label: {
                        Image(systemName: hasNotificationsEnabled ? "bell.fill" : "bell")
                    }
                }
                sortMenu
                if isOwned {
                    listOptionsMenu
                }
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
                listCategories: detailViewModel?.listCategories ?? [],
                listType: detailViewModel?.listType ?? "grocery",
                onSave: { name, quantity, price, storeId, clearStoreId, category, unit, rsvpStatus, clearRsvpStatus, dueDate in
                    Task {
                        let clearDueDate = item.dueDate != nil && dueDate == nil
                        await detailViewModel?.updateItem(
                            item.id,
                            name: name,
                            category: category,
                            storeId: storeId,
                            clearStoreId: clearStoreId,
                            quantity: quantity,
                            price: price,
                            clearPrice: item.price != nil && price == nil,
                            unit: unit,
                            rsvpStatus: rsvpStatus,
                            clearRsvpStatus: clearRsvpStatus,
                            dueDate: dueDate,
                            clearDueDate: clearDueDate
                        )
                    }
                },
                onImageTap: {
                    imagePickerItem = item
                }
            )
        }
        .sheet(isPresented: $showNotificationSheet) {
            ListNotificationSheet(list: list)
        }
        .sheet(isPresented: $showShareSheet) {
            if isOwned {
                ShareListSheet(
                    list: list,
                    viewModel: viewModel,
                    ownerEmail: authViewModel.currentUser?.email ?? ""
                )
            } else {
                CollaboratorsInfoSheet(list: list, currentUserId: authViewModel.currentUser?.id)
            }
        }
        .task {
            await initializeDetailViewModel()
            await loadShareInfo()
            await loadSortPreferences()
            await subscribeToPreferences()
            await loadNotificationStatus()
        }
        .onChange(of: showNotificationSheet) { _, isShowing in
            if !isShowing {
                Task {
                    await loadNotificationStatus()
                }
            }
        }
        .onDisappear {
            preferencesTask?.cancel()
            preferencesTask = nil
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
            ListTypeIconView(typeId: list.type, size: 56)
                .opacity(0.5)
            
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
    
    private var rsvpSummary: (confirmed: Int, maybe: Int, declined: Int, invited: Int, notInvited: Int, totalHeadCount: Int)? {
        guard detailViewModel?.typeConfig.fields.rsvpStatus == true,
              let items = detailViewModel?.items else { return nil }
        var confirmed = 0, maybe = 0, declined = 0, invited = 0, notInvited = 0, totalHeadCount = 0
        for item in items {
            let status = item.rsvpStatus ?? "invited"
            let count = item.quantity
            switch status {
            case "confirmed": confirmed += count
            case "maybe": maybe += count
            case "declined": declined += count
            case "not_invited": notInvited += count
            default: invited += count
            }
            totalHeadCount += count
        }
        return (confirmed, maybe, declined, invited, notInvited, totalHeadCount)
    }
    
    @ViewBuilder
    private func rsvpSummaryView(_ summary: (confirmed: Int, maybe: Int, declined: Int, invited: Int, notInvited: Int, totalHeadCount: Int)) -> some View {
        VStack(spacing: 6) {
            HStack {
                rsvpStatLabel("\(summary.confirmed)", "Confirmed", Color(hex: "#4caf50"))
                Spacer()
                rsvpStatLabel("\(summary.maybe)", "Maybe", Color(hex: "#ff9800"))
                Spacer()
                rsvpStatLabel("\(summary.declined)", "Declined", Color(hex: "#f44336"))
                Spacer()
                rsvpStatLabel("\(summary.invited)", "Invited", Color(hex: "#42a5f5"))
                Spacer()
                rsvpStatLabel("\(summary.notInvited)", "Not Invited", Color(hex: "#9e9e9e"))
            }
            Text("Total Guests: \(summary.totalHeadCount)")
                .font(.subheadline)
                .fontWeight(.bold)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity)
    }
    
    private func rsvpStatLabel(_ count: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 1) {
            Text(count)
                .font(.title3).fontWeight(.bold)
                .foregroundStyle(color)
            Text(label)
                .font(.caption).fontWeight(.medium)
                .foregroundStyle(color)
        }
    }
    
    private var itemListContent: some View {
        ScrollViewReader { proxy in
            List {
                if let summary = rsvpSummary {
                    rsvpSummaryView(summary)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                }
                
                sortedUncheckedSection
                
                if let vm = detailViewModel, !vm.checkedItems.isEmpty, detailViewModel?.typeConfig.fields.rsvpStatus != true {
                    sortedCheckedSection
                }
                
                Color.clear.frame(height: 1).id("list-bottom")
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            .listStyle(.plain)
            .contentMargins(.bottom, 80, for: .scrollContent)
            .refreshable {
                await detailViewModel?.refresh()
            }
            .onChange(of: scrollTarget) { _, newId in
                if newId != nil {
                    withAnimation {
                        proxy.scrollTo("list-bottom", anchor: .bottom)
                    }
                    scrollTarget = nil
                }
            }
        }
    }
    
    // MARK: - Sorted Unchecked Section
    
    @ViewBuilder
    private var sortedUncheckedSection: some View {
        if let vm = detailViewModel {
            let result = vm.pipelineResult(for: activeSortConfig)
            
            if let flatItems = result.items {
                flatItemsSection(items: flatItems)
            } else {
                pipelineGroupsView(groups: result.groups, level: 1)
                
                if !result.ungrouped.isEmpty {
                    flatItemsSection(items: result.ungrouped)
                }
            }
        }
    }
    
    // MARK: - Pipeline Groups View
    
    private func pipelineGroupsView(groups: [SortPipeline.SortGroup], level: Int) -> AnyView {
        AnyView(ForEach(Array(groups.enumerated()), id: \.element.key) { _, group in
            if level == 1 {
                Section {
                    let groupKey = group.key
                    let isCollapsed = collapsedStores.contains(groupKey)
                    if !isCollapsed {
                        if let subGroups = group.subGroups {
                            pipelineGroupsView(groups: subGroups, level: level + 1)
                        } else if let items = group.items {
                            ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                                itemRow(item: item, isChecked: false, showSeparator: idx < items.count - 1)
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
                } header: {
                    level1Header(group: group)
                }
            } else {
                categoryHeader(label: group.label, color: group.color ?? "#9e9e9e", itemCount: (group.items?.count ?? 0) + (group.subGroups?.flatMap { $0.items ?? [] }.count ?? 0))
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                
                if let subGroups = group.subGroups {
                    pipelineGroupsView(groups: subGroups, level: level + 1)
                } else if let items = group.items {
                    ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                        itemRow(item: item, isChecked: false, showSeparator: idx < items.count - 1)
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
        })
    }
    
    // MARK: - Level 1 Header
    
    @ViewBuilder
    private func level1Header(group: SortPipeline.SortGroup) -> some View {
        let groupKey = group.key
        let isCollapsed = collapsedStores.contains(groupKey)
        let itemCount = group.type == .rsvp ? countHeadCount(in: group) : countItems(in: group)
        let total = totalPrice(in: group)
        
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                if isCollapsed {
                    collapsedStores.remove(groupKey)
                } else {
                    collapsedStores.insert(groupKey)
                }
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .rotationEffect(.degrees(isCollapsed ? 0 : 90))
                
                Circle()
                    .fill(Color(hex: group.color ?? "#9e9e9e"))
                    .frame(width: 10, height: 10)
                
                Text(group.label)
                    .font(.headline)
                    .foregroundStyle(.primary)
                
                Text("(\(itemCount))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                if total > Decimal.zero {
                    Text(formatPrice(total))
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(Color(hex: "#3D7A63"))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .textCase(nil)
        .listRowInsets(EdgeInsets())
    }
    
    // MARK: - Group Helpers
    
    private func countItems(in group: SortPipeline.SortGroup) -> Int {
        if let items = group.items {
            return items.count
        }
        if let subGroups = group.subGroups {
            return subGroups.reduce(0) { $0 + countItems(in: $1) }
        }
        return 0
    }
    
    private func countHeadCount(in group: SortPipeline.SortGroup) -> Int {
        if let items = group.items {
            return items.reduce(0) { $0 + $1.quantity }
        }
        if let subGroups = group.subGroups {
            return subGroups.reduce(0) { $0 + countHeadCount(in: $1) }
        }
        return 0
    }
    
    private func totalPrice(in group: SortPipeline.SortGroup) -> Decimal {
        if let items = group.items {
            return items.reduce(Decimal.zero) { $0 + ($1.price ?? .zero) * Decimal($1.quantity) }
        }
        if let subGroups = group.subGroups {
            return subGroups.reduce(Decimal.zero) { $0 + totalPrice(in: $1) }
        }
        return Decimal.zero
    }
    
    private func collectAllItems(from groups: [SortPipeline.SortGroup]) -> [Item] {
        var result: [Item] = []
        for group in groups {
            if let items = group.items { result.append(contentsOf: items) }
            if let subGroups = group.subGroups { result.append(contentsOf: collectAllItems(from: subGroups)) }
        }
        return result
    }
    
    // MARK: - Flat Items Section
    
    @ViewBuilder
    private func flatItemsSection(items: [Item]) -> some View {
        ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
            itemRow(item: item, isChecked: false, showSeparator: idx < items.count - 1)
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
    
    // MARK: - Category Header
    
    private func categoryHeader(label: String, color: String, itemCount: Int) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color(hex: color))
                .frame(width: 8, height: 8)
            Text(label)
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
    
    private func itemRow(item: Item, isChecked: Bool, showSeparator: Bool = true) -> some View {
        HStack(spacing: 0) {
            // Main row content
            HStack(spacing: 12) {
                if detailViewModel?.typeConfig.fields.rsvpStatus != true {
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
                }
                
                if detailViewModel?.typeConfig.fields.image == true {
                    itemThumbnail(item: item)
                }
                
                Text(item.name)
                    .strikethrough(isChecked && detailViewModel?.typeConfig.fields.rsvpStatus != true)
                    .foregroundStyle(isChecked ? .secondary : .primary)
                
                if detailViewModel?.typeConfig.fields.quantity == true {
                    if item.unit != "each" {
                        Text("\(item.quantity) \(item.unit)")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(Color(.systemGray))
                            )
                    } else if item.quantity > 1 {
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
                }
                
                Spacer()
                
                if detailViewModel?.typeConfig.fields.price == true {
                    if let price = item.price {
                        Text(formatPrice(price))
                            .font(.subheadline)
                            .foregroundStyle(isChecked ? .tertiary : .secondary)
                    }
                }
                
                if detailViewModel?.typeConfig.fields.rsvpStatus == true {
                    if !isChecked {
                        Menu {
                            ForEach(["invited", "confirmed", "declined", "maybe", "not_invited"], id: \.self) { status in
                                Button {
                                    Task {
                                        await detailViewModel?.updateItem(item.id, rsvpStatus: status)
                                    }
                                } label: {
                                    HStack {
                                        Text(rsvpDisplayName(for: status))
                                        if item.rsvpStatus == status {
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        } label: {
                            Text(rsvpDisplayName(for: item.rsvpStatus ?? "invited"))
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(
                                    Capsule()
                                        .fill(rsvpColor(for: item.rsvpStatus))
                                )
                        }
                    } else {
                        Text(rsvpDisplayName(for: item.rsvpStatus ?? "invited"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.leading, detailViewModel?.typeConfig.fields.rsvpStatus == true ? 12 : 28)
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
        }
        .padding(.leading, 16)
        .background(Color(.systemBackground))
        .overlay(alignment: .bottom) {
            if showSeparator {
                Rectangle()
                    .fill(Color(.separator))
                    .frame(height: 1 / UIScreen.main.scale)
                    .padding(.leading, 44)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(count: 2) {
            guard detailViewModel?.typeConfig.fields.rsvpStatus != true else { return }
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
        // Edit Name — always shown
        Button {
            editingItem = item
            editNameText = item.name
            showEditNameAlert = true
        } label: {
            Label("Edit Name", systemImage: "pencil")
        }
        
        // Quantity submenu
        if detailViewModel?.typeConfig.fields.quantity == true {
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
                Label("\(detailViewModel?.typeConfig.quantityLabel ?? "Quantity"): \(item.quantity)", systemImage: "number.circle")
            }
        }
        
        // Price submenu
        if detailViewModel?.typeConfig.fields.price == true {
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
        }
        
        // Store submenu
        if detailViewModel?.typeConfig.fields.store == true {
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
        }
        
        // Category submenu
        if detailViewModel?.typeConfig.fields.category == true {
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
        }
        
        // RSVP submenu (guest list only)
        if detailViewModel?.typeConfig.fields.rsvpStatus == true {
            Menu {
                ForEach(["invited", "confirmed", "declined", "maybe", "not_invited"], id: \.self) { status in
                    Button {
                        Task {
                            await detailViewModel?.updateItem(item.id, rsvpStatus: status)
                        }
                    } label: {
                        HStack {
                            Text(rsvpDisplayName(for: status))
                            if item.rsvpStatus == status {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                let rsvpLabel = rsvpDisplayName(for: item.rsvpStatus ?? "invited")
                Label("RSVP: \(rsvpLabel)", systemImage: "person.crop.circle.badge.questionmark")
            }
        }
        
        // Image actions
        if detailViewModel?.typeConfig.fields.image == true {
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
        }
        
        Divider()
        
        // Delete — always shown
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
        if let vm = detailViewModel, !vm.listCategories.isEmpty {
            return vm.listCategories
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
    
    // MARK: - Sorted Checked Section
    
    @ViewBuilder
    private var sortedCheckedSection: some View {
        if let vm = detailViewModel {
            let result = vm.checkedPipelineResult(for: activeSortConfig)
            let allChecked = result.items ?? collectAllItems(from: result.groups) + result.ungrouped
            
            HStack {
                Text("Checked (\(allChecked.count))")
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
            
            ForEach(Array(allChecked.enumerated()), id: \.element.id) { idx, item in
                itemRow(item: item, isChecked: true, showSeparator: idx < allChecked.count - 1)
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
        formatter.locale = Locale.current
        return formatter.string(from: price as NSDecimalNumber) ?? "\(price)"
    }
    
    private func rsvpColor(for status: String?) -> Color {
        switch status {
        case "confirmed": return Color(hex: "#4caf50")
        case "declined": return Color(hex: "#f44336")
        case "maybe": return Color(hex: "#ff9800")
        case "not_invited": return Color(hex: "#9e9e9e")
        default: return Color(hex: "#42a5f5")   // "invited" or nil
        }
    }
    
    private func rsvpDisplayName(for status: String) -> String {
        switch status {
        case "not_invited": return "Not Yet Invited"
        default: return status.capitalized
        }
    }
    
    // MARK: - Share Status Indicator
    
    @ViewBuilder
    private var shareStatusIndicator: some View {
        if isLoadingShares {
            ProgressView()
                .tint(.white)
        } else if isOwned {
            if shareCount > 0 {
                Button {
                    showShareSheet = true
                } label: {
                    Label {
                        Text("\(shareCount)")
                    } icon: {
                        Image(systemName: "person.2.fill")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.white)
                }
            }
        } else {
            Button {
                showShareSheet = true
            } label: {
                Label {
                    Text("Shared")
                } icon: {
                    Image(systemName: "person.fill")
                }
                .font(.subheadline)
                .foregroundStyle(.white)
            }
        }
    }
    
    // MARK: - Sort Menu
    
    private var sortMenu: some View {
        Button {
            showSortSheet = true
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.subheadline)
                .foregroundStyle(.white)
        }
        .sheet(isPresented: $showSortSheet) {
            SortConfigSheet(
                activeSortConfig: $activeSortConfig,
                hasOverride: isOwned ? list.sortConfig != nil : shareSortConfig != nil,
                onConfigChange: { config in
                    await selectSortConfig(config)
                },
                listType: list.type
            )
        }
    }
    
    // MARK: - List Options Menu
    
    private var listOptionsMenu: some View {
        Menu {
            Button {
                showChangeTypeSheet = true
            } label: {
                Label("Change List Type", systemImage: "arrow.triangle.swap")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.subheadline)
                .foregroundStyle(.white)
        }
        .sheet(isPresented: $showChangeTypeSheet) {
            changeTypeSheet()
        }
        .alert("Change List Type?", isPresented: $showTypeChangeConfirm) {
            Button("Cancel", role: .cancel) {
                pendingTypeChange = nil
                pendingCategories = nil
            }
            Button("Change") {
                guard let newType = pendingTypeChange else { return }
                Task {
                    await viewModel.updateList(id: list.id, name: nil, emoji: nil, color: nil, type: newType, categories: pendingCategories)
                    if let newCats = pendingCategories {
                        detailViewModel?.updateCategories(newCats)
                    }
                    let newConfig = ListTypes.getConfig(newType)
                    if let currentSort = list.sortConfig {
                        let validLevels = Set(newConfig.sortLevels)
                        let hasInvalid = currentSort.contains { !validLevels.contains($0) }
                        if hasInvalid {
                            try? await PreferenceService.updateListSortConfig(listId: list.id, config: nil)
                            activeSortConfig = SortPipeline.getDefaultConfig(for: newType)
                        }
                    }
                    pendingTypeChange = nil
                    pendingCategories = nil
                }
            }
        } message: {
            Text(typeChangeMessage)
        }
    }
    
    // MARK: - Change Type Sheet
    
    private static let categorySupportedTypes: Set<String> = ["grocery", "packing", "todo"]
    
    private func resolveNewCategories(for newType: String) async -> [CategoryDef]? {
        guard let userId = authViewModel.currentUser?.id else {
            return CategoryService.getSystemDefaults(for: newType)
        }
        if let defaults = try? await UserCategoryDefaultService.fetchDefaults(userId: userId),
           let match = defaults.first(where: { $0.listType == newType }),
           !match.categories.isEmpty {
            return match.categories
        }
        return CategoryService.getSystemDefaults(for: newType)
    }
    
    private func changeTypeSheet() -> some View {
        NavigationStack {
            Form {
                Section("Select List Type") {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(LIST_TYPE_IDS, id: \.self) { typeId in
                            let config = ListTypes.getConfig(typeId)
                            let isCurrent = typeId == list.type
                            Button {
                                if !isCurrent {
                                    handleTypeSelection(newType: typeId, newLabel: config.label)
                                }
                            } label: {
                                VStack(spacing: 4) {
                                    ListTypeIconView(typeId: typeId, size: 28)
                                    Text(config.label)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(isCurrent ? Color(hex: "#3D7A63") : .primary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(isCurrent ? Color(hex: "#3D7A63").opacity(0.15) : Color(.systemGray6))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(isCurrent ? Color(hex: "#3D7A63") : Color.clear, lineWidth: 2)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("List Type")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showChangeTypeSheet = false
                    }
                }
            }
        }
    }
    
    private func handleTypeSelection(newType: String, newLabel: String) {
        let currentType = list.type
        let fromCategoryType = Self.categorySupportedTypes.contains(currentType)
        let toCategoryType = Self.categorySupportedTypes.contains(newType)
        
        showChangeTypeSheet = false
        
        if fromCategoryType && toCategoryType {
            Task {
                let newCats = await resolveNewCategories(for: newType)
                pendingTypeChange = newType
                pendingCategories = newCats
                typeChangeMessage = "Changing to \(newLabel) will reset this list's categories to your \(newLabel) defaults. Continue?"
                showTypeChangeConfirm = true
            }
        } else if fromCategoryType && !toCategoryType {
            Task {
                await viewModel.updateList(id: list.id, name: nil, emoji: nil, color: nil, type: newType, categories: [])
                detailViewModel?.updateCategories([])
            }
        } else if !fromCategoryType && toCategoryType {
            Task {
                let newCats = await resolveNewCategories(for: newType)
                await viewModel.updateList(id: list.id, name: nil, emoji: nil, color: nil, type: newType, categories: newCats)
                if let cats = newCats {
                    detailViewModel?.updateCategories(cats)
                }
            }
        } else {
            Task {
                await viewModel.updateList(id: list.id, name: nil, emoji: nil, color: nil, type: newType)
            }
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
                        scrollTarget = UUID()
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
            if detailViewModel?.typeConfig.fields.store == true {
                if let vm = detailViewModel, !vm.stores.isEmpty {
                    storePicker(stores: vm.stores)
                }
            }
            
            TextField(list.type == "guest_list" ? "Add guest..." : "Add an item...", text: $itemName)
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
    
    private func selectSortConfig(_ config: [SortLevel]?) async {
        do {
            if isOwned {
                try await PreferenceService.updateListSortConfig(listId: list.id, config: config)
            } else {
                let email = authViewModel.currentUser?.email ?? ""
                try await PreferenceService.updateShareSortConfig(listId: list.id, email: email, config: config)
            }
            if let config = config {
                activeSortConfig = config
            } else {
                activeSortConfig = PreferenceService.effectiveSortConfig(
                    for: GatherList(id: list.id, ownerId: list.ownerId, name: list.name, sortConfig: nil, type: list.type, createdAt: list.createdAt),
                    userPreferences: userPreferences,
                    shareSortConfig: nil
                )
            }
        } catch {
            print("[ListDetailView] Failed to update sort config: \(error.localizedDescription)")
        }
    }
    
    private func handleAddItem() {
        let trimmedName = itemName.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        
        Task {
            await detailViewModel?.addItem(name: trimmedName, storeId: selectedStoreId)
            itemName = ""
            isInputFocused = true
            scrollTarget = UUID()
        }
    }
    
    // MARK: - Data Loading
    
    private func initializeDetailViewModel() async {
        guard let userId = authViewModel.currentUser?.id else {
            print("[ListDetailView] No authenticated user, cannot create detail view model")
            return
        }
        detailViewModel = ListDetailViewModel(list: list, userId: userId)
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
    
    private func loadNotificationStatus() async {
        if let prefs = try? await NotificationPreferenceService.fetchPreferences(listId: list.id) {
            hasNotificationsEnabled = prefs.itemAdded || prefs.itemChecked || prefs.rsvpChanged || prefs.collaboratorJoined
        } else {
            hasNotificationsEnabled = false
        }
    }
    
    private func loadSortPreferences() async {
        do {
            let prefs = try await PreferenceService.fetchUserPreferences()
            userPreferences = prefs
            activeSortConfig = PreferenceService.effectiveSortConfig(
                for: list,
                userPreferences: prefs,
                shareSortConfig: isOwned ? nil : shareSortConfig
            )
        } catch {
            print("[ListDetailView] Failed to load sort preferences: \(error.localizedDescription)")
        }
    }
    
    private func subscribeToPreferences() async {
        guard let userId = try? await SupabaseManager.shared.client.auth.session.user.id else { return }
        let client = SupabaseManager.shared.client
        let channel = client.realtimeV2.channel("user-preferences-\(userId.uuidString)")
        
        let changes = channel.postgresChange(
            AnyAction.self,
            schema: "public",
            table: "user_preferences",
            filter: "user_id=eq.\(userId.uuidString)"
        )
        
        preferencesTask = Task {
            await channel.subscribe()
            for await _ in changes {
                PreferenceService.clearCache()
                await loadSortPreferences()
            }
        }
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

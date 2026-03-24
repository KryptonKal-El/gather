import SwiftUI

struct PreviewNewItem: Identifiable {
    let id = UUID()
    let name: String
    var quantity: Int
    let recipeQuantity: Int
    let unit: String
    let category: String
    var isExcluded: Bool = false
}

struct PreviewDuplicateItem: Identifiable {
    let id: UUID
    let name: String
    let currentQuantity: Int
    var newQuantity: Int
    let unit: String
    var isExcluded: Bool = false
}

/// A bottom sheet for adding recipe ingredients to a shopping list.
struct AddToListSheet: View {
    let ingredients: [(name: String, quantity: String?, amount: Double?, unit: String?)]
    let userId: UUID
    let userEmail: String
    var onDismiss: () -> Void
    
    @State private var lists: [GatherList] = []
    @State private var selectedListId: UUID?
    @State private var isLoading = true
    @State private var isAdding = false
    @State private var error: String?
    @State private var successMessage: String?
    
    @State private var showPreview = false
    @State private var isLoadingPreview = false
    @State private var newItems: [PreviewNewItem] = []
    @State private var duplicateItems: [PreviewDuplicateItem] = []
    @State private var existingItems: [Item] = []
    @State private var historyNames: [String] = []
    @State private var remapSourceId: UUID?
    @State private var remapSearchText = ""
    @State private var showTypeWarning = false
    
    private var ingredientSummary: String {
        let names = ingredients.prefix(5).map { $0.name }
        var summary = names.joined(separator: ", ")
        if ingredients.count > 5 {
            summary += " and \(ingredients.count - 5) more..."
        }
        return summary
    }
    
    private var selectedList: GatherList? {
        lists.first { $0.id == selectedListId }
    }
    
    private var nonExcludedNewCount: Int {
        newItems.filter { !$0.isExcluded }.count
    }
    
    private var nonExcludedDuplicateCount: Int {
        duplicateItems.filter { !$0.isExcluded }.count
    }
    
    private var availableForRemap: [Item] {
        let usedIds = Set(duplicateItems.map { $0.id })
        return existingItems.filter { !usedIds.contains($0.id) }
    }
    
    private var filteredRemapItems: [Item] {
        if remapSearchText.isEmpty {
            return availableForRemap
        }
        return availableForRemap.filter { $0.name.localizedCaseInsensitiveContains(remapSearchText) }
    }
    
    private var availableHistoryNames: [String] {
        let existingItemNames = Set(existingItems.map { $0.name.lowercased() })
        let duplicateNames = Set(duplicateItems.map { $0.name.lowercased() })
        let newItemNames = Set(newItems.map { $0.name.lowercased() })
        return historyNames.filter { name in
            let lower = name.lowercased()
            return !existingItemNames.contains(lower) && !duplicateNames.contains(lower) && !newItemNames.contains(lower)
        }
    }
    
    private var filteredHistoryNames: [String] {
        if remapSearchText.isEmpty {
            return availableHistoryNames
        }
        return availableHistoryNames.filter { $0.localizedCaseInsensitiveContains(remapSearchText) }
    }
    
    private var confirmButtonText: String {
        let addCount = nonExcludedNewCount
        let updateCount = nonExcludedDuplicateCount
        
        if addCount > 0 && updateCount > 0 {
            return "Add \(addCount) Items, Update \(updateCount)"
        } else if addCount > 0 {
            return "Add \(addCount) Items"
        } else if updateCount > 0 {
            return "Update \(updateCount) Items"
        } else {
            return "Nothing Selected"
        }
    }
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    loadingView
                } else if let successMessage = successMessage {
                    successView(message: successMessage)
                } else if lists.isEmpty {
                    emptyView
                } else if showPreview {
                    previewContent
                } else {
                    listContent
                }
            }
            .navigationTitle(showPreview ? "Review Items" : "Add \(ingredients.count) Ingredients to List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if showPreview {
                        Button("Back") {
                            showPreview = false
                        }
                        .disabled(isAdding)
                    } else {
                        Button("Cancel") {
                            onDismiss()
                        }
                        .disabled(isAdding)
                    }
                }
            }
        }
        .task {
            await loadLists()
        }
        .alert("Non-Grocery List", isPresented: $showTypeWarning) {
            Button("Cancel", role: .cancel) {}
            Button("Proceed") {
                loadPreview()
            }
        } message: {
            Text("This list isn't a Grocery list — ingredients will be added as plain items")
        }
    }
    
    @ViewBuilder
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading lists...")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    @ViewBuilder
    private func successView(message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)
            Text(message)
                .font(.headline)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            try? await Task.sleep(for: .seconds(1.5))
            onDismiss()
        }
    }
    
    @ViewBuilder
    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "list.bullet.rectangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No Lists")
                .font(.headline)
            Text("Create a shopping list first to add ingredients.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    @ViewBuilder
    private var listContent: some View {
        VStack(spacing: 0) {
            Form {
                Section {
                    Text(ingredientSummary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Section {
                    ForEach(lists) { list in
                        Button {
                            selectedListId = list.id
                        } label: {
                            HStack {
                                Text((list.emoji?.containsVisualEmoji == true ? list.emoji : nil) ?? "🛒")
                                    .font(.title3)
                                Text(list.name)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if selectedListId == list.id {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                        .fontWeight(.semibold)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Choose a list:")
                }
                
                if let error = error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.subheadline)
                    }
                }
            }
            
            VStack {
                Button {
                    if let list = selectedList, list.type != nil && list.type != "grocery" {
                        showTypeWarning = true
                    } else {
                        loadPreview()
                    }
                } label: {
                    HStack {
                        if isLoadingPreview {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Review Items")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(selectedListId != nil && !isLoadingPreview ? Color.blue : Color.gray.opacity(0.3))
                    .foregroundStyle(.white)
                    .cornerRadius(12)
                    .fontWeight(.semibold)
                }
                .disabled(selectedListId == nil || isLoadingPreview)
            }
            .padding()
            .background(Color(.systemGroupedBackground))
        }
    }
    
    @ViewBuilder
    private var previewContent: some View {
        VStack(spacing: 0) {
            if newItems.isEmpty && duplicateItems.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "tray")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("Nothing to add")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Form {
                    if !newItems.isEmpty {
                        Section {
                            ForEach($newItems) { $item in
                                PreviewNewItemRow(item: $item, onNameTap: {
                                    if availableForRemap.isEmpty && availableHistoryNames.isEmpty { return }
                                    remapSourceId = item.id
                                })
                            }
                        } header: {
                            Text("New Items")
                        }
                    }
                    
                    if !duplicateItems.isEmpty {
                        Section {
                            ForEach($duplicateItems) { $item in
                                PreviewDuplicateItemRow(item: $item)
                            }
                        } header: {
                            Text("Already in List — Update Quantity")
                        }
                    }
                    
                    if let error = error {
                        Section {
                            Text(error)
                                .foregroundStyle(.red)
                                .font(.subheadline)
                        }
                    }
                }
            }
            
            VStack {
                Button {
                    confirmChanges()
                } label: {
                    HStack {
                        if isAdding {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(confirmButtonText)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background((nonExcludedNewCount > 0 || nonExcludedDuplicateCount > 0) && !isAdding ? Color.blue : Color.gray.opacity(0.3))
                    .foregroundStyle(.white)
                    .cornerRadius(12)
                    .fontWeight(.semibold)
                }
                .disabled((nonExcludedNewCount == 0 && nonExcludedDuplicateCount == 0) || isAdding)
            }
            .padding()
            .background(Color(.systemGroupedBackground))
        }
        .sheet(isPresented: Binding(
            get: { remapSourceId != nil },
            set: { if !$0 { remapSourceId = nil } }
        )) {
            remapPickerSheet
        }
    }
    
    private func loadLists() async {
        isLoading = true
        error = nil
        
        do {
            async let ownedTask = ListService.fetchOwnedLists(userId: userId)
            async let sharedTask = ListService.fetchSharedWithMe(email: userEmail)
            
            let (owned, shared) = try await (ownedTask, sharedTask)
            
            var combined = owned
            let ownedIds = Set(owned.map { $0.id })
            for list in shared where !ownedIds.contains(list.id) {
                combined.append(list)
            }
            
            lists = combined
            if let first = combined.first {
                selectedListId = first.id
            }
        } catch {
            self.error = "Failed to load lists: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    private func loadPreview() {
        guard let listId = selectedListId else { return }
        
        isLoadingPreview = true
        error = nil
        
        Task {
            do {
                async let existingTask = ItemService.fetchItems(listId: listId)
                async let historyTask = HistoryService.fetchHistory(userId: userId)
                
                let existingItems = try await existingTask
                let historyEntries = try await historyTask
                self.existingItems = existingItems
                
                let existingNames = Set(existingItems.map { $0.name.lowercased() })
                var seen = Set<String>()
                var uniqueNames: [String] = []
                for entry in historyEntries {
                    let lower = entry.name.lowercased()
                    if !seen.contains(lower) && !existingNames.contains(lower) {
                        seen.insert(lower)
                        uniqueNames.append(entry.name)
                    }
                }
                self.historyNames = uniqueNames.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
                
                let existingByName = Dictionary(
                    existingItems.map { ($0.name.lowercased(), $0) },
                    uniquingKeysWith: { first, _ in first }
                )
                
                var newItemsTemp: [PreviewNewItem] = []
                var duplicatesTemp: [PreviewDuplicateItem] = []
                
                for ingredient in ingredients {
                    let capitalizedName = ingredient.name.prefix(1).uppercased() + ingredient.name.dropFirst()
                    let nameKey = capitalizedName.lowercased()
                    let resolvedQuantity = max(1, Int((ingredient.amount ?? 1).rounded()))
                    let resolvedUnit = ingredient.unit.map { ItemUnit.mapFromSpoonacular($0) } ?? "each"
                    
                    if let existing = existingByName[nameKey] {
                        duplicatesTemp.append(PreviewDuplicateItem(
                            id: existing.id,
                            name: existing.name,
                            currentQuantity: existing.quantity,
                            newQuantity: existing.quantity + resolvedQuantity,
                            unit: existing.unit
                        ))
                    } else {
                        let listCategories = CategoryService.getEffectiveCategories(list: selectedList)
                        let category = CategoryDefinitions.categorizeItem(capitalizedName, listType: selectedList?.type, categories: listCategories)
                        newItemsTemp.append(PreviewNewItem(
                            name: capitalizedName,
                            quantity: resolvedQuantity,
                            recipeQuantity: resolvedQuantity,
                            unit: resolvedUnit,
                            category: category
                        ))
                    }
                }
                
                newItems = newItemsTemp
                duplicateItems = duplicatesTemp
                showPreview = true
            } catch {
                self.error = "Failed to load preview: \(error.localizedDescription)"
            }
            
            isLoadingPreview = false
        }
    }
    
    private func remapNewItem(newItemId: UUID, to existingItem: Item) {
        guard let index = newItems.firstIndex(where: { $0.id == newItemId }) else { return }
        let foundNewItem = newItems.remove(at: index)
        
        duplicateItems.append(PreviewDuplicateItem(
            id: existingItem.id,
            name: existingItem.name,
            currentQuantity: existingItem.quantity,
            newQuantity: existingItem.quantity + foundNewItem.recipeQuantity,
            unit: existingItem.unit
        ))
        
        remapSourceId = nil
    }
    
    private func renameNewItem(newItemId: UUID, to name: String) {
        guard let index = newItems.firstIndex(where: { $0.id == newItemId }) else { return }
        let old = newItems[index]
        newItems[index] = PreviewNewItem(
            name: name,
            quantity: old.quantity,
            recipeQuantity: old.recipeQuantity,
            unit: old.unit,
            category: old.category
        )
        newItems[index].isExcluded = old.isExcluded
        remapSourceId = nil
        remapSearchText = ""
    }
    
    private func confirmChanges() {
        guard let listId = selectedListId, let list = selectedList else { return }
        
        isAdding = true
        error = nil
        
        Task {
            do {
                let result = try await ItemService.applyIngredientPreview(
                    listId: listId,
                    newItems: newItems,
                    duplicates: duplicateItems
                )
                
                if result.added > 0 && result.updated > 0 {
                    successMessage = "Added \(result.added), updated \(result.updated) items in \(list.name)"
                } else if result.added > 0 {
                    successMessage = "Added \(result.added) items to \(list.name)"
                } else if result.updated > 0 {
                    successMessage = "Updated \(result.updated) items in \(list.name)"
                } else {
                    successMessage = "No changes made"
                }
            } catch {
                self.error = "Failed to apply changes: \(error.localizedDescription)"
                isAdding = false
            }
        }
    }
    
    @ViewBuilder
    private var remapPickerSheet: some View {
        NavigationStack {
            List {
                if !filteredRemapItems.isEmpty {
                    Section("On This List") {
                        ForEach(filteredRemapItems) { item in
                            Button {
                                if let sourceId = remapSourceId {
                                    remapNewItem(newItemId: sourceId, to: item)
                                }
                            } label: {
                                HStack {
                                    Text(item.name)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    Text("\(item.quantity) \(item.unit)")
                                        .foregroundStyle(.secondary)
                                        .font(.subheadline)
                                }
                            }
                        }
                    }
                }
                
                if !filteredHistoryNames.isEmpty {
                    Section("Previously Used") {
                        ForEach(filteredHistoryNames, id: \.self) { name in
                            Button {
                                if let sourceId = remapSourceId {
                                    renameNewItem(newItemId: sourceId, to: name)
                                }
                            } label: {
                                Text(name)
                                    .foregroundStyle(.primary)
                            }
                        }
                    }
                }
                
                if filteredRemapItems.isEmpty && filteredHistoryNames.isEmpty {
                    Text("No matching items")
                        .foregroundStyle(.secondary)
                }
            }
            .searchable(text: $remapSearchText, prompt: "Search items")
            .navigationTitle("Merge with...")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        remapSourceId = nil
                        remapSearchText = ""
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(.regularMaterial)
    }
}

// MARK: - Row Views

private struct PreviewNewItemRow: View {
    @Binding var item: PreviewNewItem
    var onNameTap: () -> Void
    
    var body: some View {
        HStack {
            Button {
                item.isExcluded.toggle()
            } label: {
                Image(systemName: item.isExcluded ? "circle" : "checkmark.circle.fill")
                    .foregroundStyle(item.isExcluded ? Color.secondary : Color.blue)
                    .font(.title3)
            }
            .buttonStyle(.plain)
            
            Button {
                onNameTap()
            } label: {
                Text(item.name)
                    .strikethrough(item.isExcluded)
                    .foregroundStyle(item.isExcluded ? Color.secondary : Color.accentColor)
                    .underline(!item.isExcluded, color: Color.accentColor.opacity(0.4))
            }
            .buttonStyle(.plain)
            .disabled(item.isExcluded)
            
            Spacer()
            
            HStack(spacing: 12) {
                Button {
                    if item.quantity > 1 {
                        item.quantity -= 1
                    }
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(item.quantity > 1 && !item.isExcluded ? Color.blue : Color.secondary)
                }
                .buttonStyle(.plain)
                .disabled(item.quantity <= 1 || item.isExcluded)
                
                Text("\(item.quantity)")
                    .font(.body.monospacedDigit())
                    .frame(minWidth: 24)
                    .foregroundStyle(item.isExcluded ? Color.secondary : Color.primary)
                
                Button {
                    item.quantity += 1
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(item.isExcluded ? Color.secondary : Color.blue)
                }
                .buttonStyle(.plain)
                .disabled(item.isExcluded)
            }
            
            Text(item.unit)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(minWidth: 40, alignment: .leading)
        }
        .opacity(item.isExcluded ? 0.6 : 1)
    }
}

private struct PreviewDuplicateItemRow: View {
    @Binding var item: PreviewDuplicateItem
    
    var body: some View {
        HStack {
            Button {
                item.isExcluded.toggle()
            } label: {
                Image(systemName: item.isExcluded ? "circle" : "checkmark.circle.fill")
                    .foregroundStyle(item.isExcluded ? Color.secondary : Color.blue)
                    .font(.title3)
            }
            .buttonStyle(.plain)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .strikethrough(item.isExcluded)
                    .foregroundStyle(item.isExcluded ? Color.secondary : Color.primary)
                
                Text("\(item.currentQuantity) → \(item.newQuantity) \(item.unit)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                Button {
                    if item.newQuantity > item.currentQuantity {
                        item.newQuantity -= 1
                    }
                } label: {
                    Image(systemName: "minus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(item.newQuantity > item.currentQuantity && !item.isExcluded ? Color.blue : Color.secondary)
                }
                .buttonStyle(.plain)
                .disabled(item.newQuantity <= item.currentQuantity || item.isExcluded)
                
                Text("\(item.newQuantity)")
                    .font(.body.monospacedDigit())
                    .frame(minWidth: 24)
                    .foregroundStyle(item.isExcluded ? Color.secondary : Color.primary)
                
                Button {
                    item.newQuantity += 1
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .font(.title3)
                        .foregroundStyle(item.isExcluded ? Color.secondary : Color.blue)
                }
                .buttonStyle(.plain)
                .disabled(item.isExcluded)
            }
        }
        .opacity(item.isExcluded ? 0.6 : 1)
    }
}

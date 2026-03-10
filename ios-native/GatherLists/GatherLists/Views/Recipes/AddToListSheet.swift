import SwiftUI

struct PreviewNewItem: Identifiable {
    let id = UUID()
    let name: String
    var quantity: Int
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
                                Text(list.emoji ?? "🛒")
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
                    loadPreview()
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
                                PreviewNewItemRow(item: $item)
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
                let existingItems = try await ItemService.fetchItems(listId: listId)
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
                        let category = CategoryDefinitions.categorizeItem(capitalizedName)
                        newItemsTemp.append(PreviewNewItem(
                            name: capitalizedName,
                            quantity: resolvedQuantity,
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
}

// MARK: - Row Views

private struct PreviewNewItemRow: View {
    @Binding var item: PreviewNewItem
    
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
            
            Text(item.name)
                .strikethrough(item.isExcluded)
                .foregroundStyle(item.isExcluded ? Color.secondary : Color.primary)
            
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

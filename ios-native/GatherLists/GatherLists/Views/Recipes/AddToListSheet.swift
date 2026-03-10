import SwiftUI

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
    
    private var ingredientSummary: String {
        let names = ingredients.prefix(5).map { $0.name }
        var summary = names.joined(separator: ", ")
        if ingredients.count > 5 {
            summary += " and \(ingredients.count - 5) more..."
        }
        return summary
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
                } else {
                    listContent
                }
            }
            .navigationTitle("Add \(ingredients.count) Ingredients to List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onDismiss()
                    }
                    .disabled(isAdding)
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
                    addItems()
                } label: {
                    HStack {
                        if isAdding {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Add \(ingredients.count) Items")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(selectedListId != nil && !isAdding ? Color.blue : Color.gray.opacity(0.3))
                    .foregroundStyle(.white)
                    .cornerRadius(12)
                    .fontWeight(.semibold)
                }
                .disabled(selectedListId == nil || isAdding)
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
    
    private func addItems() {
        guard let listId = selectedListId else { return }
        guard let selectedList = lists.first(where: { $0.id == listId }) else { return }
        
        isAdding = true
        error = nil
        
        Task {
            do {
                try await ItemService.addIngredientItems(listId: listId, ingredients: ingredients)
                successMessage = "Added \(ingredients.count) items to \(selectedList.name)"
            } catch {
                self.error = "Failed to add items: \(error.localizedDescription)"
                isAdding = false
            }
        }
    }
}

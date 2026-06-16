import SwiftUI

struct DefaultStoreEditorView: View {
    let listType: String
    
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var stores: [UserStoreDefault] = []
    @State private var isLoading = true
    @State private var editingStore: UserStoreDefault?
    @State private var pendingNewStore: UserStoreDefault?
    @State private var showDeleteConfirm = false
    @State private var storeToDelete: UserStoreDefault?
    @State private var searchText = ""
    
    private let presetColors = [
        "#B5E8C8", "#A8D8EA", "#85BFA8", "#FFD6A5", "#FDCFE8", "#B4C7E7", "#D4E09B",
        "#F9A8C9", "#C5B3E6", "#F4C89E", "#A5D6D0", "#C1D5A4", "#F2B5B5", "#D0C4DF"
    ]
    
    private var displayTitle: String {
        switch listType {
        case "grocery": return "Grocery Store Defaults"
        case "packing": return "Packing Store Defaults"
        case "project": return "Project Store Defaults"
        default: return "\(listType.capitalized) Store Defaults"
        }
    }
    
    private var filteredStores: [UserStoreDefault] {
        if searchText.isEmpty { return stores }
        return stores.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        List {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
            } else {
                Section {
                    ForEach(filteredStores, id: \.id) { store in
                        storeRow(store)
                    }
                    .onMove(perform: moveStore)
                    .onDelete(perform: deleteStore)
                } header: {
                    Text("Stores")
                } footer: {
                    Text("Swipe to delete. Tap Edit to reorder.")
                }
                
                Section {
                    Button {
                        addNewStore()
                    } label: {
                        Label("Add Store", systemImage: "plus")
                    }
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search stores")
        .tint(Color.brandGreen)
        .navigationTitle(displayTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                EditButton()
            }
        }
        .task { await loadStores() }
        .sheet(item: $editingStore) { store in
            StoreDetailEditor(
                store: store,
                isAddMode: false,
                presetColors: presetColors,
                onSave: { updated in updateStore(original: store, updated: updated) }
            )
        }
        .sheet(item: $pendingNewStore) { store in
            StoreDetailEditor(
                store: store,
                isAddMode: true,
                presetColors: presetColors,
                onSave: { updated in
                    stores.append(updated)
                    saveStores()
                }
            )
        }
        .alert("Delete Store?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {
                storeToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let store = storeToDelete {
                    stores.removeAll { $0.id == store.id }
                    Task {
                        do {
                            try await UserStoreDefaultService.deleteDefault(id: store.id)
                        } catch {
                            print("Failed to delete store default: \(error)")
                        }
                    }
                }
                storeToDelete = nil
            }
        } message: {
            if let store = storeToDelete {
                Text("Delete \"\(store.name)\" from \(listType) defaults?")
            }
        }
    }
    
    private func storeRow(_ store: UserStoreDefault) -> some View {
        Button {
            editingStore = store
        } label: {
            HStack(spacing: 12) {
                Circle()
                    .fill(Color(hex: store.color ?? "#B5E8C8"))
                    .frame(width: 12, height: 12)
                
                Text(store.name)
                    .foregroundStyle(.primary)
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .buttonStyle(.plain)
    }
    
    private func loadStores() async {
        guard let userId = authViewModel.currentUser?.id else {
            isLoading = false
            return
        }
        do {
            stores = try await UserStoreDefaultService.fetchDefaults(userId: userId, listType: listType)
        } catch {
            print("Failed to load store defaults: \(error)")
        }
        isLoading = false
    }
    
    private func saveStores() {
        Task {
            do {
                try await UserStoreDefaultService.saveOrder(defaults: stores)
            } catch {
                print("Failed to save store order: \(error)")
            }
        }
    }
    
    private func moveStore(from source: IndexSet, to destination: Int) {
        guard searchText.isEmpty else { return }
        stores.move(fromOffsets: source, toOffset: destination)
        saveStores()
    }
    
    private func deleteStore(at offsets: IndexSet) {
        if let index = offsets.first {
            storeToDelete = filteredStores[index]
            showDeleteConfirm = true
        }
    }
    
    private func addNewStore() {
        let usedColors = Set(stores.map { $0.color ?? "" })
        let nextColor = presetColors.first { !usedColors.contains($0) } ?? presetColors[stores.count % presetColors.count]
        
        let newStore = UserStoreDefault(
            id: UUID(),
            userId: authViewModel.currentUser?.id ?? UUID(),
            listType: listType,
            name: "",
            color: nextColor,
            sortOrder: stores.count,
            createdAt: Date()
        )
        pendingNewStore = newStore
    }
    
    private func updateStore(original: UserStoreDefault, updated: UserStoreDefault) {
        if let index = stores.firstIndex(where: { $0.id == original.id }) {
            stores[index] = updated
            Task {
                do {
                    try await UserStoreDefaultService.updateDefault(
                        id: updated.id,
                        name: updated.name,
                        color: updated.color
                    )
                } catch {
                    print("Failed to update store default: \(error)")
                }
            }
        }
    }
}

struct StoreDetailEditor: View {
    @State var store: UserStoreDefault
    let isAddMode: Bool
    let presetColors: [String]
    let onSave: (UserStoreDefault) -> Void
    
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Store Name") {
                    TextField("Name", text: $store.name)
                }
                
                Section("Color") {
                    VStack(alignment: .leading, spacing: 12) {
                        Wrap(presetColors, id: \.self) { color in
                            Button {
                                store.color = color
                            } label: {
                                Circle()
                                    .fill(Color(hex: color))
                                    .frame(width: 40, height: 40)
                                    .overlay(
                                        store.color == color ?
                                        Circle().stroke(Color.black, lineWidth: 2) : nil
                                    )
                            }
                        }
                    }
                }
            }
            .navigationTitle(isAddMode ? "New Store" : "Edit Store")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Save") {
                        var updated = store
                        if isAddMode {
                            updated.id = UUID()
                            updated.userId = authViewModel.currentUser?.id ?? UUID()
                            updated.createdAt = Date()
                        }
                        onSave(updated)
                        dismiss()
                    }
                    .disabled(store.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// Simple layout wrapper for grid-like color picker
struct Wrap<Content: View>: View {
    let items: [String]
    let id: KeyPath<String, String>
    let content: (String) -> Content
    
    init(_ items: [String], id: KeyPath<String, String>, @ViewBuilder content: @escaping (String) -> Content) {
        self.items = items
        self.id = id
        self.content = content
    }
    
    var body: some View {
        VStack(alignment: .leading) {
            HStack(spacing: 12) {
                ForEach(items.prefix(4), id: \.self) { item in
                    content(item)
                }
            }
            HStack(spacing: 12) {
                ForEach(items.dropFirst(4).prefix(4), id: \.self) { item in
                    content(item)
                }
                Spacer()
            }
            if items.count > 8 {
                HStack(spacing: 12) {
                    ForEach(items.dropFirst(8), id: \.self) { item in
                        content(item)
                    }
                    Spacer()
                }
            }
        }
    }
}

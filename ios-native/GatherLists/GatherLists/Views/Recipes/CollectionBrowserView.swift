import SwiftUI

/// Browse owned and shared recipe collections with search, grouped into sections.
struct CollectionBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel: RecipeViewModel?
    @State private var showCreateSheet = false
    @State private var collectionToDelete: RecipeCollection?
    @State private var showDeleteDialog = false
    @State private var collectionToShare: RecipeCollection?
    @State private var collectionToRename: RecipeCollection?
    @State private var renameText = ""
    @State private var showRenameAlert = false
    
    private var ownedFiltered: [RecipeCollection] {
        guard let vm = viewModel else { return [] }
        guard !vm.searchQuery.isEmpty else { return vm.collections }
        let query = vm.searchQuery.lowercased()
        return vm.collections.filter { collection in
            collection.name.lowercased().contains(query) ||
            (collection.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
    private var sharedFiltered: [RecipeCollection] {
        guard let vm = viewModel else { return [] }
        guard !vm.searchQuery.isEmpty else { return vm.sharedCollections }
        let query = vm.searchQuery.lowercased()
        return vm.sharedCollections.filter { collection in
            collection.name.lowercased().contains(query) ||
            (collection.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
    private var hasNoCollections: Bool {
        guard let vm = viewModel else { return true }
        return vm.collections.isEmpty && vm.sharedCollections.isEmpty
    }
    
    private func recipeCount(for collection: RecipeCollection) -> Int {
        viewModel?.recipes.filter { $0.collectionId == collection.id }.count ?? 0
    }
    
    private var defaultCollectionName: String {
        viewModel?.collections.first(where: { $0.isDefault })?.name ?? "My Recipes"
    }
    
    var body: some View {
        NavigationStack {
            Group {
                if let vm = viewModel {
                    if vm.isLoading && hasNoCollections {
                        loadingView
                    } else if hasNoCollections {
                        emptyStateView
                    } else {
                        listContent(vm: vm)
                    }
                } else {
                    loadingView
                }
            }
            .navigationTitle("Recipes")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                if let vm = viewModel {
                    CreateCollectionSheet(viewModel: vm)
                }
            }
            .sheet(item: $collectionToShare) { collection in
                // TODO: ShareCollectionSheet — US-011
                NavigationStack {
                    Text("Share \(collection.name)")
                        .navigationTitle("Share Collection")
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Done") {
                                    collectionToShare = nil
                                }
                            }
                        }
                }
            }
            .confirmationDialog(
                "Delete \"\(collectionToDelete?.name ?? "")\"?",
                isPresented: $showDeleteDialog,
                presenting: collectionToDelete
            ) { collection in
                Button("Move \(recipeCount(for: collection)) recipes to \(defaultCollectionName) and delete", role: .none) {
                    Task {
                        await viewModel?.deleteCollection(id: collection.id, deleteRecipes: false)
                    }
                }
                Button("Delete collection and \(recipeCount(for: collection)) recipes", role: .destructive) {
                    Task {
                        await viewModel?.deleteCollection(id: collection.id, deleteRecipes: true)
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .alert("Rename Collection", isPresented: $showRenameAlert) {
                TextField("Name", text: $renameText)
                Button("Save") {
                    if let collection = collectionToRename {
                        Task {
                            await viewModel?.updateCollection(id: collection.id, name: renameText, emoji: nil, description: nil)
                        }
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
        .onAppear {
            initializeViewModelIfNeeded()
        }
    }
    
    @ViewBuilder
    private func listContent(vm: RecipeViewModel) -> some View {
        List {
            if !ownedFiltered.isEmpty {
                Section("My Collections") {
                    ForEach(ownedFiltered) { collection in
                        NavigationLink(value: collection) {
                            collectionRow(collection: collection, isShared: false)
                        }
                        .contextMenu {
                            Button {
                                collectionToRename = collection
                                renameText = collection.name
                                showRenameAlert = true
                            } label: {
                                Label("Rename", systemImage: "pencil")
                            }
                            
                            Button {
                                collectionToShare = collection
                            } label: {
                                Label("Share", systemImage: "person.badge.plus")
                            }
                            
                            Divider()
                            
                            if !collection.isDefault {
                                Button(role: .destructive) {
                                    collectionToDelete = collection
                                    showDeleteDialog = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            if !collection.isDefault {
                                Button(role: .destructive) {
                                    collectionToDelete = collection
                                    showDeleteDialog = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
            
            if !sharedFiltered.isEmpty {
                Section("Shared with Me") {
                    ForEach(sharedFiltered) { collection in
                        NavigationLink(value: collection) {
                            collectionRow(collection: collection, isShared: true)
                        }
                        .contextMenu {
                            Button(role: .destructive) {
                                Task {
                                    if let email = authViewModel.currentUser?.email {
                                        try? await viewModel?.unshareCollection(id: collection.id, email: email)
                                        viewModel?.sharedCollections.removeAll { $0.id == collection.id }
                                    }
                                }
                            } label: {
                                Label("Leave Collection", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        }
                    }
                }
            }
            
            if ownedFiltered.isEmpty && sharedFiltered.isEmpty && !vm.searchQuery.isEmpty {
                Section {
                    Text("No collections match your search")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 24)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await vm.refresh()
        }
        .searchable(text: Binding(
            get: { vm.searchQuery },
            set: { vm.searchQuery = $0 }
        ), prompt: "Search collections")
        .navigationDestination(for: RecipeCollection.self) { collection in
            if let vm = viewModel {
                CollectionRecipeListView(collection: collection, viewModel: vm)
            }
        }
    }
    
    @ViewBuilder
    private func collectionRow(collection: RecipeCollection, isShared: Bool) -> some View {
        HStack(spacing: 12) {
            if let emoji = collection.emoji, !emoji.isEmpty {
                Text(emoji)
                    .font(.title2)
            } else {
                Text("📁")
                    .font(.title2)
            }
            
            Text(collection.name)
                .font(.body)
                .lineLimit(1)
            
            Spacer()
            
            if isShared {
                Text("Shared")
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.15))
                    .foregroundStyle(.blue)
                    .clipShape(Capsule())
            }
            
            Text("\(recipeCount(for: collection))")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(.systemGray5))
                .clipShape(Capsule())
        }
        .padding(.vertical, 4)
    }
    
    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Loading collections...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No collections yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Create one to organize your recipes.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            Button {
                showCreateSheet = true
            } label: {
                Label("Create Collection", systemImage: "plus")
                    .fontWeight(.medium)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding()
    }
    
    private func initializeViewModelIfNeeded() {
        guard viewModel == nil else { return }
        guard let user = authViewModel.currentUser else { return }
        viewModel = RecipeViewModel(userId: user.id, userEmail: user.email ?? "")
    }
}

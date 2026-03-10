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
    @State private var expandedTemplateId: String?
    @State private var showTemplateAddToList = false
    @State private var templateIngredientsForSheet: [(name: String, quantity: String?, amount: Double?, unit: String?)] = []
    @State private var templateSaveSuccess: String?
    @State private var showOnlineSearch = false
    
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
                if let email = authViewModel.currentUser?.email {
                    ShareCollectionSheet(collection: collection, viewModel: viewModel!, ownerEmail: email)
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
            .sheet(item: $collectionToRename) { collection in
                if let vm = viewModel {
                    EditCollectionSheet(collection: collection, viewModel: vm)
                }
            }
            .sheet(isPresented: $showTemplateAddToList) {
                if let vm = viewModel {
                    AddToListSheet(
                        ingredients: templateIngredientsForSheet,
                        userId: vm.userId,
                        userEmail: vm.userEmail
                    ) {
                        showTemplateAddToList = false
                    }
                }
            }
        }
        .onAppear {
            initializeViewModelIfNeeded()
        }
    }
    
    @ViewBuilder
    private func listContent(vm: RecipeViewModel) -> some View {
        List {
            Section {
                NavigationLink {
                    OnlineRecipeSearchView(
                        userId: viewModel?.userId ?? UUID(),
                        userEmail: viewModel?.userEmail ?? "",
                        collections: viewModel?.collections ?? [],
                        activeCollectionId: viewModel?.activeCollectionId
                    )
                } label: {
                    Label("Search Online", systemImage: "globe")
                }
            }
            
            if !ownedFiltered.isEmpty {
                Section("My Collections") {
                    ForEach(ownedFiltered) { collection in
                        NavigationLink(value: collection) {
                            collectionRow(collection: collection, isShared: false)
                        }
                        .contextMenu {
                            Button {
                                collectionToRename = collection
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
            
            Section("Recipe Templates") {
                ForEach(RecipeTemplate.all) { template in
                    templateRow(template: template, vm: vm)
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
        .safeAreaInset(edge: .top, spacing: 0) {
            if vm.isShowingCachedData {
                CachedDataBanner(cachedAt: vm.cachedAt)
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
    
    @ViewBuilder
    private func templateRow(template: RecipeTemplate, vm: RecipeViewModel) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation {
                    if expandedTemplateId == template.id {
                        expandedTemplateId = nil
                    } else {
                        expandedTemplateId = template.id
                    }
                }
            } label: {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(template.name)
                            .font(.body)
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)
                        Text(template.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    
                    Spacer()
                    
                    Text("\(template.ingredients.count) ingredients")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(.systemGray5))
                        .clipShape(Capsule())
                    
                    Image(systemName: expandedTemplateId == template.id ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)
            
            if expandedTemplateId == template.id {
                VStack(alignment: .leading, spacing: 12) {
                    Divider()
                    
                    ForEach(template.ingredients, id: \.self) { ingredient in
                        Text(ingredient.prefix(1).uppercased() + ingredient.dropFirst())
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                    }
                    
                    HStack(spacing: 12) {
                        Button {
                            Task {
                                await vm.saveTemplateAsRecipe(template: template)
                                templateSaveSuccess = template.id
                                try? await Task.sleep(for: .seconds(1.5))
                                if templateSaveSuccess == template.id {
                                    templateSaveSuccess = nil
                                }
                            }
                        } label: {
                            HStack {
                                Image(systemName: templateSaveSuccess == template.id ? "checkmark" : "bookmark")
                                Text(templateSaveSuccess == template.id ? "Saved!" : "Save as Recipe")
                            }
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.blue.opacity(0.1))
                            .foregroundStyle(.blue)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        
                        Button {
                            templateIngredientsForSheet = vm.templateIngredientsForList(template: template)
                            showTemplateAddToList = true
                        } label: {
                            HStack {
                                Image(systemName: "cart.badge.plus")
                                Text("Add to List")
                            }
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.green.opacity(0.1))
                            .foregroundStyle(.green)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.top, 8)
                }
                .padding(.vertical, 8)
            }
        }
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

import SwiftUI

/// Recipes home screen. Collections are shown as collapsible groups with their
/// recipes nested inline, so recipes are visible without leaving the screen. A
/// single "+" adds a recipe (via a method chooser) or a collection; each
/// collection also has its own "+" to add a recipe straight into it.
struct CollectionBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel: RecipeViewModel?

    @State private var showCreateCollectionSheet = false
    @State private var collectionToDelete: RecipeCollection?
    @State private var showDeleteDialog = false
    @State private var collectionToShare: RecipeCollection?
    @State private var collectionToRename: RecipeCollection?

    // Expansion state
    @State private var expandedCollectionIds: Set<UUID> = []
    @State private var didInitExpansion = false
    @State private var expandedSharedIds: Set<UUID> = []
    @State private var sharedRecipesByCollection: [UUID: [Recipe]] = [:]
    @State private var loadingSharedIds: Set<UUID> = []

    // New-recipe flow
    @State private var showMethodChooser = false
    @State private var pendingCreateCollectionId: UUID?
    @State private var showScratchForm = false
    @State private var showImport = false
    @State private var showSearch = false

    // Recipe row actions
    @State private var recipeToEdit: Recipe?
    @State private var editIngredients: [RecipeIngredient] = []
    @State private var editSteps: [RecipeStep] = []
    @State private var editedCollectionId: UUID?
    @State private var recipeToDelete: Recipe?
    @State private var showRecipeDeleteDialog = false
    @State private var recipeToMove: Recipe?
    @State private var showMoveSheet = false

    private static let expandedKey = "gather.recipeExpandedCollections"

    private var ownedFiltered: [RecipeCollection] {
        guard let vm = viewModel else { return [] }
        guard !vm.searchQuery.isEmpty else { return vm.collections }
        let query = vm.searchQuery.lowercased()
        return vm.collections.filter { collection in
            collection.name.lowercased().contains(query) ||
            recipes(in: collection).contains { $0.name.lowercased().contains(query) }
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

    private func recipes(in collection: RecipeCollection) -> [Recipe] {
        viewModel?.recipes.filter { $0.collectionId == collection.id } ?? []
    }

    private func recipeCount(for collection: RecipeCollection) -> Int {
        recipes(in: collection).count
    }

    /// Recipe count for the header row. Shared collections load their recipes
    /// lazily, so the count is hidden (nil) until they have been fetched.
    private func displayedRecipeCount(for collection: RecipeCollection, isShared: Bool) -> Int? {
        isShared ? sharedRecipesByCollection[collection.id]?.count : recipeCount(for: collection)
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
                    Menu {
                        Button {
                            startNewRecipe(into: nil)
                        } label: {
                            Label("New Recipe", systemImage: "fork.knife")
                        }
                        Button {
                            showCreateCollectionSheet = true
                        } label: {
                            Label("New Collection", systemImage: "folder.badge.plus")
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .confirmationDialog("New Recipe", isPresented: $showMethodChooser, titleVisibility: .visible) {
                Button("Start from Scratch") { beginCreate { showScratchForm = true } }
                Button("Import from Text") { beginCreate { showImport = true } }
                Button("Search Online") { showSearch = true }
                Button("Cancel", role: .cancel) {}
            }
            .navigationDestination(for: Recipe.self) { recipe in
                if let vm = viewModel {
                    RecipeDetailView(recipe: recipe, viewModel: vm, userId: vm.userId, userEmail: vm.userEmail)
                }
            }
            .navigationDestination(isPresented: $showImport) {
                if let vm = viewModel { RecipeImportView(viewModel: vm) }
            }
            .navigationDestination(isPresented: $showSearch) {
                if let vm = viewModel {
                    OnlineRecipeSearchView(
                        userId: vm.userId,
                        userEmail: vm.userEmail,
                        collections: vm.allCollections,
                        activeCollectionId: vm.activeCollectionId
                    )
                }
            }
            .sheet(isPresented: $showCreateCollectionSheet) {
                if let vm = viewModel { CreateCollectionSheet(viewModel: vm) }
            }
            .sheet(isPresented: $showScratchForm, onDismiss: {
                reloadSharedRecipesIfNeeded(pendingCreateCollectionId)
            }) {
                if let vm = viewModel { RecipeFormSheet(viewModel: vm, showCollectionPicker: true) }
            }
            .sheet(item: $recipeToEdit, onDismiss: {
                reloadSharedRecipesIfNeeded(editedCollectionId)
                editedCollectionId = nil
            }) { recipe in
                if let vm = viewModel {
                    RecipeFormSheet(viewModel: vm, editRecipe: recipe, editIngredients: editIngredients, editSteps: editSteps)
                }
            }
            .sheet(item: $collectionToShare) { collection in
                if let email = authViewModel.currentUser?.email, let vm = viewModel {
                    ShareCollectionSheet(collection: collection, viewModel: vm, ownerEmail: email)
                }
            }
            .sheet(item: $collectionToRename) { collection in
                if let vm = viewModel { EditCollectionSheet(collection: collection, viewModel: vm) }
            }
            .sheet(isPresented: $showMoveSheet) { moveToCollectionSheet }
            .confirmationDialog(
                "Delete \"\(collectionToDelete?.name ?? "")\"?",
                isPresented: $showDeleteDialog,
                presenting: collectionToDelete
            ) { collection in
                Button("Move \(recipeCount(for: collection)) recipes to \(defaultCollectionName) and delete") {
                    Task { await viewModel?.deleteCollection(id: collection.id, deleteRecipes: false) }
                }
                Button("Delete collection and \(recipeCount(for: collection)) recipes", role: .destructive) {
                    Task { await viewModel?.deleteCollection(id: collection.id, deleteRecipes: true) }
                }
                Button("Cancel", role: .cancel) {}
            }
            .alert("Delete Recipe?", isPresented: $showRecipeDeleteDialog, presenting: recipeToDelete) { recipe in
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel?.deleteRecipe(id: recipe.id)
                        sharedRecipesByCollection[recipe.collectionId]?.removeAll { $0.id == recipe.id }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: { recipe in
                Text("Are you sure you want to delete \"\(recipe.name)\"? This cannot be undone.")
            }
        }
        .onAppear {
            initializeViewModelIfNeeded()
            initExpansionIfNeeded()
        }
        .onChange(of: viewModel?.collections.count ?? 0) { _, _ in
            initExpansionIfNeeded()
        }
        .onChange(of: showImport) { _, isShowing in
            if !isShowing { reloadSharedRecipesIfNeeded(viewModel?.activeCollectionId) }
        }
        .onChange(of: showSearch) { _, isShowing in
            if !isShowing { reloadSharedRecipesIfNeeded(viewModel?.activeCollectionId) }
        }
    }

    // MARK: - List content

    @ViewBuilder
    private func listContent(vm: RecipeViewModel) -> some View {
        List {
            ForEach(ownedFiltered) { collection in
                collectionDisclosure(collection)
            }

            ForEach(sharedFiltered) { collection in
                sharedDisclosure(collection)
            }

            if ownedFiltered.isEmpty && sharedFiltered.isEmpty && !vm.searchQuery.isEmpty {
                Text("No recipes or collections match your search")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 24)
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await vm.refresh() }
        .searchable(text: Binding(
            get: { vm.searchQuery },
            set: { vm.searchQuery = $0 }
        ), prompt: "Search recipes & collections")
        .safeAreaInset(edge: .top, spacing: 0) {
            if vm.isShowingCachedData {
                CachedDataBanner(cachedAt: vm.cachedAt)
            }
        }
    }

    // MARK: - Owned collection disclosure

    @ViewBuilder
    private func collectionDisclosure(_ collection: RecipeCollection) -> some View {
        let collectionRecipes = recipes(in: collection)
        DisclosureGroup(isExpanded: ownedBinding(collection.id)) {
            if collectionRecipes.isEmpty {
                Button {
                    startNewRecipe(into: collection.id)
                } label: {
                    Label("Add a recipe", systemImage: "plus")
                        .font(.subheadline)
                }
            } else {
                ForEach(collectionRecipes) { recipe in
                    recipeNavLink(recipe, owned: true)
                }
            }
        } label: {
            collectionHeader(collection, isShared: false)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    if !collection.isDefault {
                        Button(role: .destructive) {
                            collectionToDelete = collection
                            showDeleteDialog = true
                        } label: { Label("Delete", systemImage: "trash") }
                            .tint(.red)
                    }
                }
                .contextMenu {
                    Button { collectionToRename = collection } label: { Label("Rename", systemImage: "pencil") }
                    Button { collectionToShare = collection } label: { Label("Share", systemImage: "person.badge.plus") }
                    if !collection.isDefault {
                        Divider()
                        Button(role: .destructive) {
                            collectionToDelete = collection
                            showDeleteDialog = true
                        } label: { Label("Delete", systemImage: "trash") }
                    }
                }
        }
    }

    // MARK: - Shared collection disclosure

    @ViewBuilder
    private func sharedDisclosure(_ collection: RecipeCollection) -> some View {
        DisclosureGroup(isExpanded: sharedBinding(collection.id)) {
            let loaded = sharedRecipesByCollection[collection.id]
            if loaded == nil && loadingSharedIds.contains(collection.id) {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if let loaded, loaded.isEmpty {
                Button {
                    startNewRecipe(into: collection.id)
                } label: {
                    Label("Add a recipe", systemImage: "plus")
                        .font(.subheadline)
                }
            } else {
                ForEach(loaded ?? []) { recipe in
                    recipeNavLink(recipe, owned: false)
                }
            }
        } label: {
            collectionHeader(collection, isShared: true)
                .contextMenu {
                    Button(role: .destructive) {
                        Task {
                            if let email = authViewModel.currentUser?.email {
                                try? await viewModel?.unshareCollection(id: collection.id, email: email)
                                viewModel?.sharedCollections.removeAll { $0.id == collection.id }
                            }
                        }
                    } label: { Label("Leave Collection", systemImage: "rectangle.portrait.and.arrow.right") }
                }
        }
    }

    @ViewBuilder
    private func collectionHeader(_ collection: RecipeCollection, isShared: Bool) -> some View {
        HStack(spacing: 12) {
            Text((collection.emoji?.containsVisualEmoji == true ? collection.emoji : nil) ?? "📁")
                .font(.title3)
            Text(collection.name)
                .font(.body)
                .fontWeight(.medium)
                .lineLimit(1)
            Spacer(minLength: 8)
            if let collaborators = viewModel?.collaboratorsByCollectionId[collection.id], !collaborators.isEmpty {
                AvatarGroupView(
                    collaborators: collaborators,
                    size: 28,
                    color: Color.brandGreen
                )
            }
            if let count = displayedRecipeCount(for: collection, isShared: isShared) {
                Text("\(count)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Button {
                startNewRecipe(into: collection.id)
            } label: {
                Image(systemName: "plus")
                    .font(.body)
                    .foregroundStyle(Color.brandGreen)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Add recipe to \(collection.name)")
        }
    }

    // MARK: - Recipe row

    /// `owned` means the enclosing collection is owned by the user. Rows in
    /// shared collections still get Edit and Delete (collaborators have write
    /// access); Move stays owner-only since it can pull a recipe out of the
    /// shared collection.
    @ViewBuilder
    private func recipeNavLink(_ recipe: Recipe, owned: Bool) -> some View {
        NavigationLink(value: recipe) {
            recipeRow(recipe)
        }
        .contextMenu {
            Button { beginEdit(recipe) } label: { Label("Edit", systemImage: "pencil") }
            if owned {
                Button { recipeToMove = recipe; showMoveSheet = true } label: { Label("Move to Collection", systemImage: "folder") }
            }
            Divider()
            Button(role: .destructive) { recipeToDelete = recipe; showRecipeDeleteDialog = true } label: { Label("Delete", systemImage: "trash") }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) { recipeToDelete = recipe; showRecipeDeleteDialog = true } label: { Label("Delete", systemImage: "trash") }
                .tint(.red)
        }
    }

    @ViewBuilder
    private func recipeRow(_ recipe: Recipe) -> some View {
        HStack(spacing: 12) {
            if let imageUrl = recipe.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle().fill(Color(.systemGray5))
                        .overlay { Image(systemName: "photo").foregroundStyle(.secondary) }
                }
                .frame(width: 44, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))
                    .frame(width: 44, height: 44)
                    .overlay { Image(systemName: "fork.knife").foregroundStyle(.secondary) }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(recipe.name)
                    .font(.body)
                    .lineLimit(1)
                Text("\(recipe.ingredientCount) ingredients · \(recipe.stepCount) steps")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: - Move sheet

    @ViewBuilder
    private var moveToCollectionSheet: some View {
        NavigationStack {
            List {
                ForEach(viewModel?.collections.filter { $0.id != recipeToMove?.collectionId } ?? []) { target in
                    Button {
                        if let recipe = recipeToMove {
                            Task {
                                await viewModel?.moveRecipe(recipeId: recipe.id, toCollectionId: target.id)
                                showMoveSheet = false
                                recipeToMove = nil
                            }
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Text((target.emoji?.containsVisualEmoji == true ? target.emoji : nil) ?? "📁").font(.title2)
                            Text(target.name).font(.body)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle("Move to Collection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showMoveSheet = false; recipeToMove = nil }
                }
            }
        }
    }

    // MARK: - States

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView().scaleEffect(1.2)
            Text("Loading recipes...").font(.subheadline).foregroundStyle(.secondary)
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No recipes yet").font(.title2).fontWeight(.semibold)
            Text("Add a recipe or create a collection to organize them.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                startNewRecipe(into: nil)
            } label: {
                Label("New Recipe", systemImage: "plus").fontWeight(.medium)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.brandGreen)
            .padding(.top, 8)
        }
        .padding()
    }

    // MARK: - Helpers

    private func ownedBinding(_ id: UUID) -> Binding<Bool> {
        Binding(
            get: { expandedCollectionIds.contains(id) },
            set: { isOpen in
                if isOpen { expandedCollectionIds.insert(id) } else { expandedCollectionIds.remove(id) }
                persistExpansion()
            }
        )
    }

    private func sharedBinding(_ id: UUID) -> Binding<Bool> {
        Binding(
            get: { expandedSharedIds.contains(id) },
            set: { isOpen in
                if isOpen {
                    expandedSharedIds.insert(id)
                    Task { await loadSharedRecipes(collectionId: id) }
                } else {
                    expandedSharedIds.remove(id)
                }
            }
        )
    }

    @MainActor
    private func loadSharedRecipes(collectionId: UUID) async {
        loadingSharedIds.insert(collectionId)
        defer { loadingSharedIds.remove(collectionId) }
        do {
            sharedRecipesByCollection[collectionId] = try await RecipeService.fetchRecipesForCollection(collectionId: collectionId)
        } catch {
            sharedRecipesByCollection[collectionId] = []
            print("[CollectionBrowserView] Failed to load shared recipes: \(error.localizedDescription)")
        }
    }

    private func startNewRecipe(into collectionId: UUID?) {
        pendingCreateCollectionId = collectionId
        showMethodChooser = true
    }

    /// Sets the target collection (so the recipe form / import default to it),
    /// then runs the presentation closure.
    private func beginCreate(_ present: () -> Void) {
        if let target = pendingCreateCollectionId {
            viewModel?.selectCollection(id: target)
        }
        present()
    }

    private func beginEdit(_ recipe: Recipe) {
        Task {
            await viewModel?.selectRecipe(id: recipe.id)
            if let detail = viewModel?.activeRecipeDetail {
                editIngredients = detail.ingredients
                editSteps = detail.steps
            } else {
                editIngredients = []
                editSteps = []
            }
            editedCollectionId = recipe.collectionId
            recipeToEdit = recipe
        }
    }

    /// Refetches a shared collection's lazily-loaded recipes after a mutation,
    /// so collaborator adds/edits show up without collapsing and re-expanding.
    private func reloadSharedRecipesIfNeeded(_ collectionId: UUID?) {
        guard let collectionId,
              viewModel?.sharedCollections.contains(where: { $0.id == collectionId }) == true,
              sharedRecipesByCollection[collectionId] != nil || expandedSharedIds.contains(collectionId)
        else { return }
        Task { await loadSharedRecipes(collectionId: collectionId) }
    }

    private func initExpansionIfNeeded() {
        guard !didInitExpansion, let vm = viewModel, !vm.collections.isEmpty else { return }
        didInitExpansion = true
        if let stored = UserDefaults.standard.array(forKey: Self.expandedKey) as? [String] {
            expandedCollectionIds = Set(stored.compactMap { UUID(uuidString: $0) })
        } else {
            // First run: expand all so recipes are visible right away.
            expandedCollectionIds = Set(vm.collections.map { $0.id })
        }
    }

    private func persistExpansion() {
        UserDefaults.standard.set(expandedCollectionIds.map { $0.uuidString }, forKey: Self.expandedKey)
    }

    private func initializeViewModelIfNeeded() {
        guard viewModel == nil else { return }
        guard let user = authViewModel.currentUser else { return }
        viewModel = RecipeViewModel(userId: user.id, userEmail: user.email ?? "")
    }
}

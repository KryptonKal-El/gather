import SwiftUI

/// Recipes home screen. Recipes render as photo cards in a two-column grid;
/// collections are a horizontal row of filter chips above it. "All" shows every
/// recipe (each card carries its collection's emoji marker), and selecting a
/// collection chip filters the grid and shows that collection's header with its
/// actions. A single "+" adds a recipe (via a method chooser) or a collection.
struct CollectionBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel: RecipeViewModel?

    @State private var showCreateCollectionSheet = false
    @State private var collectionToDelete: RecipeCollection?
    @State private var showDeleteDialog = false
    @State private var collectionToShare: RecipeCollection?
    @State private var collectionToRename: RecipeCollection?

    // Chip selection (nil = All). Persisted so a relaunch restores the filter.
    @State private var selectedCollectionId: UUID?
    @State private var didInitSelection = false

    // Shared-collection recipes, fetched eagerly so "All" really shows everything.
    @State private var sharedRecipesByCollection: [UUID: [Recipe]] = [:]
    @State private var loadingSharedIds: Set<UUID> = []

    // New-recipe flow
    @State private var showMethodChooser = false
    @State private var pendingCreateCollectionId: UUID?
    @State private var showScratchForm = false
    @State private var showImport = false
    @State private var showSearch = false

    // Recipe card actions
    @State private var recipeToEdit: Recipe?
    @State private var editIngredients: [RecipeIngredient] = []
    @State private var editSteps: [RecipeStep] = []
    @State private var editedCollectionId: UUID?
    @State private var recipeToDelete: Recipe?
    @State private var showRecipeDeleteDialog = false
    @State private var recipeToMove: Recipe?
    @State private var showMoveSheet = false

    private static let selectedKey = "gather.recipeSelectedCollection"

    private let gridColumns = [
        GridItem(.flexible(), spacing: 14),
        GridItem(.flexible(), spacing: 14)
    ]

    private var hasNoCollections: Bool {
        guard let vm = viewModel else { return true }
        return vm.collections.isEmpty && vm.sharedCollections.isEmpty
    }

    private var selectedCollection: RecipeCollection? {
        guard let id = selectedCollectionId else { return nil }
        return viewModel?.allCollections.first(where: { $0.id == id })
    }

    private func isShared(_ collection: RecipeCollection) -> Bool {
        viewModel?.sharedCollections.contains(where: { $0.id == collection.id }) ?? false
    }

    private func recipes(in collection: RecipeCollection) -> [Recipe] {
        if isShared(collection) {
            return sharedRecipesByCollection[collection.id] ?? []
        }
        return viewModel?.recipes.filter { $0.collectionId == collection.id } ?? []
    }

    private func recipeCount(for collection: RecipeCollection) -> Int {
        recipes(in: collection).count
    }

    private func collection(for recipe: Recipe) -> RecipeCollection? {
        viewModel?.allCollections.first(where: { $0.id == recipe.collectionId })
    }

    /// `owned` means the recipe's collection is owned by the user; Move stays
    /// owner-only since it can pull a recipe out of a shared collection.
    private func isOwned(_ recipe: Recipe) -> Bool {
        viewModel?.collections.contains(where: { $0.id == recipe.collectionId }) ?? false
    }

    /// The cards currently in the grid: the selected collection's recipes, or
    /// every recipe (owned + loaded shared) for "All" — filtered by the search
    /// query against recipe and collection names.
    private var displayedRecipes: [Recipe] {
        guard let vm = viewModel else { return [] }
        var result: [Recipe]
        if let selected = selectedCollection {
            result = recipes(in: selected)
        } else {
            let shared = vm.sharedCollections.flatMap { sharedRecipesByCollection[$0.id] ?? [] }
            result = vm.recipes + shared
        }
        let query = vm.searchQuery.lowercased()
        guard !query.isEmpty else { return result }
        return result.filter { recipe in
            recipe.name.lowercased().contains(query) ||
            (collection(for: recipe)?.name.lowercased().contains(query) ?? false)
        }
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
                        gridContent(vm: vm)
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
                            startNewRecipe(into: selectedCollectionId)
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
                if RecipeTextParseService.isAvailable {
                    Button("Import from Text") { beginCreate { showImport = true } }
                }
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
                    Task { await deleteCollection(collection, deleteRecipes: false) }
                }
                Button("Delete collection and \(recipeCount(for: collection)) recipes", role: .destructive) {
                    Task { await deleteCollection(collection, deleteRecipes: true) }
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
            initSelectionIfNeeded()
        }
        .onChange(of: viewModel?.sharedCollections.count ?? 0) { _, _ in
            Task { await loadAllSharedRecipes() }
        }
        .onChange(of: viewModel?.collections.count ?? 0) { _, _ in
            initSelectionIfNeeded()
            validateSelection()
        }
        .onChange(of: showImport) { _, isShowing in
            if !isShowing { reloadSharedRecipesIfNeeded(viewModel?.activeCollectionId) }
        }
        .onChange(of: showSearch) { _, isShowing in
            if !isShowing { reloadSharedRecipesIfNeeded(viewModel?.activeCollectionId) }
        }
    }

    // MARK: - Grid content

    @ViewBuilder
    private func gridContent(vm: RecipeViewModel) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                chipRow(vm: vm)

                if let selected = selectedCollection {
                    collectionHeaderCard(selected)
                        .padding(.horizontal, 16)
                }

                if let selected = selectedCollection, loadingSharedIds.contains(selected.id),
                   sharedRecipesByCollection[selected.id] == nil {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .padding(.vertical, 32)
                } else if displayedRecipes.isEmpty {
                    gridEmptyState(vm: vm)
                } else {
                    LazyVGrid(columns: gridColumns, spacing: 14) {
                        ForEach(displayedRecipes) { recipe in
                            recipeCardLink(recipe)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.vertical, 8)
        }
        .background(Color(.systemGroupedBackground))
        .refreshable {
            await vm.refresh()
            await loadAllSharedRecipes()
        }
        .searchable(text: Binding(
            get: { vm.searchQuery },
            set: { vm.searchQuery = $0 }
        ), prompt: "Search recipes & collections")
        .safeAreaInset(edge: .top, spacing: 0) {
            if vm.isShowingCachedData {
                CachedDataBanner(cachedAt: vm.cachedAt)
            }
        }
        .task {
            await loadAllSharedRecipes()
        }
    }

    // MARK: - Collection chips

    @ViewBuilder
    private func chipRow(vm: RecipeViewModel) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(label: "All", emoji: nil, isSelected: selectedCollectionId == nil) {
                    select(nil)
                }

                ForEach(vm.allCollections) { collection in
                    chip(
                        label: collection.name,
                        emoji: (collection.emoji?.containsVisualEmoji == true ? collection.emoji : nil) ?? "📁",
                        isSelected: selectedCollectionId == collection.id
                    ) {
                        select(collection.id)
                    }
                    .contextMenu { collectionMenuItems(collection) }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    @ViewBuilder
    private func chip(label: String, emoji: String?, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let emoji {
                    Text(emoji)
                }
                Text(label)
                    .fontWeight(isSelected ? .semibold : .medium)
            }
            .font(.quicksand(.subheadline))
            .lineLimit(1)
            .padding(.horizontal, 13)
            .padding(.vertical, 8)
            .background(isSelected ? Color.brandGreen : Color(.secondarySystemGroupedBackground))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func collectionMenuItems(_ collection: RecipeCollection) -> some View {
        if isShared(collection) {
            Button(role: .destructive) {
                leaveCollection(collection)
            } label: { Label("Leave Collection", systemImage: "rectangle.portrait.and.arrow.right") }
        } else {
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

    // MARK: - Selected collection header

    @ViewBuilder
    private func collectionHeaderCard(_ collection: RecipeCollection) -> some View {
        HStack(spacing: 10) {
            Text((collection.emoji?.containsVisualEmoji == true ? collection.emoji : nil) ?? "📁")
                .font(.quicksand(.title3))
            Text(collection.name)
                .font(.quicksand(.headline))
                .lineLimit(1)
            Text("\(recipeCount(for: collection))")
                .font(.quicksand(.subheadline))
                .foregroundStyle(.secondary)
            Spacer(minLength: 8)
            if let collaborators = viewModel?.collaboratorsByCollectionId[collection.id], !collaborators.isEmpty {
                AvatarGroupView(
                    collaborators: collaborators,
                    size: 28,
                    color: Color.brandGreen
                )
            }
            Button {
                startNewRecipe(into: collection.id)
            } label: {
                Image(systemName: "plus")
                    .font(.quicksand(.body))
                    .foregroundStyle(Color.brandGreen)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Add recipe to \(collection.name)")
            Menu {
                collectionMenuItems(collection)
            } label: {
                Image(systemName: "ellipsis")
                    .font(.quicksand(.body))
                    .foregroundStyle(Color.brandGreen)
                    .frame(width: 28, height: 28)
            }
            .accessibilityLabel("Options for \(collection.name)")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Recipe cards

    @ViewBuilder
    private func recipeCardLink(_ recipe: Recipe) -> some View {
        NavigationLink(value: recipe) {
            recipeCard(recipe)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button { beginEdit(recipe) } label: { Label("Edit", systemImage: "pencil") }
            if isOwned(recipe) {
                Button { recipeToMove = recipe; showMoveSheet = true } label: { Label("Move to Collection", systemImage: "folder") }
            }
            Divider()
            Button(role: .destructive) { recipeToDelete = recipe; showRecipeDeleteDialog = true } label: { Label("Delete", systemImage: "trash") }
        }
    }

    @ViewBuilder
    private func recipeCard(_ recipe: Recipe) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                Group {
                    if let imageUrl = recipe.imageUrl, let url = URL(string: imageUrl) {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            cardImagePlaceholder
                        }
                    } else {
                        cardImagePlaceholder
                    }
                }
                .frame(height: 104)
                .frame(maxWidth: .infinity)
                .clipped()

                // Collection marker, shown in the "All" view where the grid mixes collections.
                if selectedCollectionId == nil, let collection = collection(for: recipe) {
                    Text((collection.emoji?.containsVisualEmoji == true ? collection.emoji : nil) ?? "📁")
                        .font(.quicksand(.caption))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(.thinMaterial, in: Capsule())
                        .padding(8)
                }
            }
            .overlay(alignment: .topTrailing) {
                if let collaborators = viewModel?.collaboratorsByCollectionId[recipe.collectionId], !collaborators.isEmpty {
                    AvatarGroupView(
                        collaborators: collaborators,
                        size: 22,
                        color: Color.brandGreen
                    )
                    .padding(8)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(recipe.name)
                    .font(.quicksand(.subheadline))
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text("\(recipe.ingredientCount) ingredients · \(recipe.stepCount) steps")
                    .font(.quicksand(.caption))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.top, 10)
            .padding(.bottom, 12)
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }

    private var cardImagePlaceholder: some View {
        Rectangle()
            .fill(Color.brandGreen.opacity(0.10))
            .overlay {
                Image(systemName: "fork.knife")
                    .font(.quicksand(.title2))
                    .foregroundStyle(Color.brandGreen.opacity(0.6))
            }
    }

    // MARK: - Empty states

    @ViewBuilder
    private func gridEmptyState(vm: RecipeViewModel) -> some View {
        if !vm.searchQuery.isEmpty {
            Text("No recipes match your search")
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 32)
        } else {
            VStack(spacing: 12) {
                Image(systemName: "fork.knife")
                    .font(.quicksand(size: 32))
                    .foregroundStyle(.secondary)
                Text(selectedCollection == nil ? "No recipes yet" : "Nothing in this collection yet")
                    .font(.quicksand(.subheadline))
                    .foregroundStyle(.secondary)
                Button {
                    startNewRecipe(into: selectedCollectionId)
                } label: {
                    Label("Add a recipe", systemImage: "plus")
                        .font(.quicksand(.subheadline, weight: .medium))
                }
                .buttonStyle(.bordered)
                .tint(Color.brandGreen)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 40)
        }
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
                            Text((target.emoji?.containsVisualEmoji == true ? target.emoji : nil) ?? "📁").font(.quicksand(.title2))
                            Text(target.name).font(.quicksand(.body))
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
            Text("Loading recipes...").font(.quicksand(.subheadline)).foregroundStyle(.secondary)
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.quicksand(size: 48))
                .foregroundStyle(.secondary)
            Text("No recipes yet").font(.quicksand(.title2)).fontWeight(.semibold)
            Text("Add a recipe or create a collection to organize them.")
                .font(.quicksand(.subheadline))
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

    // MARK: - Selection

    private func select(_ collectionId: UUID?) {
        selectedCollectionId = collectionId
        UserDefaults.standard.set(collectionId?.uuidString ?? "", forKey: Self.selectedKey)
        if let collectionId {
            viewModel?.selectCollection(id: collectionId)
            if viewModel?.sharedCollections.contains(where: { $0.id == collectionId }) == true,
               sharedRecipesByCollection[collectionId] == nil {
                Task { await loadSharedRecipes(collectionId: collectionId) }
            }
        }
    }

    private func initSelectionIfNeeded() {
        guard !didInitSelection, let vm = viewModel, !vm.collections.isEmpty || !vm.sharedCollections.isEmpty else { return }
        didInitSelection = true
        if let stored = UserDefaults.standard.string(forKey: Self.selectedKey), !stored.isEmpty,
           let id = UUID(uuidString: stored),
           vm.allCollections.contains(where: { $0.id == id }) {
            selectedCollectionId = id
        }
    }

    /// Clears the selection if the selected collection disappeared (deleted, unshared).
    private func validateSelection() {
        guard let id = selectedCollectionId, let vm = viewModel else { return }
        if !vm.allCollections.contains(where: { $0.id == id }) {
            select(nil)
        }
    }

    // MARK: - Shared recipes

    /// Fetches recipes for every shared collection so the "All" grid includes them.
    @MainActor
    private func loadAllSharedRecipes() async {
        guard let vm = viewModel else { return }
        await withTaskGroup(of: Void.self) { group in
            for collection in vm.sharedCollections where sharedRecipesByCollection[collection.id] == nil {
                group.addTask { @MainActor in
                    await loadSharedRecipes(collectionId: collection.id)
                }
            }
        }
    }

    @MainActor
    private func loadSharedRecipes(collectionId: UUID) async {
        guard !loadingSharedIds.contains(collectionId) else { return }
        loadingSharedIds.insert(collectionId)
        defer { loadingSharedIds.remove(collectionId) }
        do {
            sharedRecipesByCollection[collectionId] = try await RecipeService.fetchRecipesForCollection(collectionId: collectionId)
        } catch {
            sharedRecipesByCollection[collectionId] = []
            print("[CollectionBrowserView] Failed to load shared recipes: \(error.localizedDescription)")
        }
    }

    // MARK: - Actions

    private func deleteCollection(_ collection: RecipeCollection, deleteRecipes: Bool) async {
        await viewModel?.deleteCollection(id: collection.id, deleteRecipes: deleteRecipes)
        if selectedCollectionId == collection.id {
            select(nil)
        }
    }

    private func leaveCollection(_ collection: RecipeCollection) {
        Task {
            if let email = authViewModel.currentUser?.email {
                try? await viewModel?.unshareCollection(id: collection.id, email: email)
                viewModel?.sharedCollections.removeAll { $0.id == collection.id }
                sharedRecipesByCollection[collection.id] = nil
                if selectedCollectionId == collection.id {
                    select(nil)
                }
            }
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

    /// Refetches a shared collection's recipes after a mutation, so
    /// collaborator adds/edits show up immediately.
    private func reloadSharedRecipesIfNeeded(_ collectionId: UUID?) {
        guard let collectionId,
              viewModel?.sharedCollections.contains(where: { $0.id == collectionId }) == true
        else { return }
        Task {
            sharedRecipesByCollection[collectionId] = nil
            await loadSharedRecipes(collectionId: collectionId)
        }
    }

    private func initializeViewModelIfNeeded() {
        guard viewModel == nil else { return }
        guard let user = authViewModel.currentUser else { return }
        viewModel = RecipeViewModel(userId: user.id, userEmail: user.email ?? "")
    }
}

import SwiftUI

struct CollectionRecipeListView: View {
    let collection: RecipeCollection
    let viewModel: RecipeViewModel
    
    @State private var searchQuery = ""
    @State private var showCreateRecipe = false
    @State private var recipeToEdit: Recipe?
    @State private var recipeToDelete: Recipe?
    @State private var showDeleteConfirm = false
    @State private var showMoveSheet = false
    @State private var recipeToMove: Recipe?
    @State private var editIngredients: [RecipeIngredient] = []
    @State private var editSteps: [RecipeStep] = []
    @State private var isLoadingEdit = false
    
    private var filteredRecipes: [Recipe] {
        let collectionRecipes = viewModel.recipes.filter { $0.collectionId == collection.id }
        guard !searchQuery.isEmpty else { return collectionRecipes }
        let query = searchQuery.lowercased()
        return collectionRecipes.filter { $0.name.lowercased().contains(query) }
    }
    
    var body: some View {
        Group {
            if filteredRecipes.isEmpty && searchQuery.isEmpty {
                emptyStateView
            } else if filteredRecipes.isEmpty {
                noSearchResultsView
            } else {
                recipeList
            }
        }
        .navigationTitle(collection.name)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showCreateRecipe = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .searchable(text: $searchQuery, prompt: "Search recipes")
        .refreshable {
            await viewModel.refresh()
        }
        .sheet(isPresented: $showCreateRecipe) {
            RecipeFormSheet(viewModel: viewModel)
        }
        .sheet(item: $recipeToEdit) { recipe in
            RecipeFormSheet(
                viewModel: viewModel,
                editRecipe: recipe,
                editIngredients: editIngredients,
                editSteps: editSteps
            )
        }
        .sheet(isPresented: $showMoveSheet) {
            moveToCollectionSheet
        }
        .alert("Delete Recipe?", isPresented: $showDeleteConfirm, presenting: recipeToDelete) { recipe in
            Button("Delete", role: .destructive) {
                Task { await viewModel.deleteRecipe(id: recipe.id) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { recipe in
            Text("Are you sure you want to delete \"\(recipe.name)\"? This cannot be undone.")
        }
        .onAppear {
            viewModel.selectCollection(id: collection.id)
        }
        // Navigation destination for RecipeDetailView (placeholder until US-010)
        .navigationDestination(for: Recipe.self) { recipe in
            Text("Recipe Detail: \(recipe.name)")
                .navigationTitle(recipe.name)
        }
    }
    
    @ViewBuilder
    private var recipeList: some View {
        List {
            ForEach(filteredRecipes) { recipe in
                NavigationLink(value: recipe) {
                    recipeRow(recipe)
                }
                .contextMenu {
                    Button {
                        Task {
                            isLoadingEdit = true
                            await viewModel.selectRecipe(id: recipe.id)
                            if let detail = viewModel.activeRecipeDetail {
                                editIngredients = detail.ingredients
                                editSteps = detail.steps
                            } else {
                                editIngredients = []
                                editSteps = []
                            }
                            recipeToEdit = recipe
                            isLoadingEdit = false
                        }
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    
                    Button {
                        recipeToMove = recipe
                        showMoveSheet = true
                    } label: {
                        Label("Move to Collection", systemImage: "folder")
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) {
                        recipeToDelete = recipe
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        recipeToDelete = recipe
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
    
    @ViewBuilder
    private func recipeRow(_ recipe: Recipe) -> some View {
        HStack(spacing: 12) {
            // Recipe image or placeholder
            if let imageUrl = recipe.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .overlay {
                            Image(systemName: "photo")
                                .foregroundStyle(.secondary)
                        }
                }
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))
                    .frame(width: 56, height: 56)
                    .overlay {
                        Image(systemName: "fork.knife")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(recipe.name)
                    .font(.body)
                    .lineLimit(1)
                
                Text("\(recipe.ingredientCount) ingredients · \(recipe.stepCount) steps")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "fork.knife")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No recipes yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Tap + to create one")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            Button {
                showCreateRecipe = true
            } label: {
                Label("Create Recipe", systemImage: "plus")
                    .fontWeight(.medium)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding()
    }
    
    private var noSearchResultsView: some View {
        VStack(spacing: 12) {
            Text("No recipes match your search")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
    @ViewBuilder
    private var moveToCollectionSheet: some View {
        NavigationStack {
            List {
                ForEach(viewModel.collections.filter { $0.id != collection.id }) { targetCollection in
                    Button {
                        if let recipe = recipeToMove {
                            Task {
                                await viewModel.moveRecipe(recipeId: recipe.id, toCollectionId: targetCollection.id)
                                showMoveSheet = false
                                recipeToMove = nil
                            }
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Text(targetCollection.emoji ?? "")
                                .font(.title2)
                            Text(targetCollection.name)
                                .font(.body)
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
                    Button("Cancel") {
                        showMoveSheet = false
                        recipeToMove = nil
                    }
                }
            }
        }
    }
}

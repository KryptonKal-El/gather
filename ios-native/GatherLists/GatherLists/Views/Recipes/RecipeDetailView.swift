import SwiftUI

/// A pushed view showing full recipe details with ingredients, steps, and actions.
struct RecipeDetailView: View {
    @Environment(\.dismiss) private var dismiss
    
    let recipe: Recipe
    let viewModel: RecipeViewModel
    
    @State private var checkedIngredients: Set<UUID> = []
    @State private var showEditSheet = false
    @State private var showDeleteConfirm = false
    @State private var showMoveSheet = false
    @State private var editIngredients: [RecipeIngredient] = []
    @State private var editSteps: [RecipeStep] = []
    
    var body: some View {
        Group {
            if viewModel.activeRecipeDetail == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                scrollContent
            }
        }
        .navigationTitle(recipe.name)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        Task {
                            await viewModel.selectRecipe(id: recipe.id)
                            if let detail = viewModel.activeRecipeDetail {
                                editIngredients = detail.ingredients
                                editSteps = detail.steps
                            }
                            showEditSheet = true
                        }
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    
                    Button {
                        showMoveSheet = true
                    } label: {
                        Label("Move to Collection", systemImage: "folder")
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
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
        .confirmationDialog("Delete Recipe?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteRecipe(id: recipe.id)
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .onAppear {
            Task { await viewModel.selectRecipe(id: recipe.id) }
        }
    }
    
    @ViewBuilder
    private var scrollContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if let imageUrl = recipe.imageUrl, let url = URL(string: imageUrl) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Rectangle()
                            .fill(Color(.systemGray5))
                            .overlay {
                                ProgressView()
                            }
                    }
                    .frame(maxWidth: .infinity, maxHeight: 250)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                
                if let description = recipe.description, !description.isEmpty {
                    Text(description)
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                
                ingredientsSection
                stepsSection
            }
            .padding()
        }
    }
    
    @ViewBuilder
    private var ingredientsSection: some View {
        let ingredients = viewModel.activeRecipeDetail?.ingredients ?? []
        
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Ingredients")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("\(ingredients.count)")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())
            }
            
            ForEach(ingredients) { ingredient in
                HStack(spacing: 12) {
                    Button {
                        toggleIngredient(ingredient.id)
                    } label: {
                        Image(systemName: checkedIngredients.contains(ingredient.id) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(checkedIngredients.contains(ingredient.id) ? .green : .secondary)
                            .font(.title3)
                    }
                    .buttonStyle(.plain)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ingredient.name)
                            .strikethrough(checkedIngredients.contains(ingredient.id))
                            .foregroundStyle(checkedIngredients.contains(ingredient.id) ? .secondary : .primary)
                        if let qty = ingredient.quantity, !qty.isEmpty {
                            Text(qty)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private var stepsSection: some View {
        let steps = viewModel.activeRecipeDetail?.steps ?? []
        
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Steps")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("\(steps.count)")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())
            }
            
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.accentColor)
                        .clipShape(Circle())
                    
                    Text(step.instruction)
                        .font(.body)
                }
            }
        }
    }
    
    @ViewBuilder
    private var moveToCollectionSheet: some View {
        NavigationStack {
            List {
                ForEach(viewModel.collections.filter { $0.id != recipe.collectionId }) { targetCollection in
                    Button {
                        Task {
                            await viewModel.moveRecipe(recipeId: recipe.id, toCollectionId: targetCollection.id)
                            showMoveSheet = false
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
                    }
                }
            }
        }
    }
    
    private func toggleIngredient(_ id: UUID) {
        if checkedIngredients.contains(id) {
            checkedIngredients.remove(id)
        } else {
            checkedIngredients.insert(id)
        }
    }
}

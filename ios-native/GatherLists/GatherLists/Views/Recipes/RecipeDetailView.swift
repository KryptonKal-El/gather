import SwiftUI

/// A pushed view showing full recipe details with ingredients, steps, and actions.
struct RecipeDetailView: View {
    @Environment(\.dismiss) private var dismiss
    
    let recipe: Recipe
    let viewModel: RecipeViewModel
    let userId: UUID
    let userEmail: String
    
    @State private var checkedIngredients: Set<UUID> = []
    @State private var showEditSheet = false
    @State private var showDeleteConfirm = false
    @State private var showMoveSheet = false
    @State private var showAddToListSheet = false
    @State private var addAllToList = false
    @State private var editIngredients: [RecipeIngredient] = []
    @State private var editSteps: [RecipeStep] = []
    @State private var cookViewModel: CookSessionViewModel?
    @State private var showCookMode = false
    @State private var showCookHistorySheet = false

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
                        addAllToList = true
                        showAddToListSheet = true
                    } label: {
                        Label("Add to List", systemImage: "cart.badge.plus")
                    }
                    
                    if viewModel.canEditRecipe(recipe) {
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

                        // Moving can pull a recipe out of a shared collection,
                        // so it stays limited to the recipe's owner.
                        if recipe.ownerId == userId {
                            Button {
                                showMoveSheet = true
                            } label: {
                                Label("Move to Collection", systemImage: "folder")
                            }
                        }

                        Divider()

                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis")
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
        .sheet(isPresented: $showAddToListSheet) {
            AddToListSheet(
                ingredients: addAllToList ? allIngredientsData : checkedIngredientsData,
                userId: userId,
                userEmail: userEmail,
                onDismiss: {
                    checkedIngredients.removeAll()
                    addAllToList = false
                    showAddToListSheet = false
                }
            )
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
        .sheet(isPresented: $showCookHistorySheet) {
            cookHistorySheet
        }
        .fullScreenCover(isPresented: $showCookMode, onDismiss: {
            Task { await cookViewModel?.loadState() }
        }) {
            if let cookViewModel {
                CookModeView(
                    recipe: recipe,
                    ingredients: viewModel.activeRecipeDetail?.ingredients ?? [],
                    cookViewModel: cookViewModel
                )
            }
        }
        .onAppear {
            if cookViewModel == nil {
                cookViewModel = CookSessionViewModel(recipeId: recipe.id, recipeName: recipe.name, userId: userId)
            }
            Task {
                await viewModel.selectRecipe(id: recipe.id)
                await cookViewModel?.loadState()
            }
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
                        .font(.quicksand(.body))
                        .foregroundStyle(.secondary)
                }
                
                startCookingButton
                RecipeAttributesSection(recipe: recipe, canEdit: viewModel.canEditRecipe(recipe), userId: userId)
                ingredientsSection
                stepsSection
                cookHistorySection
            }
            .padding()
        }
    }

    @ViewBuilder
    private var startCookingButton: some View {
        let hasActiveCook = cookViewModel?.activeSession != nil

        Button {
            if hasActiveCook {
                showCookMode = true
            } else {
                Task {
                    let steps = viewModel.activeRecipeDetail?.steps ?? []
                    if await cookViewModel?.startCook(steps: steps) == true {
                        showCookMode = true
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: hasActiveCook ? "arrow.clockwise" : "frying.pan")
                Text(hasActiveCook ? "Continue Cooking" : "Start Cooking")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(hasActiveCook ? Color.orange : Color.accentColor)
            .foregroundStyle(.white)
            .fontWeight(.semibold)
            .cornerRadius(12)
        }
    }

    @ViewBuilder
    private var cookHistorySection: some View {
        let history = cookViewModel?.history ?? []

        if !history.isEmpty {
            Button {
                showCookHistorySheet = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.quicksand(.title3))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(history.count == 1 ? "Cooked once" : "Cooked \(history.count) times")
                            .font(.quicksand(.body))
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)
                        if let lastCooked = history.first?.completedAt {
                            Text("Last cooked \(lastCooked.formatted(.relative(presentation: .named)))")
                                .font(.quicksand(.caption))
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.quicksand(.caption))
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .background(Color(.systemGray6))
                .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var cookHistorySheet: some View {
        let history = cookViewModel?.history ?? []

        NavigationStack {
            List(history) { session in
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.quicksand(.title3))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(session.completedAt ?? session.startedAt, style: .date)
                            .font(.quicksand(.body))
                        Text(historyDuration(session))
                            .font(.quicksand(.caption))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(session.completedAt ?? session.startedAt, style: .relative)
                        .font(.quicksand(.caption))
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Cook History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { showCookHistorySheet = false }
                        .fontWeight(.semibold)
                }
            }
        }
        // Medium-detent sheets render the translucent glass material on iOS 26;
        // an explicit background keeps the list readable.
        .presentationBackground(Color(.systemGroupedBackground))
        .presentationDetents([.medium, .large])
    }

    private func historyDuration(_ session: CookSession) -> String {
        let minutes = Int(session.duration / 60)
        if minutes < 1 { return "Under a minute" }
        if minutes < 60 { return "\(minutes) min" }
        let hours = minutes / 60
        let remainder = minutes % 60
        return remainder == 0 ? "\(hours) hr" : "\(hours) hr \(remainder) min"
    }
    
    @ViewBuilder
    private var ingredientsSection: some View {
        let ingredients = viewModel.activeRecipeDetail?.ingredients ?? []
        
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Ingredients")
                    .font(.quicksand(.title2))
                    .fontWeight(.bold)
                Text("\(ingredients.count)")
                    .font(.quicksand(.caption))
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
                            .font(.quicksand(.title3))
                    }
                    .buttonStyle(.plain)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ingredient.name)
                            .strikethrough(checkedIngredients.contains(ingredient.id))
                            .foregroundStyle(checkedIngredients.contains(ingredient.id) ? .secondary : .primary)
                        if let qty = ingredient.quantity, !qty.isEmpty {
                            Text(qty)
                                .font(.quicksand(.caption))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            
            addToListButton
        }
    }
    
    @ViewBuilder
    private var addToListButton: some View {
        let checkedCount = checkedIngredients.count
        
        Button {
            showAddToListSheet = true
        } label: {
            Text(checkedCount > 0 ? "Add \(checkedCount) to List" : "Select ingredients to add")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(checkedCount > 0 ? Color.accentColor : Color(.systemGray4))
                .foregroundStyle(.white)
                .fontWeight(.semibold)
                .cornerRadius(12)
        }
        .disabled(checkedCount == 0)
        .padding(.top, 8)
    }
    
    @ViewBuilder
    private var stepsSection: some View {
        let steps = viewModel.activeRecipeDetail?.steps ?? []
        
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Steps")
                    .font(.quicksand(.title2))
                    .fontWeight(.bold)
                Text("\(steps.count)")
                    .font(.quicksand(.caption))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())
            }
            
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(.quicksand(.caption))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.accentColor)
                        .clipShape(Circle())
                    
                    Text(step.instruction)
                        .font(.quicksand(.body))
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
                            Text((targetCollection.emoji?.containsVisualEmoji == true ? targetCollection.emoji : nil) ?? "📁")
                                .font(.quicksand(.title2))
                            Text(targetCollection.name)
                                .font(.quicksand(.body))
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
    
    private var checkedIngredientsData: [(name: String, quantity: String?, amount: Double?, unit: String?)] {
        guard let ingredients = viewModel.activeRecipeDetail?.ingredients else { return [] }
        return ingredients
            .filter { checkedIngredients.contains($0.id) }
            .map { (name: $0.name, quantity: $0.quantity, amount: nil, unit: nil) }
    }
    
    private var allIngredientsData: [(name: String, quantity: String?, amount: Double?, unit: String?)] {
        guard let ingredients = viewModel.activeRecipeDetail?.ingredients else { return [] }
        return ingredients.map { (name: $0.name, quantity: $0.quantity, amount: nil, unit: nil) }
    }
    
    private func toggleIngredient(_ id: UUID) {
        if checkedIngredients.contains(id) {
            checkedIngredients.remove(id)
        } else {
            checkedIngredients.insert(id)
        }
    }
}

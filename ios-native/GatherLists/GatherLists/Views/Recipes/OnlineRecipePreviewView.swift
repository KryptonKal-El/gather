import SwiftUI

/// Shows full recipe details from online search with save and add-to-list actions.
struct OnlineRecipePreviewView: View {
    let recipe: SpoonacularSearchResult
    let userId: UUID
    let userEmail: String
    let collections: [RecipeCollection]
    let activeCollectionId: UUID?
    
    @State private var detail: SpoonacularRecipeDetail?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showAddToList = false
    @State private var showSaveSheet = false
    @State private var savedRecipeId: UUID?
    
    var body: some View {
        Group {
            if isLoading {
                loadingView
            } else if let error = error {
                errorView(message: error)
            } else if let detail = detail {
                recipeContent(detail: detail)
            } else {
                errorView(message: "Recipe details unavailable")
            }
        }
        .navigationTitle("Recipe")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadDetail()
        }
        .sheet(isPresented: $showAddToList) {
            if let detail = detail {
                AddToListSheet(
                    ingredients: detail.extendedIngredients.map { ($0.name, $0.original) },
                    userId: userId,
                    userEmail: userEmail
                ) {
                    showAddToList = false
                }
            }
        }
        .sheet(isPresented: $showSaveSheet) {
            if let detail = detail {
                SaveRecipeSheet(
                    recipeDetail: detail,
                    collections: collections,
                    activeCollectionId: activeCollectionId,
                    userId: userId,
                    onSaved: { recipeId in
                        savedRecipeId = recipeId
                        showSaveSheet = false
                    },
                    onDismiss: {
                        showSaveSheet = false
                    }
                )
            }
        }
    }
    
    @ViewBuilder
    private func recipeContent(detail: SpoonacularRecipeDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                heroImage(url: detail.image)
                
                VStack(alignment: .leading, spacing: 12) {
                    Text(detail.title)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    metaRow(readyInMinutes: detail.readyInMinutes, servings: detail.servings)
                    
                    if let url = URL(string: detail.sourceUrl) {
                        Link("View original recipe", destination: url)
                            .font(.subheadline)
                            .foregroundStyle(.blue)
                    }
                    
                    Divider()
                        .padding(.vertical, 8)
                    
                    ingredientsSection(ingredients: detail.extendedIngredients)
                    
                    Divider()
                        .padding(.vertical, 8)
                    
                    instructionsSection(instructions: detail.analyzedInstructions)
                    
                    actionButtons
                        .padding(.top, 16)
                }
                .padding(.horizontal)
            }
        }
    }
    
    @ViewBuilder
    private func heroImage(url: String) -> some View {
        AsyncImage(url: URL(string: url)) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            case .failure:
                Color(.systemGray5)
                    .overlay {
                        Image(systemName: "photo")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                    }
            case .empty:
                Color(.systemGray5)
                    .overlay { ProgressView() }
            @unknown default:
                Color(.systemGray5)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 250)
        .clipped()
        .clipShape(
            UnevenRoundedRectangle(
                bottomLeadingRadius: 16,
                bottomTrailingRadius: 16
            )
        )
    }
    
    @ViewBuilder
    private func metaRow(readyInMinutes: Int, servings: Int) -> some View {
        HStack(spacing: 16) {
            Label("\(readyInMinutes) min", systemImage: "clock")
            Label("\(servings) servings", systemImage: "person.2")
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    
    @ViewBuilder
    private func ingredientsSection(ingredients: [SpoonacularIngredient]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ingredients (\(ingredients.count))")
                .font(.headline)
            
            ForEach(Array(ingredients.enumerated()), id: \.offset) { _, ingredient in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 6))
                        .foregroundStyle(.secondary)
                        .padding(.top, 6)
                    Text(ingredient.original)
                        .font(.body)
                }
            }
        }
    }
    
    @ViewBuilder
    private func instructionsSection(instructions: [SpoonacularInstruction]) -> some View {
        let steps = instructions.first?.steps ?? []
        
        VStack(alignment: .leading, spacing: 12) {
            Text("Instructions (\(steps.count) steps)")
                .font(.headline)
            
            ForEach(steps, id: \.number) { step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(step.number)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(Color.blue)
                        .clipShape(Circle())
                    
                    Text(step.step)
                        .font(.body)
                }
            }
        }
    }
    
    @ViewBuilder
    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button {
                showSaveSheet = true
            } label: {
                HStack {
                    Image(systemName: "bookmark")
                    Text("Save as Recipe")
                }
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.blue)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            Button {
                showAddToList = true
            } label: {
                HStack {
                    Image(systemName: "cart.badge.plus")
                    Text("Add to List")
                }
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(.systemGray5))
                .foregroundStyle(.primary)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(.bottom, 24)
    }
    
    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Loading recipe...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    @ViewBuilder
    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(.orange)
            
            Text("Couldn't load recipe")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            Button {
                Task {
                    await loadDetail()
                }
            } label: {
                Label("Try Again", systemImage: "arrow.clockwise")
                    .fontWeight(.medium)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func loadDetail() async {
        isLoading = true
        error = nil
        
        let result = await RecipeSearchService.getRecipeDetail(id: recipe.id)
        
        isLoading = false
        
        if let result = result {
            detail = result
        } else {
            error = "Failed to load recipe details. Please try again."
        }
    }
}

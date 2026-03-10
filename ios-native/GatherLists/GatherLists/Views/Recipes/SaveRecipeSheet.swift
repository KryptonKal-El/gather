import SwiftUI

/// Sheet for picking a collection to save an online recipe into.
struct SaveRecipeSheet: View {
    let recipeDetail: SpoonacularRecipeDetail
    let collections: [RecipeCollection]
    let activeCollectionId: UUID?
    let userId: UUID
    var onSaved: (UUID) -> Void
    var onDismiss: () -> Void
    
    @State private var selectedCollectionId: UUID?
    @State private var isSaving = false
    @State private var error: String?
    @State private var successMessage: String?
    
    var body: some View {
        NavigationStack {
            Group {
                if let successMessage = successMessage {
                    successView(message: successMessage)
                } else if collections.isEmpty {
                    emptyView
                } else {
                    listContent
                }
            }
            .navigationTitle("Save Recipe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onDismiss()
                    }
                    .disabled(isSaving)
                }
            }
        }
        .onAppear {
            if selectedCollectionId == nil {
                selectedCollectionId = activeCollectionId ?? collections.first?.id
            }
        }
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
    }
    
    @ViewBuilder
    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No Collections")
                .font(.headline)
            Text("Create a collection first to save recipes.")
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
                    Text(recipeDetail.title)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                
                Section {
                    ForEach(collections) { collection in
                        Button {
                            selectedCollectionId = collection.id
                        } label: {
                            HStack {
                                Text(collection.emoji ?? "📁")
                                    .font(.title3)
                                Text(collection.name)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if selectedCollectionId == collection.id {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                        .fontWeight(.semibold)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text("Choose a collection:")
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
                    saveRecipe()
                } label: {
                    HStack {
                        if isSaving {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Save Recipe")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(selectedCollectionId != nil && !isSaving ? Color.blue : Color.gray.opacity(0.3))
                    .foregroundStyle(.white)
                    .cornerRadius(12)
                    .fontWeight(.semibold)
                }
                .disabled(selectedCollectionId == nil || isSaving)
            }
            .padding()
            .background(Color(.systemGroupedBackground))
        }
    }
    
    private func saveRecipe() {
        guard let collectionId = selectedCollectionId else { return }
        guard let selectedCollection = collections.first(where: { $0.id == collectionId }) else { return }
        
        isSaving = true
        error = nil
        
        Task {
            do {
                var descriptionParts: [String] = []
                descriptionParts.append("Ready in \(recipeDetail.readyInMinutes) minutes")
                descriptionParts.append("Serves \(recipeDetail.servings)")
                descriptionParts.append("Source: \(recipeDetail.sourceUrl)")
                let description = descriptionParts.joined(separator: " · ")
                
                let ingredients: [(name: String, quantity: String?)] = recipeDetail.extendedIngredients.map { ingredient in
                    (name: ingredient.name, quantity: ingredient.original)
                }
                
                let steps: [String] = recipeDetail.analyzedInstructions.first?.steps.map { $0.step } ?? []
                
                let recipe = try await RecipeService.createRecipe(
                    userId: userId,
                    name: recipeDetail.title,
                    description: description,
                    collectionId: collectionId,
                    ingredients: ingredients,
                    steps: steps,
                    imageUrl: recipeDetail.image
                )
                
                successMessage = "Saved to \(selectedCollection.name)"
                
                try? await Task.sleep(for: .seconds(1.5))
                onSaved(recipe.id)
            } catch {
                self.error = "Failed to save recipe: \(error.localizedDescription)"
                isSaving = false
            }
        }
    }
}

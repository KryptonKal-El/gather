import SwiftUI

/// A dual-mode sheet for creating or editing a recipe with name, description, ingredients, and steps.
struct RecipeFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let viewModel: RecipeViewModel
    let editRecipe: Recipe?
    let editIngredients: [RecipeIngredient]
    let editSteps: [RecipeStep]
    
    @State private var name: String
    @State private var descriptionText: String
    @State private var ingredients: [IngredientRow]
    @State private var steps: [StepRow]
    @State private var isSaving = false
    @State private var attemptedSave = false
    
    private var isEditMode: Bool { editRecipe != nil }
    
    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    private var validIngredients: [(name: String, quantity: String?)] {
        ingredients.compactMap { row in
            let trimmed = row.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            let qty = row.quantity.trimmingCharacters(in: .whitespacesAndNewlines)
            return (name: trimmed, quantity: qty.isEmpty ? nil : qty)
        }
    }
    
    private var validSteps: [String] {
        steps.compactMap { row in
            let trimmed = row.instruction.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
    }
    
    private var canSave: Bool {
        !trimmedName.isEmpty && !validIngredients.isEmpty && !isSaving
    }
    
    init(
        viewModel: RecipeViewModel,
        editRecipe: Recipe? = nil,
        editIngredients: [RecipeIngredient] = [],
        editSteps: [RecipeStep] = []
    ) {
        self.viewModel = viewModel
        self.editRecipe = editRecipe
        self.editIngredients = editIngredients
        self.editSteps = editSteps
        
        _name = State(initialValue: editRecipe?.name ?? "")
        _descriptionText = State(initialValue: editRecipe?.description ?? "")
        
        if !editIngredients.isEmpty {
            _ingredients = State(initialValue: editIngredients.map {
                IngredientRow(id: UUID(), name: $0.name, quantity: $0.quantity ?? "")
            })
        } else {
            _ingredients = State(initialValue: [IngredientRow(id: UUID(), name: "", quantity: "")])
        }
        
        if !editSteps.isEmpty {
            _steps = State(initialValue: editSteps.map {
                StepRow(id: UUID(), instruction: $0.instruction)
            })
        } else {
            _steps = State(initialValue: [StepRow(id: UUID(), instruction: "")])
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                recipeInfoSection
                ingredientsSection
                stepsSection
            }
            .navigationTitle(isEditMode ? "Edit Recipe" : "New Recipe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveRecipe()
                    }
                    .fontWeight(.semibold)
                    .disabled(!canSave)
                }
            }
            .overlay {
                if isSaving {
                    Color.black.opacity(0.2)
                        .ignoresSafeArea()
                        .overlay {
                            ProgressView()
                                .scaleEffect(1.2)
                        }
                }
            }
        }
        .interactiveDismissDisabled(isSaving)
    }
    
    // MARK: - Sections
    
    @ViewBuilder
    private var recipeInfoSection: some View {
        Section {
            TextField("Recipe name", text: $name)
                .textInputAutocapitalization(.sentences)
            
            if attemptedSave && trimmedName.isEmpty {
                Text("Name is required")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            
            TextField("Description (optional)", text: $descriptionText, axis: .vertical)
                .lineLimit(2...5)
        }
    }
    
    @ViewBuilder
    private var ingredientsSection: some View {
        Section {
            ForEach($ingredients) { $ingredient in
                HStack(spacing: 12) {
                    TextField("Ingredient name", text: $ingredient.name)
                        .textInputAutocapitalization(.sentences)
                    
                    TextField("e.g., 2 cups", text: $ingredient.quantity)
                        .frame(width: 100)
                        .foregroundStyle(.secondary)
                }
            }
            .onDelete(perform: deleteIngredient)
            .onMove(perform: moveIngredient)
            
            if attemptedSave && validIngredients.isEmpty {
                Text("At least one ingredient is required")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        } header: {
            HStack {
                Text("Ingredients")
                Spacer()
                Button {
                    ingredients.append(IngredientRow(id: UUID(), name: "", quantity: ""))
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(.blue)
                }
            }
        }
    }
    
    @ViewBuilder
    private var stepsSection: some View {
        Section {
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1).")
                        .foregroundStyle(.secondary)
                        .frame(width: 24, alignment: .leading)
                    
                    TextField("Instruction", text: $steps[index].instruction, axis: .vertical)
                        .textInputAutocapitalization(.sentences)
                        .lineLimit(1...5)
                }
            }
            .onDelete(perform: deleteStep)
            .onMove(perform: moveStep)
        } header: {
            HStack {
                Text("Steps")
                Spacer()
                Button {
                    steps.append(StepRow(id: UUID(), instruction: ""))
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(.blue)
                }
            }
        }
    }
    
    // MARK: - Actions
    
    private func deleteIngredient(at offsets: IndexSet) {
        ingredients.remove(atOffsets: offsets)
        if ingredients.isEmpty {
            ingredients.append(IngredientRow(id: UUID(), name: "", quantity: ""))
        }
    }
    
    private func moveIngredient(from source: IndexSet, to destination: Int) {
        ingredients.move(fromOffsets: source, toOffset: destination)
    }
    
    private func deleteStep(at offsets: IndexSet) {
        steps.remove(atOffsets: offsets)
        if steps.isEmpty {
            steps.append(StepRow(id: UUID(), instruction: ""))
        }
    }
    
    private func moveStep(from source: IndexSet, to destination: Int) {
        steps.move(fromOffsets: source, toOffset: destination)
    }
    
    private func saveRecipe() {
        attemptedSave = true
        guard canSave else { return }
        
        isSaving = true
        
        Task {
            if let recipe = editRecipe {
                let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
                await viewModel.updateRecipe(
                    id: recipe.id,
                    name: trimmedName,
                    description: desc.isEmpty ? nil : desc
                )
                await viewModel.updateIngredients(recipeId: recipe.id, ingredients: validIngredients)
                await viewModel.updateSteps(recipeId: recipe.id, steps: validSteps)
            } else {
                let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
                await viewModel.createRecipe(
                    name: trimmedName,
                    description: desc.isEmpty ? nil : desc,
                    ingredients: validIngredients,
                    steps: validSteps
                )
            }
            dismiss()
        }
    }
}

// MARK: - Helper Types

private struct IngredientRow: Identifiable {
    let id: UUID
    var name: String
    var quantity: String
}

private struct StepRow: Identifiable {
    let id: UUID
    var instruction: String
}

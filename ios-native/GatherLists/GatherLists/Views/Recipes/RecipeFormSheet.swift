import SwiftUI
import PhotosUI
import UIKit

/// A dual-mode sheet for creating or editing a recipe with name, description, ingredients, steps, and image.
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
    
    @State private var imageData: Data?
    @State private var imageUrlString: String = ""
    @State private var showingImageMenu = false
    @State private var showingCamera = false
    @State private var showingPhotoPicker = false
    @State private var showingUrlInput = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var imageSource: ImageSource = .none
    
    private enum ImageSource {
        case none, file, url
    }
    
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
        
        if let existingUrl = editRecipe?.imageUrl, !existingUrl.isEmpty {
            _imageUrlString = State(initialValue: existingUrl)
            _imageSource = State(initialValue: .url)
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                imageSection
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
        .confirmationDialog("Add Photo", isPresented: $showingImageMenu, titleVisibility: .visible) {
            Button("Take Photo") {
                showingCamera = true
            }
            Button("Choose from Library") {
                showingPhotoPicker = true
            }
            Button("Paste Image URL") {
                showingUrlInput = true
            }
            Button("Cancel", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $showingCamera) {
            CameraPicker { data in
                imageData = data
                imageSource = .file
                imageUrlString = ""
                showingUrlInput = false
            }
        }
        .photosPicker(isPresented: $showingPhotoPicker, selection: $selectedPhotoItem, matching: .images)
        .onChange(of: selectedPhotoItem) { _, newItem in
            guard let item = newItem else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    imageData = data
                    imageSource = .file
                    imageUrlString = ""
                    showingUrlInput = false
                }
                selectedPhotoItem = nil
            }
        }
    }
    
    // MARK: - Image Section
    
    @ViewBuilder
    private var imageSection: some View {
        Section {
            if imageSource == .file, let data = imageData, let uiImage = UIImage(data: data) {
                ZStack(alignment: .topTrailing) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(maxHeight: 200)
                        .clipped()
                        .cornerRadius(8)
                    
                    HStack(spacing: 8) {
                        Button {
                            showingImageMenu = true
                        } label: {
                            Label("Change", systemImage: "arrow.triangle.2.circlepath")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.ultraThinMaterial)
                                .cornerRadius(6)
                        }
                        Button {
                            removeImage()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title3)
                                .foregroundStyle(.white, .black.opacity(0.5))
                        }
                    }
                    .padding(8)
                }
            } else if imageSource == .url, !imageUrlString.isEmpty {
                ZStack(alignment: .topTrailing) {
                    AsyncImage(url: URL(string: imageUrlString)) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(maxHeight: 200)
                                .clipped()
                                .cornerRadius(8)
                        case .failure:
                            urlPlaceholder(error: true)
                        default:
                            ProgressView()
                                .frame(maxWidth: .infinity, minHeight: 120)
                        }
                    }
                    
                    HStack(spacing: 8) {
                        Button {
                            showingImageMenu = true
                        } label: {
                            Label("Change", systemImage: "arrow.triangle.2.circlepath")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.ultraThinMaterial)
                                .cornerRadius(6)
                        }
                        Button {
                            removeImage()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title3)
                                .foregroundStyle(.white, .black.opacity(0.5))
                        }
                    }
                    .padding(8)
                }
            } else {
                Button {
                    showingImageMenu = true
                } label: {
                    VStack(spacing: 8) {
                        Image(systemName: "camera")
                            .font(.title)
                            .foregroundStyle(.secondary)
                        Text("Add Photo")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 120)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6]))
                            .foregroundStyle(.secondary.opacity(0.5))
                    )
                }
                .buttonStyle(.plain)
            }
            
            if showingUrlInput {
                HStack {
                    TextField("Image URL", text: $imageUrlString)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    Button("Done") {
                        if !imageUrlString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            imageSource = .url
                            imageData = nil
                        }
                        showingUrlInput = false
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
    
    @ViewBuilder
    private func urlPlaceholder(error: Bool) -> some View {
        VStack(spacing: 8) {
            Image(systemName: error ? "exclamationmark.triangle" : "link")
                .font(.title)
                .foregroundStyle(.secondary)
            Text(error ? "Failed to load image" : "Loading...")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 120)
    }
    
    private func removeImage() {
        imageData = nil
        imageUrlString = ""
        imageSource = .none
        showingUrlInput = false
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
                
                await handleImageUpdate(recipeId: recipe.id, existingImageUrl: recipe.imageUrl)
            } else {
                let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
                await viewModel.createRecipe(
                    name: trimmedName,
                    description: desc.isEmpty ? nil : desc,
                    ingredients: validIngredients,
                    steps: validSteps
                )
                
                if let recipeId = viewModel.activeRecipeId {
                    await handleImageUpload(recipeId: recipeId)
                }
            }
            dismiss()
        }
    }
    
    private func handleImageUpload(recipeId: UUID) async {
        switch imageSource {
        case .file:
            guard let data = imageData else { return }
            let compressed = ImageCompressor.compress(imageData: data) ?? data
            do {
                let url = try await StorageService.uploadRecipeImage(
                    userId: viewModel.userId,
                    recipeId: recipeId,
                    imageData: compressed,
                    fileExtension: "jpeg"
                )
                try await RecipeService.updateRecipeImage(recipeId: recipeId, imageUrl: url)
            } catch {
                print("[RecipeFormSheet] Failed to upload image: \(error.localizedDescription)")
            }
        case .url:
            let trimmedUrl = imageUrlString.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedUrl.isEmpty else { return }
            do {
                try await RecipeService.updateRecipeImage(recipeId: recipeId, imageUrl: trimmedUrl)
            } catch {
                print("[RecipeFormSheet] Failed to set image URL: \(error.localizedDescription)")
            }
        case .none:
            break
        }
    }
    
    private func handleImageUpdate(recipeId: UUID, existingImageUrl: String?) async {
        let hadImage = existingImageUrl != nil && !(existingImageUrl?.isEmpty ?? true)
        
        switch imageSource {
        case .file:
            guard let data = imageData else { return }
            let compressed = ImageCompressor.compress(imageData: data) ?? data
            do {
                let url = try await StorageService.uploadRecipeImage(
                    userId: viewModel.userId,
                    recipeId: recipeId,
                    imageData: compressed,
                    fileExtension: "jpeg"
                )
                try await RecipeService.updateRecipeImage(recipeId: recipeId, imageUrl: url)
            } catch {
                print("[RecipeFormSheet] Failed to upload image: \(error.localizedDescription)")
            }
        case .url:
            let trimmedUrl = imageUrlString.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedUrl.isEmpty else { return }
            if trimmedUrl != existingImageUrl {
                do {
                    try await RecipeService.updateRecipeImage(recipeId: recipeId, imageUrl: trimmedUrl)
                } catch {
                    print("[RecipeFormSheet] Failed to set image URL: \(error.localizedDescription)")
                }
            }
        case .none:
            if hadImage {
                do {
                    try await RecipeService.removeRecipeImage(recipeId: recipeId)
                } catch {
                    print("[RecipeFormSheet] Failed to remove image: \(error.localizedDescription)")
                }
            }
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

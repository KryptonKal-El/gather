import SwiftUI
import PhotosUI
import UIKit
import UniformTypeIdentifiers

/// A dual-mode sheet for creating or editing a recipe with name, description, ingredients, steps, and image.
struct RecipeFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let viewModel: RecipeViewModel
    let editRecipe: Recipe?
    let editIngredients: [RecipeIngredient]
    let editSteps: [RecipeStep]
    let saveButtonTitle: String
    let onComplete: (() -> Void)?
    let showCollectionPicker: Bool

    @State private var name: String
    @State private var descriptionText: String
    @State private var ingredients: [IngredientRow]
    @State private var steps: [StepRow]
    @State private var selectedCollectionId: UUID?
    @State private var sourceName: String
    @State private var sourceURL: String
    @State private var prepTime: String
    @State private var cookTime: String
    @State private var servingsText: String
    @State private var isSaving = false
    @State private var attemptedSave = false

    @State private var imageData: Data?
    @State private var imageUrlString: String = ""
    @State private var showingImageMenu = false
    @State private var pendingImageAction: AddPhotoAction?
    @State private var showingCamera = false
    @State private var showingPhotoPicker = false
    @State private var showingUrlInput = false

    /// How the user chose to add a photo, from the Add Photo sheet.
    private enum AddPhotoAction { case camera, library, paste, pasteURL }
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

    private func nilIfBlank(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private var servingsValue: Int? {
        Int(servingsText.trimmingCharacters(in: .whitespacesAndNewlines))
    }
    
    init(
        viewModel: RecipeViewModel,
        editRecipe: Recipe? = nil,
        editIngredients: [RecipeIngredient] = [],
        editSteps: [RecipeStep] = [],
        prefillName: String = "",
        prefillIngredients: [(name: String, quantity: String)] = [],
        prefillSteps: [String] = [],
        prefillImageUrl: String = "",
        prefillSourceName: String = "",
        prefillSourceUrl: String = "",
        prefillPrepTime: String = "",
        prefillCookTime: String = "",
        prefillServings: Int? = nil,
        saveButtonTitle: String = "Save",
        onComplete: (() -> Void)? = nil,
        showCollectionPicker: Bool = false
    ) {
        self.viewModel = viewModel
        self.editRecipe = editRecipe
        self.editIngredients = editIngredients
        self.editSteps = editSteps
        self.saveButtonTitle = saveButtonTitle
        self.onComplete = onComplete
        self.showCollectionPicker = showCollectionPicker

        _name = State(initialValue: editRecipe?.name ?? prefillName)
        _descriptionText = State(initialValue: editRecipe?.description ?? "")
        _selectedCollectionId = State(initialValue: editRecipe?.collectionId ?? viewModel.activeCollectionId ?? viewModel.collections.first?.id)
        _sourceName = State(initialValue: editRecipe?.sourceName ?? prefillSourceName)
        _sourceURL = State(initialValue: editRecipe?.sourceUrl ?? prefillSourceUrl)
        _prepTime = State(initialValue: editRecipe?.prepTime ?? prefillPrepTime)
        _cookTime = State(initialValue: editRecipe?.cookTime ?? prefillCookTime)
        let initialServings = editRecipe?.servings ?? prefillServings
        _servingsText = State(initialValue: initialServings.map(String.init) ?? "")

        if !editIngredients.isEmpty {
            _ingredients = State(initialValue: editIngredients.map {
                IngredientRow(id: UUID(), name: $0.name, quantity: $0.quantity ?? "")
            })
        } else if !prefillIngredients.isEmpty {
            _ingredients = State(initialValue: prefillIngredients.map {
                IngredientRow(id: UUID(), name: $0.name, quantity: $0.quantity)
            })
        } else {
            _ingredients = State(initialValue: [IngredientRow(id: UUID(), name: "", quantity: "")])
        }

        if !editSteps.isEmpty {
            _steps = State(initialValue: editSteps.map {
                StepRow(id: UUID(), instruction: $0.instruction)
            })
        } else if !prefillSteps.isEmpty {
            _steps = State(initialValue: prefillSteps.map {
                StepRow(id: UUID(), instruction: $0)
            })
        } else {
            _steps = State(initialValue: [StepRow(id: UUID(), instruction: "")])
        }

        if let existingUrl = editRecipe?.imageUrl, !existingUrl.isEmpty {
            _imageUrlString = State(initialValue: existingUrl)
            _imageSource = State(initialValue: .url)
        } else if !prefillImageUrl.isEmpty {
            _imageUrlString = State(initialValue: prefillImageUrl)
            _imageSource = State(initialValue: .url)
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                imageSection
                recipeInfoSection
                detailsSection
                tagsSection
                collectionSection
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
                    Button(saveButtonTitle) {
                        saveRecipe()
                    }
                    .fontWeight(.semibold)
                    .disabled(!canSave)
                }
            }
            .overlay {
                if isSaving {
                    ZStack {
                        Color.black.opacity(0.35).ignoresSafeArea()
                        VStack(spacing: 14) {
                            ProgressView()
                                .controlSize(.large)
                                .tint(.white)
                            Text(saveButtonTitle == "Import" ? "Importing…" : "Saving…")
                                .font(.quicksand(.subheadline, weight: .medium))
                                .foregroundStyle(.white)
                        }
                        .padding(28)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
                    }
                    .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: isSaving)
        }
        .interactiveDismissDisabled(isSaving)
        // Custom sheet (not a confirmationDialog): a UIKit action sheet takes its
        // tint from the window — the app-wide brand green — which made the option
        // text low-contrast. This renders the options in the primary label color.
        .sheet(isPresented: $showingImageMenu, onDismiss: runPendingImageAction) {
            addPhotoSheet
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
                                .font(.quicksand(.caption))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.ultraThinMaterial)
                                .cornerRadius(6)
                        }
                        Button {
                            removeImage()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.quicksand(.title3))
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
                                .font(.quicksand(.caption))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.ultraThinMaterial)
                                .cornerRadius(6)
                        }
                        Button {
                            removeImage()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.quicksand(.title3))
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
                            .font(.quicksand(.title))
                            .foregroundStyle(.secondary)
                        Text("Add Photo")
                            .font(.quicksand(.subheadline))
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
                .font(.quicksand(.title))
                .foregroundStyle(.secondary)
            Text(error ? "Failed to load image" : "Loading...")
                .font(.quicksand(.caption))
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

    // MARK: - Add Photo chooser

    @ViewBuilder
    private var addPhotoSheet: some View {
        let rows = clipboardHasImage ? 4 : 3
        VStack(spacing: 0) {
            Text("Add Photo")
                .font(.quicksand(.headline))
                .foregroundStyle(.primary)
                .padding(.top, 20)
                .padding(.bottom, 8)

            photoRow(icon: "camera", title: "Take Photo") { selectImageAction(.camera) }
            photoDivider
            photoRow(icon: "photo.on.rectangle", title: "Choose from Library") { selectImageAction(.library) }
            if clipboardHasImage {
                photoDivider
                photoRow(icon: "doc.on.clipboard", title: "Paste Image") { selectImageAction(.paste) }
            }
            photoDivider
            photoRow(icon: "link", title: "Paste Image URL") { selectImageAction(.pasteURL) }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .presentationDetents([.height(CGFloat(rows) * 60 + 92)])
        .presentationDragIndicator(.visible)
    }

    private var photoDivider: some View {
        Divider().padding(.leading, 60)
    }

    private func photoRow(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.quicksand(.title3))
                    .foregroundStyle(Color.brandGreen)
                    .frame(width: 28)
                Text(title)
                    .font(.quicksand(.body, weight: .medium))
                    .foregroundStyle(.primary)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Records the choice and closes the sheet; the action runs from the sheet's
    /// onDismiss so the camera / photo picker presents cleanly after it closes.
    private func selectImageAction(_ action: AddPhotoAction) {
        pendingImageAction = action
        showingImageMenu = false
    }

    private func runPendingImageAction() {
        guard let action = pendingImageAction else { return }
        pendingImageAction = nil
        switch action {
        case .camera: showingCamera = true
        case .library: showingPhotoPicker = true
        case .paste: pasteImageFromClipboard()
        case .pasteURL: showingUrlInput = true
        }
    }

    /// Whether the clipboard holds an image. `UIPasteboard.hasImages` misses
    /// formats absent from its fixed type list (e.g. WebP), so also check for
    /// any pasteboard type that conforms to `public.image`.
    private var clipboardHasImage: Bool {
        let pasteboard = UIPasteboard.general
        if pasteboard.hasImages { return true }
        return pasteboard.types.contains { UTType($0)?.conforms(to: .image) == true }
    }

    /// Uses the most recent image on the clipboard as the recipe photo.
    private func pasteImageFromClipboard() {
        guard let image = clipboardImage(),
              let data = image.jpegData(compressionQuality: 0.9) else { return }
        imageData = data
        imageSource = .file
        imageUrlString = ""
        showingUrlInput = false
    }

    /// Reads an image from the clipboard, falling back to decoding raw data for
    /// formats `UIPasteboard.image` doesn't recognize (e.g. WebP). `UIImage(data:)`
    /// decodes WebP via ImageIO on modern iOS.
    private func clipboardImage() -> UIImage? {
        let pasteboard = UIPasteboard.general
        if let image = pasteboard.image { return image }
        for type in pasteboard.types where UTType(type)?.conforms(to: .image) == true {
            if let data = pasteboard.data(forPasteboardType: type), let image = UIImage(data: data) {
                return image
            }
        }
        return nil
    }

    // MARK: - Sections
    
    @ViewBuilder
    private var recipeInfoSection: some View {
        Section {
            TextField("Recipe name", text: $name)
                .textInputAutocapitalization(.sentences)
            
            if attemptedSave && trimmedName.isEmpty {
                Text("Name is required")
                    .font(.quicksand(.caption))
                    .foregroundStyle(.red)
            }
            
            TextField("Description (optional)", text: $descriptionText, axis: .vertical)
                .lineLimit(2...5)
        }
    }
    
    @ViewBuilder
    private var detailsSection: some View {
        Section("Details") {
            LabeledContent("Source") {
                TextField("e.g. NYT Cooking", text: $sourceName)
                    .multilineTextAlignment(.trailing)
            }
            LabeledContent("Link") {
                TextField("https://…", text: $sourceURL)
                    .multilineTextAlignment(.trailing)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
            }
            LabeledContent("Prep time") {
                TextField("15 min", text: $prepTime)
                    .multilineTextAlignment(.trailing)
            }
            LabeledContent("Cook time") {
                TextField("30 min", text: $cookTime)
                    .multilineTextAlignment(.trailing)
            }
            LabeledContent("Servings") {
                TextField("4", text: $servingsText)
                    .multilineTextAlignment(.trailing)
                    .keyboardType(.numberPad)
            }
        }
    }

    /// The meal-plan tags (course, meal types, protein, cuisine, effort),
    /// reusing the same editor as the recipe page. Edit mode only: new recipes
    /// have no id to attach attributes to yet (they're auto-tagged after save).
    @ViewBuilder
    private var tagsSection: some View {
        if let recipe = editRecipe {
            Section {
                RecipeAttributesSection(
                    recipe: recipe,
                    canEdit: viewModel.canEditRecipe(recipe),
                    userId: viewModel.userId
                )
            }
        }
    }

    /// The collection picker is shown for new recipes (to choose where they go)
    /// and in edit mode (to move the recipe between collections).
    private var collectionPickerVisible: Bool {
        (showCollectionPicker || isEditMode) && !viewModel.allCollections.isEmpty
    }

    @ViewBuilder
    private var collectionSection: some View {
        if collectionPickerVisible {
            Section("Collection") {
                Picker("Collection", selection: $selectedCollectionId) {
                    ForEach(viewModel.allCollections) { collection in
                        Text((collection.emoji?.containsVisualEmoji == true ? "\(collection.emoji ?? "") " : "") + collection.name)
                            .tag(Optional(collection.id))
                    }
                }
                .labelsHidden()
            }
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
                    .font(.quicksand(.caption))
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
                    description: desc.isEmpty ? nil : desc,
                    sourceName: nilIfBlank(sourceName),
                    sourceUrl: nilIfBlank(sourceURL),
                    prepTime: nilIfBlank(prepTime),
                    cookTime: nilIfBlank(cookTime),
                    servings: servingsValue
                )
                await viewModel.updateIngredients(recipeId: recipe.id, ingredients: validIngredients)
                await viewModel.updateSteps(recipeId: recipe.id, steps: validSteps)

                if let newCollectionId = selectedCollectionId, newCollectionId != recipe.collectionId {
                    await viewModel.moveRecipe(recipeId: recipe.id, toCollectionId: newCollectionId)
                }

                await handleImageUpdate(recipeId: recipe.id, existingImageUrl: recipe.imageUrl)
            } else {
                let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
                await viewModel.createRecipe(
                    name: trimmedName,
                    description: desc.isEmpty ? nil : desc,
                    ingredients: validIngredients,
                    steps: validSteps,
                    collectionId: showCollectionPicker ? selectedCollectionId : nil,
                    sourceName: nilIfBlank(sourceName),
                    sourceUrl: nilIfBlank(sourceURL),
                    prepTime: nilIfBlank(prepTime),
                    cookTime: nilIfBlank(cookTime),
                    servings: servingsValue
                )
                
                if let recipeId = viewModel.activeRecipeId {
                    await handleImageUpload(recipeId: recipeId)
                }
            }
            dismiss()
            onComplete?()
        }
    }
    
    private func handleImageUpload(recipeId: UUID) async {
        // Routed through the view model so its in-memory recipe list gets the new
        // image URL and the recipes grid reflects it without a manual refresh.
        switch imageSource {
        case .file:
            guard let data = imageData else { return }
            let compressed = ImageCompressor.compress(imageData: data) ?? data
            do {
                try await viewModel.uploadRecipeImage(recipeId: recipeId, imageData: compressed, fileExtension: "jpeg")
            } catch {
                print("[RecipeFormSheet] Failed to upload image: \(error.localizedDescription)")
            }
        case .url:
            let trimmedUrl = imageUrlString.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedUrl.isEmpty else { return }
            do {
                try await viewModel.updateRecipeImageUrl(recipeId: recipeId, imageUrl: trimmedUrl)
            } catch {
                print("[RecipeFormSheet] Failed to set image URL: \(error.localizedDescription)")
            }
        case .none:
            break
        }
    }
    
    private func handleImageUpdate(recipeId: UUID, existingImageUrl: String?) async {
        let hadImage = existingImageUrl != nil && !(existingImageUrl?.isEmpty ?? true)
        
        // Routed through the view model so the recipes grid updates in memory.
        switch imageSource {
        case .file:
            guard let data = imageData else { return }
            let compressed = ImageCompressor.compress(imageData: data) ?? data
            do {
                try await viewModel.uploadRecipeImage(recipeId: recipeId, imageData: compressed, fileExtension: "jpeg")
            } catch {
                print("[RecipeFormSheet] Failed to upload image: \(error.localizedDescription)")
            }
        case .url:
            let trimmedUrl = imageUrlString.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedUrl.isEmpty else { return }
            if trimmedUrl != existingImageUrl {
                do {
                    try await viewModel.updateRecipeImageUrl(recipeId: recipeId, imageUrl: trimmedUrl)
                } catch {
                    print("[RecipeFormSheet] Failed to set image URL: \(error.localizedDescription)")
                }
            }
        case .none:
            if hadImage {
                do {
                    try await viewModel.removeRecipeImage(recipeId: recipeId)
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

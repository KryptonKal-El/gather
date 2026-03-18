import SwiftUI

struct CategoryEditorSheet: View {
    let listId: UUID
    let listType: String
    let initialCategories: [CategoryDef]
    let onSave: ([CategoryDef]) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var categories: [CategoryDef]
    @State private var showDeleteConfirm = false
    @State private var categoryToDelete: CategoryDef?
    @State private var selectedCategory: CategoryDef?
    @State private var showSaveDefaultConfirm = false
    @State private var showSaveDefaultSuccess = false
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    private let presetColors = [
        "#B5E8C8", "#A8D8EA", "#85BFA8", "#FFD6A5", "#FDCFE8", "#B4C7E7", "#D4E09B",
        "#F9A8C9", "#C5B3E6", "#F4C89E", "#A5D6D0", "#C1D5A4", "#F2B5B5", "#D0C4DF"
    ]
    
    init(listId: UUID, listType: String, initialCategories: [CategoryDef], onSave: @escaping ([CategoryDef]) -> Void) {
        self.listId = listId
        self.listType = listType
        self.initialCategories = initialCategories
        self.onSave = onSave
        _categories = State(initialValue: initialCategories)
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if categories.isEmpty {
                        Text("No categories defined")
                            .foregroundStyle(.secondary)
                            .italic()
                    } else {
                        ForEach(categories, id: \.key) { category in
                            categoryRow(category)
                        }
                        .onMove(perform: moveCategory)
                        .onDelete(perform: deleteCategories)
                    }
                } header: {
                    Text("Categories")
                } footer: {
                    Text("Drag to reorder. Swipe to delete.")
                }
                
                Section {
                    Button {
                        addNewCategory()
                    } label: {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                                .foregroundStyle(.green)
                            Text("Add Category")
                        }
                    }
                    .buttonStyle(.plain)
                }
                
                Section {
                    Button {
                        showSaveDefaultConfirm = true
                    } label: {
                        Label("Save as Default for \(listType.capitalized)", systemImage: "square.and.arrow.down")
                    }
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Edit Categories")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(categories)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(brandGreen)
                }
            }
            .sheet(item: $selectedCategory) { category in
                CategoryDetailEditor(
                    category: category,
                    presetColors: presetColors,
                    existingKeys: Set(categories.map(\.key)),
                    onSave: { updated in
                        if let index = categories.firstIndex(where: { $0.key == category.key }) {
                            categories[index] = updated
                        }
                    }
                )
            }
            .alert("Delete Category?", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) {
                    categoryToDelete = nil
                }
                Button("Delete", role: .destructive) {
                    if let cat = categoryToDelete {
                        categories.removeAll { $0.key == cat.key }
                    }
                    categoryToDelete = nil
                }
            } message: {
                if let cat = categoryToDelete {
                    Text("Delete \"\(cat.name)\"? Items in this category will become uncategorized.")
                }
            }
            .alert("Save as Default", isPresented: $showSaveDefaultConfirm) {
                Button("Cancel", role: .cancel) { }
                Button("Save") {
                    saveAsDefault()
                }
            } message: {
                Text("This will replace your default \(listType.capitalized) categories with this list's categories. Continue?")
            }
            .alert("Saved", isPresented: $showSaveDefaultSuccess) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("Default \(listType.capitalized) categories updated.")
            }
        }
    }
    
    private func categoryRow(_ category: CategoryDef) -> some View {
        Button {
            selectedCategory = category
        } label: {
            HStack(spacing: 12) {
                Circle()
                    .fill(Color(hex: category.color))
                    .frame(width: 24, height: 24)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(category.name)
                        .foregroundStyle(.primary)
                    
                    if !category.keywords.isEmpty {
                        Text("\(category.keywords.count) keyword\(category.keywords.count == 1 ? "" : "s")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .buttonStyle(.plain)
    }
    
    private func moveCategory(from source: IndexSet, to destination: Int) {
        categories.move(fromOffsets: source, toOffset: destination)
    }
    
    private func deleteCategories(at offsets: IndexSet) {
        if let first = offsets.first {
            categoryToDelete = categories[first]
            showDeleteConfirm = true
        }
    }
    
    private func addNewCategory() {
        let usedColors = Set(categories.map(\.color))
        let nextColor = presetColors.first { !usedColors.contains($0) } ?? presetColors[categories.count % presetColors.count]
        
        let baseKey = "new_category"
        let newKey = generateUniqueKey(baseKey)
        
        let newCategory = CategoryDef(
            key: newKey,
            name: "New Category",
            color: nextColor,
            keywords: []
        )
        categories.append(newCategory)
        selectedCategory = newCategory
    }
    
    private func generateUniqueKey(_ baseName: String) -> String {
        let baseKey = baseName.lowercased()
            .replacingOccurrences(of: " ", with: "_")
            .filter { $0.isLetter || $0.isNumber || $0 == "_" }
        
        let existingKeys = Set(categories.map(\.key))
        
        if !existingKeys.contains(baseKey) {
            return baseKey
        }
        
        var suffix = 2
        while existingKeys.contains("\(baseKey)_\(suffix)") {
            suffix += 1
        }
        return "\(baseKey)_\(suffix)"
    }
    
    private func saveAsDefault() {
        Task {
            guard let userId = authViewModel.currentUser?.id else { return }
            do {
                try await UserCategoryDefaultService.upsertDefault(
                    userId: userId,
                    listType: listType,
                    categories: categories
                )
                showSaveDefaultSuccess = true
            } catch {
                print("Failed to save default categories: \(error)")
            }
        }
    }
}

extension CategoryDef: Identifiable {
    var id: String { key }
}

struct CategoryDetailEditor: View {
    let category: CategoryDef
    let presetColors: [String]
    let existingKeys: Set<String>
    let onSave: (CategoryDef) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var selectedColor: String
    @State private var keywordsText: String
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    init(category: CategoryDef, presetColors: [String], existingKeys: Set<String>, onSave: @escaping (CategoryDef) -> Void) {
        self.category = category
        self.presetColors = presetColors
        self.existingKeys = existingKeys
        self.onSave = onSave
        _name = State(initialValue: category.name)
        _selectedColor = State(initialValue: category.color)
        _keywordsText = State(initialValue: category.keywords.joined(separator: ", "))
    }
    
    private var parsedKeywords: [String] {
        keywordsText
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
    
    private var generatedKey: String {
        let baseKey = name.lowercased()
            .replacingOccurrences(of: " ", with: "_")
            .filter { $0.isLetter || $0.isNumber || $0 == "_" }
        
        if baseKey.isEmpty { return category.key }
        if baseKey == category.key { return baseKey }
        
        let otherKeys = existingKeys.subtracting([category.key])
        if !otherKeys.contains(baseKey) {
            return baseKey
        }
        
        var suffix = 2
        while otherKeys.contains("\(baseKey)_\(suffix)") {
            suffix += 1
        }
        return "\(baseKey)_\(suffix)"
    }
    
    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("Category name", text: $name)
                        .textInputAutocapitalization(.words)
                }
                
                Section("Color") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 7), spacing: 12) {
                        ForEach(presetColors, id: \.self) { colorHex in
                            Button {
                                selectedColor = colorHex
                            } label: {
                                Circle()
                                    .fill(Color(hex: colorHex))
                                    .frame(width: 36, height: 36)
                                    .overlay {
                                        if selectedColor == colorHex {
                                            Image(systemName: "checkmark")
                                                .font(.subheadline.bold())
                                                .foregroundStyle(.white)
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 8)
                }
                
                Section {
                    TextField("milk, bread, eggs, ...", text: $keywordsText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Keywords")
                } footer: {
                    Text("Comma-separated. Items matching keywords will auto-assign to this category.")
                }
            }
            .navigationTitle("Edit Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        let updated = CategoryDef(
                            key: generatedKey,
                            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                            color: selectedColor,
                            keywords: parsedKeywords
                        )
                        onSave(updated)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(brandGreen)
                    .disabled(!canSave)
                }
            }
        }
    }
}

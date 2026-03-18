import SwiftUI

struct DefaultCategoryEditorView: View {
    let listType: String
    
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var categories: [CategoryDef] = []
    @State private var isLoading = true
    @State private var editingCategory: CategoryDef?
    @State private var showResetConfirm = false
    @State private var showDeleteConfirm = false
    @State private var categoryToDelete: CategoryDef?
    
    private let presetColors = [
        "#B5E8C8", "#A8D8EA", "#85BFA8", "#FFD6A5", "#FDCFE8", "#B4C7E7", "#D4E09B",
        "#F9A8C9", "#C5B3E6", "#F4C89E", "#A5D6D0", "#C1D5A4", "#F2B5B5", "#D0C4DF"
    ]
    
    private var displayTitle: String {
        switch listType {
        case "grocery": return "Grocery Defaults"
        case "packing": return "Packing Defaults"
        case "todo": return "To-Do Defaults"
        default: return "\(listType.capitalized) Defaults"
        }
    }
    
    var body: some View {
        List {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
            } else {
                Section {
                    ForEach(categories, id: \.key) { category in
                        categoryRow(category)
                    }
                    .onMove(perform: moveCategory)
                    .onDelete(perform: confirmDelete)
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
                    Button(role: .destructive) {
                        showResetConfirm = true
                    } label: {
                        Label("Reset to System Defaults", systemImage: "arrow.counterclockwise")
                    }
                }
            }
        }
        .environment(\.editMode, .constant(.active))
        .navigationTitle(displayTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadCategories() }
        .sheet(item: $editingCategory) { category in
            CategoryDetailEditor(
                category: category,
                presetColors: presetColors,
                existingKeys: Set(categories.map(\.key)),
                onSave: { updated in updateCategory(original: category, updated: updated) }
            )
        }
        .alert("Delete Category?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {
                categoryToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let cat = categoryToDelete {
                    categories.removeAll { $0.key == cat.key }
                    saveCategories()
                }
                categoryToDelete = nil
            }
        } message: {
            if let cat = categoryToDelete {
                Text("Delete \"\(cat.name)\"? Items using this category will become uncategorized.")
            }
        }
        .alert("Reset to System Defaults?", isPresented: $showResetConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) {
                resetToSystemDefaults()
            }
        } message: {
            Text("This will replace your custom \(listType.capitalized) categories with the original defaults.")
        }
    }
    
    private func categoryRow(_ category: CategoryDef) -> some View {
        Button {
            editingCategory = category
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
    
    private func loadCategories() async {
        guard let userId = authViewModel.currentUser?.id else {
            categories = CategoryService.getSystemDefaults(for: listType) ?? []
            isLoading = false
            return
        }
        do {
            let defaults = try await UserCategoryDefaultService.fetchDefaults(userId: userId)
            if let match = defaults.first(where: { $0.listType == listType }) {
                categories = match.categories
            } else {
                categories = CategoryService.getSystemDefaults(for: listType) ?? []
            }
        } catch {
            categories = CategoryService.getSystemDefaults(for: listType) ?? []
        }
        isLoading = false
    }
    
    private func saveCategories() {
        guard let userId = authViewModel.currentUser?.id else { return }
        Task {
            try? await UserCategoryDefaultService.upsertDefault(userId: userId, listType: listType, categories: categories)
        }
    }
    
    private func moveCategory(from source: IndexSet, to destination: Int) {
        categories.move(fromOffsets: source, toOffset: destination)
        saveCategories()
    }
    
    private func confirmDelete(at offsets: IndexSet) {
        if let first = offsets.first {
            categoryToDelete = categories[first]
            showDeleteConfirm = true
        }
    }
    
    private func addNewCategory() {
        let usedColors = Set(categories.map(\.color))
        let nextColor = presetColors.first { !usedColors.contains($0) } ?? presetColors[categories.count % presetColors.count]
        
        let newKey = generateUniqueKey("new_category")
        let newCategory = CategoryDef(
            key: newKey,
            name: "New Category",
            color: nextColor,
            keywords: []
        )
        categories.append(newCategory)
        saveCategories()
        editingCategory = newCategory
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
    
    private func updateCategory(original: CategoryDef, updated: CategoryDef) {
        if let index = categories.firstIndex(where: { $0.key == original.key }) {
            categories[index] = updated
            saveCategories()
        }
    }
    
    private func resetToSystemDefaults() {
        categories = CategoryService.getSystemDefaults(for: listType) ?? []
        saveCategories()
    }
}

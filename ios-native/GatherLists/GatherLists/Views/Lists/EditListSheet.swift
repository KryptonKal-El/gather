import SwiftUI
import UIKit

/// Bottom sheet for editing an existing list's name, emoji, and color.
struct EditListSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var authViewModel
    
    let list: GatherList
    let viewModel: ListViewModel
    
    @State private var name: String
    @State private var selectedEmoji: String?
    @State private var selectedPresetColor: String?
    @State private var customColor: Color
    @State private var showEmojiPicker = false
    @State private var isSaving = false
    @State private var showCategoryPreview = false
    @State private var categories: [CategoryDef] = []
    @State private var selectedCategoryForEdit: CategoryDef?
    @State private var pendingNewCategory: CategoryDef?
    @State private var showDeleteConfirm = false
    @State private var categoryToDelete: CategoryDef?
    @State private var showSaveDefaultConfirm = false
    @State private var showSaveDefaultSuccess = false
    
    private let presetColors = [
        "#B5E8C8", "#A8D8EA", "#85BFA8", "#FFD6A5", "#FDCFE8", "#B4C7E7", "#D4E09B",
        "#F9A8C9", "#C5B3E6", "#F4C89E", "#A5D6D0", "#C1D5A4", "#F2B5B5", "#D0C4DF"
    ]
    
    private let categoryTypes = ["grocery", "todo", "packing", "project"]
    
    init(list: GatherList, viewModel: ListViewModel) {
        self.list = list
        self.viewModel = viewModel
        _name = State(initialValue: list.name)
        _selectedEmoji = State(initialValue: list.emoji)
        
        let listColor = list.color
        if presetColors.contains(listColor) {
            _selectedPresetColor = State(initialValue: listColor)
            _customColor = State(initialValue: Color(hex: listColor))
        } else {
            _selectedPresetColor = State(initialValue: nil)
            _customColor = State(initialValue: Color(hex: listColor))
        }
        
        _categories = State(initialValue: list.categories ?? CategoryService.getSystemDefaults(for: list.type) ?? [])
    }
    
    private var effectiveColor: String {
        if let preset = selectedPresetColor {
            return preset
        }
        return colorToHex(customColor)
    }
    
    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("List name", text: $name)
                        .textInputAutocapitalization(.words)
                }
                
                Section("Emoji") {
                    Button {
                        showEmojiPicker = true
                    } label: {
                        HStack {
                            if let emoji = selectedEmoji, !emoji.isEmpty {
                                Text(emoji)
                                    .font(.system(size: 32))
                            } else {
                                Image(systemName: "face.smiling")
                                    .font(.title2)
                                    .foregroundStyle(.secondary)
                            }
                            
                            Spacer()
                            
                            Text(selectedEmoji == nil || selectedEmoji?.isEmpty == true ? "Choose emoji" : "Change")
                                .foregroundStyle(.secondary)
                            
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    
                    if selectedEmoji != nil && selectedEmoji?.isEmpty == false {
                        Button("Remove Emoji", role: .destructive) {
                            selectedEmoji = nil
                        }
                    }
                }
                
                Section("Color") {
                    colorPickerRow
                }
                
                if categoryTypes.contains(list.type) {
                    Section {
                        DisclosureGroup(isExpanded: $showCategoryPreview) {
                            ForEach(categories, id: \.key) { category in
                                Button {
                                    selectedCategoryForEdit = category
                                } label: {
                                    HStack {
                                        Circle()
                                            .fill(Color(hex: category.color))
                                            .frame(width: 12, height: 12)
                                        Text(category.name)
                                            .foregroundStyle(.primary)
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption)
                                            .foregroundStyle(.tertiary)
                                    }
                                }
                            }
                            .onMove { from, to in
                                categories.move(fromOffsets: from, toOffset: to)
                            }
                            .onDelete { offsets in
                                if let index = offsets.first {
                                    categoryToDelete = categories[index]
                                    showDeleteConfirm = true
                                }
                            }
                            
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
                            
                            Button {
                                showSaveDefaultConfirm = true
                            } label: {
                                Label("Set as Default for \(list.type.capitalized)", systemImage: "square.and.arrow.down")
                            }
                        } label: {
                            HStack {
                                Text("Customize Categories")
                                Spacer()
                                if !showCategoryPreview {
                                    Text("\(categories.count) \(categories.count == 1 ? "category" : "categories")")
                                        .foregroundStyle(.secondary)
                                        .font(.subheadline)
                                }
                            }
                        }
                        .environment(\.editMode, showCategoryPreview ? .constant(.active) : .constant(.inactive))
                    } footer: {
                        Text("Edit categories for this list.")
                    }
                }
            }
            .navigationTitle("Edit List")
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
                        saveChanges()
                    }
                    .fontWeight(.semibold)
                    .disabled(!canSave)
                }
            }
            .sheet(isPresented: $showEmojiPicker) {
                EmojiPickerView(selectedEmoji: $selectedEmoji)
            }
            .sheet(item: $selectedCategoryForEdit) { category in
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
            .sheet(item: $pendingNewCategory) { category in
                CategoryDetailEditor(
                    category: category,
                    presetColors: presetColors,
                    existingKeys: Set(categories.map(\.key)),
                    onSave: { updated in
                        categories.append(updated)
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
                    Text("Delete \"\(cat.name)\"?")
                }
            }
            .alert("Set as Default", isPresented: $showSaveDefaultConfirm) {
                Button("Cancel", role: .cancel) { }
                Button("Save") {
                    saveAsDefault()
                }
            } message: {
                Text("This will replace your default \(list.type.capitalized) categories with this list's categories. Continue?")
            }
            .alert("Saved", isPresented: $showSaveDefaultSuccess) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("Default \(list.type.capitalized) categories updated.")
            }
        }
        .interactiveDismissDisabled(isSaving)
    }
    
    private var colorPickerRow: some View {
        VStack(spacing: 12) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 7), spacing: 12) {
                ForEach(presetColors, id: \.self) { colorHex in
                    Button {
                        selectedPresetColor = colorHex
                    } label: {
                        Circle()
                            .fill(Color(hex: colorHex))
                            .frame(width: 36, height: 36)
                            .overlay {
                                if selectedPresetColor == colorHex {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundStyle(Color(hex: "#2C3E35"))
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
            
            Divider()
            
            ColorPicker("Custom Color", selection: $customColor)
                .onChange(of: customColor) {
                    selectedPresetColor = nil
                }
        }
    }
    
    private func saveChanges() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isSaving = true
        Task {
            let emojiValue = selectedEmoji?.isEmpty == false ? selectedEmoji : ""
            let categoriesToSave = categoryTypes.contains(list.type) ? categories : nil
            await viewModel.updateList(id: list.id, name: trimmedName, emoji: emojiValue, color: effectiveColor, categories: categoriesToSave)
            dismiss()
        }
    }
    
    private func addNewCategory() {
        let usedColors = Set(categories.map(\.color))
        let nextColor = presetColors.first { !usedColors.contains($0) } ?? presetColors[categories.count % presetColors.count]
        
        let existingKeys = Set(categories.map(\.key))
        var newKey = "new_category"
        var suffix = 2
        while existingKeys.contains(newKey) {
            newKey = "new_category_\(suffix)"
            suffix += 1
        }
        
        let newCategory = CategoryDef(
            key: newKey,
            name: "",
            color: nextColor,
            keywords: []
        )
        pendingNewCategory = newCategory
    }
    
    private func saveAsDefault() {
        Task {
            guard let userId = authViewModel.currentUser?.id else { return }
            do {
                try await UserCategoryDefaultService.upsertDefault(
                    userId: userId,
                    listType: list.type,
                    categories: categories
                )
                showSaveDefaultSuccess = true
            } catch {
                print("Failed to save default categories: \(error)")
            }
        }
    }
    
    private func colorToHex(_ color: Color) -> String {
        let uiColor = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02x%02x%02x", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}

#Preview {
    EditListSheet(
        list: GatherList(ownerId: UUID(), name: "Groceries", emoji: "🛒", color: "#1565c0"),
        viewModel: ListViewModel(userId: UUID(), userEmail: "test@example.com")
    )
}

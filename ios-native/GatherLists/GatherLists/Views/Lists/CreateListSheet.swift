import SwiftUI
import UIKit

/// Bottom sheet for creating a new list with name, emoji, and color selection.
struct CreateListSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let viewModel: ListViewModel
    
    @State private var name = ""
    @State private var selectedEmoji: String? = nil
    @State private var selectedPresetColor: String? = "#1565c0"
    @State private var customColor: Color = .blue
    @State private var showEmojiPicker = false
    @State private var isCreating = false
    @State private var selectedType: String? = "grocery"
    @State private var showCategoryPreview = false
    @State private var previewCategories: [CategoryDef]? = nil
    @State private var customCategories: [CategoryDef]? = nil
    @State private var isLoadingCategories = false
    @State private var selectedCategoryForEdit: CategoryDef? = nil
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    private let presetColors = [
        "#B5E8C8", "#A8D8EA", "#85BFA8", "#FFD6A5", "#FDCFE8", "#B4C7E7", "#D4E09B",
        "#F9A8C9", "#C5B3E6", "#F4C89E", "#A5D6D0", "#C1D5A4", "#F2B5B5", "#D0C4DF"
    ]
    
    private let categoryPreviewTypes = ["grocery", "packing", "todo", "project"]
    
    private let typeGridColumns = [
        GridItem(.flexible()),
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    private var effectiveColor: String {
        if let preset = selectedPresetColor {
            return preset
        }
        return colorToHex(customColor)
    }
    
    private var canCreate: Bool {
        selectedType != nil &&
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !isCreating
    }
    
    private var showsCategoryPreviewOption: Bool {
        guard let type = selectedType else { return false }
        return categoryPreviewTypes.contains(type)
    }
    
    private var displayCategories: [CategoryDef] {
        customCategories ?? previewCategories ?? []
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("List Type") {
                    LazyVGrid(columns: typeGridColumns, spacing: 12) {
                        ForEach(LIST_TYPE_IDS, id: \.self) { typeId in
                            let config = ListTypes.getConfig(typeId)
                            let isSelected = selectedType == typeId
                            
                            Button {
                                selectedType = typeId
                                showCategoryPreview = false
                                customCategories = nil
                            } label: {
                                    VStack(spacing: 6) {
                                    ListTypeIconView(typeId: typeId, size: 28)
                                    Text(config.label)
                                        .font(.caption)
                                        .fontWeight(.medium)
                                        .foregroundStyle(.primary)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 72)
                                .background(
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(isSelected ? brandGreen.opacity(0.1) : Color.clear)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .strokeBorder(isSelected ? brandGreen : Color.secondary.opacity(0.3), lineWidth: isSelected ? 2 : 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                
                if selectedType != nil {
                    Section {
                        TextField("List name", text: $name)
                            .textInputAutocapitalization(.words)
                    }
                    
                    Section("Emoji") {
                        Button {
                            showEmojiPicker = true
                        } label: {
                            HStack {
                                if let emoji = selectedEmoji {
                                    Text(emoji)
                                        .font(.system(size: 32))
                                } else {
                                    Image(systemName: "face.smiling")
                                        .font(.title2)
                                        .foregroundStyle(.secondary)
                                }
                                
                                Spacer()
                                
                                Text(selectedEmoji == nil ? "Choose emoji" : "Change")
                                    .foregroundStyle(.secondary)
                                
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(.tertiary)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    
                    Section("Color") {
                        colorPickerRow
                    }
                    
                    if showsCategoryPreviewOption {
                        Section {
                            DisclosureGroup(isExpanded: $showCategoryPreview) {
                                if isLoadingCategories {
                                    HStack {
                                        Spacer()
                                        ProgressView()
                                        Spacer()
                                    }
                                    .padding(.vertical, 8)
                                } else if displayCategories.isEmpty {
                                    Text("No categories available")
                                        .foregroundStyle(.secondary)
                                        .italic()
                                } else {
                                    ForEach(displayCategories, id: \.key) { category in
                                        Button {
                                            selectedCategoryForEdit = category
                                        } label: {
                                            HStack(spacing: 12) {
                                                Circle()
                                                    .fill(Color(hex: category.color))
                                                    .frame(width: 20, height: 20)
                                                Text(category.name)
                                                    .foregroundStyle(.primary)
                                                Spacer()
                                                Image(systemName: "chevron.right")
                                                    .font(.caption)
                                                    .foregroundStyle(.tertiary)
                                            }
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .onMove(perform: movePreviewCategory)
                                    .onDelete(perform: deletePreviewCategory)
                                    
                                    Button {
                                        addPreviewCategory()
                                    } label: {
                                        HStack {
                                            Image(systemName: "plus.circle.fill")
                                                .foregroundStyle(.green)
                                            Text("Add Category")
                                        }
                                    }
                                    .buttonStyle(.plain)
                                }
                            } label: {
                                HStack {
                                    Text("Customize Categories")
                                    Spacer()
                                    if !showCategoryPreview {
                                        Text("\(displayCategories.count) \(displayCategories.count == 1 ? "default" : "defaults")")
                                            .foregroundStyle(.secondary)
                                            .font(.subheadline)
                                    }
                                }
                            }
                            .onChange(of: showCategoryPreview) { _, expanded in
                                if expanded && previewCategories == nil {
                                    loadPreviewCategories()
                                }
                            }
                            .onChange(of: selectedType) { _, newType in
                                guard let type = newType else { return }
                                if categoryPreviewTypes.contains(type) {
                                    loadPreviewCategories()
                                }
                            }
                            .task {
                                if previewCategories == nil, let type = selectedType, categoryPreviewTypes.contains(type) {
                                    loadPreviewCategories()
                                }
                            }
                        } footer: {
                            Text("Optional. Edit categories before creating, or use defaults.")
                        }
                        .environment(\.editMode, showCategoryPreview && !displayCategories.isEmpty ? .constant(.active) : .constant(.inactive))
                    }
                }
            }
            .navigationTitle("New List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isCreating)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        createList()
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(brandGreen)
                    .disabled(!canCreate)
                }
            }
            .sheet(isPresented: $showEmojiPicker) {
                EmojiPickerView(selectedEmoji: $selectedEmoji)
            }
            .sheet(item: $selectedCategoryForEdit) { category in
                CategoryDetailEditor(
                    category: category,
                    presetColors: presetColors,
                    existingKeys: Set(displayCategories.map(\.key)),
                    onSave: { updated in
                        var cats = customCategories ?? previewCategories ?? []
                        if let index = cats.firstIndex(where: { $0.key == category.key }) {
                            cats[index] = updated
                            customCategories = cats
                        }
                    }
                )
            }
        }
        .interactiveDismissDisabled(isCreating)
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
    
    private func loadPreviewCategories() {
        let type = selectedType ?? "grocery"
        isLoadingCategories = true
        Task {
            let categories = await viewModel.getPreviewCategories(for: type)
            guard selectedType == type else { return }
            previewCategories = categories
            isLoadingCategories = false
        }
    }
    
    private func movePreviewCategory(from source: IndexSet, to destination: Int) {
        var cats = customCategories ?? previewCategories ?? []
        cats.move(fromOffsets: source, toOffset: destination)
        customCategories = cats
    }
    
    private func deletePreviewCategory(at offsets: IndexSet) {
        var cats = customCategories ?? previewCategories ?? []
        cats.remove(atOffsets: offsets)
        customCategories = cats
    }
    
    private func addPreviewCategory() {
        var cats = customCategories ?? previewCategories ?? []
        let usedColors = Set(cats.map(\.color))
        let nextColor = presetColors.first { !usedColors.contains($0) } ?? presetColors[cats.count % presetColors.count]
        
        let existingKeys = Set(cats.map(\.key))
        var newKey = "new_category"
        var suffix = 2
        while existingKeys.contains(newKey) {
            newKey = "new_category_\(suffix)"
            suffix += 1
        }
        
        let newCategory = CategoryDef(
            key: newKey,
            name: "New Category",
            color: nextColor,
            keywords: []
        )
        cats.append(newCategory)
        customCategories = cats
        selectedCategoryForEdit = newCategory
    }
    
    private func createList() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isCreating = true
        Task {
            let categoriesToUse = showCategoryPreview ? customCategories : nil
            await viewModel.createList(
                name: trimmedName,
                emoji: selectedEmoji,
                color: effectiveColor,
                type: selectedType ?? "grocery",
                customCategories: categoriesToUse
            )
            dismiss()
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
    CreateListSheet(viewModel: ListViewModel(userId: UUID(), userEmail: "test@example.com"))
}

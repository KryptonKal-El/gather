import SwiftUI

/// Detail view for editing a single category's name, color, and keywords.
struct CategoryDetailView: View {
    let categoryIndex: Int
    @Binding var categories: [CategoryDef]
    let storeId: UUID
    let viewModel: StoreViewModel
    
    @State private var editedName: String
    @State private var selectedPresetColor: String?
    @State private var customColor: Color
    @State private var newKeyword = ""
    
    private let categoryPresetColors = [
        "#4caf50", "#2196f3", "#e53935", "#ff9800", "#00bcd4",
        "#795548", "#9c27b0", "#ffc107", "#ff5722", "#607d8b",
        "#e91e63", "#9e9e9e", "#1565c0", "#6a1b9a", "#00838f",
        "#2e7d32", "#ef6c00", "#4527a0"
    ]
    
    init(categoryIndex: Int, categories: Binding<[CategoryDef]>, storeId: UUID, viewModel: StoreViewModel) {
        self.categoryIndex = categoryIndex
        self._categories = categories
        self.storeId = storeId
        self.viewModel = viewModel
        
        let cat = categories.wrappedValue[categoryIndex]
        _editedName = State(initialValue: cat.name)
        
        let presetColors = [
            "#4caf50", "#2196f3", "#e53935", "#ff9800", "#00bcd4",
            "#795548", "#9c27b0", "#ffc107", "#ff5722", "#607d8b",
            "#e91e63", "#9e9e9e", "#1565c0", "#6a1b9a", "#00838f",
            "#2e7d32", "#ef6c00", "#4527a0"
        ]
        if presetColors.contains(cat.color) {
            _selectedPresetColor = State(initialValue: cat.color)
            _customColor = State(initialValue: Color(hex: cat.color))
        } else {
            _selectedPresetColor = State(initialValue: nil)
            _customColor = State(initialValue: Color(hex: cat.color))
        }
    }
    
    private var currentCategory: CategoryDef {
        categories[categoryIndex]
    }
    
    private var effectiveColor: String {
        if let preset = selectedPresetColor {
            return preset
        }
        return colorToHex(customColor)
    }
    
    var body: some View {
        Form {
            Section {
                TextField("Category name", text: $editedName)
                    .textInputAutocapitalization(.words)
                    .onChange(of: editedName) {
                        persistChanges()
                    }
            }
            
            Section("Color") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 12) {
                    ForEach(categoryPresetColors, id: \.self) { hex in
                        Button {
                            selectedPresetColor = hex
                            customColor = Color(hex: hex)
                            persistChanges()
                        } label: {
                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 36, height: 36)
                                .overlay {
                                    if selectedPresetColor == hex {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 16, weight: .bold))
                                            .foregroundStyle(.white)
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 8)
                
                ColorPicker("Custom Color", selection: $customColor)
                    .onChange(of: customColor) {
                        selectedPresetColor = nil
                        persistChanges()
                    }
            }
            
            Section("Keywords (\(currentCategory.keywords.count))") {
                ForEach(currentCategory.keywords, id: \.self) { keyword in
                    HStack {
                        Text(keyword)
                        Spacer()
                        Button {
                            removeKeyword(keyword)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                
                HStack {
                    TextField("Add keyword", text: $newKeyword)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit {
                            addKeyword()
                        }
                    Button("Add") {
                        addKeyword()
                    }
                    .disabled(newKeyword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(currentCategory.name)
    }
    
    private func persistChanges() {
        let trimmedName = editedName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        let updated = CategoryDef(
            key: currentCategory.key,
            name: trimmedName,
            color: effectiveColor,
            keywords: currentCategory.keywords
        )
        categories[categoryIndex] = updated
        
        Task { await viewModel.updateCategories(storeId, categories: categories) }
    }
    
    private func addKeyword() {
        let trimmed = newKeyword.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return }
        guard !currentCategory.keywords.contains(trimmed) else {
            newKeyword = ""
            return
        }
        
        var updatedKeywords = currentCategory.keywords
        updatedKeywords.append(trimmed)
        
        let updated = CategoryDef(
            key: currentCategory.key,
            name: currentCategory.name,
            color: currentCategory.color,
            keywords: updatedKeywords
        )
        categories[categoryIndex] = updated
        newKeyword = ""
        
        Task { await viewModel.updateCategories(storeId, categories: categories) }
    }
    
    private func removeKeyword(_ keyword: String) {
        var updatedKeywords = currentCategory.keywords
        updatedKeywords.removeAll { $0 == keyword }
        
        let updated = CategoryDef(
            key: currentCategory.key,
            name: currentCategory.name,
            color: currentCategory.color,
            keywords: updatedKeywords
        )
        categories[categoryIndex] = updated
        
        Task { await viewModel.updateCategories(storeId, categories: categories) }
    }
    
    private func colorToHex(_ color: Color) -> String {
        let uiColor = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02x%02x%02x", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}

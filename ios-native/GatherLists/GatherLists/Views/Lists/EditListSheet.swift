import SwiftUI
import UIKit

/// Bottom sheet for editing an existing list's name, emoji, and color.
struct EditListSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var authViewModel
    
    let list: GatherList
    let viewModel: ListViewModel
    let isOwned: Bool
    
    @State private var name: String
    @State private var selectedEmoji: String?
    @State private var selectedPresetColor: String?
    @State private var customColor: Color
    @State private var showEmojiPicker = false
    @State private var isSaving = false
    @State private var selectedType: String
    @State private var showTypeChangeConfirm = false
    @State private var typeChangeMessage: String = ""
    
    private let presetColors = [
        "#B5E8C8", "#A8D8EA", "#85BFA8", "#FFD6A5", "#FDCFE8", "#B4C7E7", "#D4E09B",
        "#F9A8C9", "#C5B3E6", "#F4C89E", "#A5D6D0", "#C1D5A4", "#F2B5B5", "#D0C4DF"
    ]
    
    static let categorySupportedTypes: Set<String> = ["grocery", "packing", "todo"]
    
    init(list: GatherList, viewModel: ListViewModel, isOwned: Bool = true) {
        self.list = list
        self.viewModel = viewModel
        self.isOwned = isOwned
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
        
        _selectedType = State(initialValue: list.type)
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
                        if let emoji = selectedEmoji, emoji.containsVisualEmoji {
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
                
                if isOwned {
                    Section("List Type") {
                        listTypeGrid
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
                    .foregroundStyle(Color(hex: "#3D7A63"))
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveChanges()
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(Color(hex: "#3D7A63"))
                    .disabled(!canSave)
                }
            }
            .sheet(isPresented: $showEmojiPicker) {
                EmojiPickerView(selectedEmoji: $selectedEmoji)
            }
            .alert("Change List Type?", isPresented: $showTypeChangeConfirm) {
                Button("Cancel", role: .cancel) { }
                Button("Save") {
                    performSave()
                }
            } message: {
                Text(typeChangeMessage)
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
    
    private var listTypeGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(LIST_TYPE_IDS, id: \.self) { typeId in
                let config = ListTypes.getConfig(typeId)
                let isCurrent = typeId == selectedType
                Button {
                    if !isCurrent {
                        handleTypeSelection(newType: typeId, newLabel: config.label)
                    }
                } label: {
                    VStack(spacing: 4) {
                        ListTypeIconView(typeId: typeId, size: 28)
                        Text(config.label)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(isCurrent ? Color(hex: "#3D7A63") : .primary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(isCurrent ? Color(hex: "#3D7A63").opacity(0.15) : Color(.systemGray6))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(isCurrent ? Color(hex: "#3D7A63") : Color.clear, lineWidth: 2)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func handleTypeSelection(newType: String, newLabel: String) {
        selectedType = newType
    }
    
    private func saveChanges() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        if isOwned && selectedType != list.type {
            let newLabel = ListTypes.getConfig(selectedType).label
            let fromCategoryType = Self.categorySupportedTypes.contains(list.type)
            let toCategoryType = Self.categorySupportedTypes.contains(selectedType)
            
            if fromCategoryType && toCategoryType {
                typeChangeMessage = "Changing to \(newLabel) will reset this list's categories to your \(newLabel) defaults. Save anyway?"
            } else if fromCategoryType {
                typeChangeMessage = "Changing to \(newLabel) will remove all categories from this list. Save anyway?"
            } else if toCategoryType {
                typeChangeMessage = "Changing to \(newLabel) will add default \(newLabel) categories. Save anyway?"
            } else {
                typeChangeMessage = "Change list type to \(newLabel)? Save anyway?"
            }
            showTypeChangeConfirm = true
            return
        }
        
        performSave()
    }
    
    private func performSave() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isSaving = true
        Task {
            let emojiValue = selectedEmoji?.isEmpty == false ? selectedEmoji : nil
            let typeToSave = isOwned && selectedType != list.type ? selectedType : nil
            await viewModel.updateList(id: list.id, name: trimmedName, emoji: emojiValue, color: effectiveColor, type: typeToSave, categories: list.categories)
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
    EditListSheet(
        list: GatherList(ownerId: UUID(), name: "Groceries", emoji: "🛒", color: "#1565c0"),
        viewModel: ListViewModel(userId: UUID(), userEmail: "test@example.com"),
        isOwned: true
    )
}

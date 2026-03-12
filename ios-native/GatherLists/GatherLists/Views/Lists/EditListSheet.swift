import SwiftUI
import UIKit

/// Bottom sheet for editing an existing list's name, emoji, and color.
struct EditListSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let list: GatherList
    let viewModel: ListViewModel
    
    @State private var name: String
    @State private var selectedEmoji: String?
    @State private var selectedPresetColor: String?
    @State private var customColor: Color
    @State private var showEmojiPicker = false
    @State private var isSaving = false
    
    private let presetColors = [
        "#1565c0", "#6a1b9a", "#00838f", "#2e7d32", "#ef6c00",
        "#c62828", "#4527a0", "#00695c", "#ad1457", "#37474f",
        "#f9a825", "#4e342e", "#1b5e20", "#283593", "#bf360c",
        "#0277bd", "#558b2f", "#7b1fa2"
    ]
    
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
        }
        .interactiveDismissDisabled(isSaving)
    }
    
    private var colorPickerRow: some View {
        VStack(spacing: 12) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 36))], spacing: 12) {
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
                                        .foregroundStyle(.white)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
            
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
            await viewModel.updateList(id: list.id, name: trimmedName, emoji: emojiValue, color: effectiveColor)
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
        viewModel: ListViewModel(userId: UUID(), userEmail: "test@example.com")
    )
}

import SwiftUI

/// Bottom sheet for editing an existing list's name, emoji, and color.
struct EditListSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let list: GatherList
    let viewModel: ListViewModel
    
    @State private var name: String
    @State private var selectedEmoji: String?
    @State private var selectedColor: String
    @State private var showEmojiPicker = false
    @State private var isSaving = false
    
    private let presetColors = [
        "#1565c0", "#2e7d32", "#c62828", "#ef6c00", "#6a1b9a",
        "#00838f", "#ad1457", "#f9a825", "#37474f", "#4e342e"
    ]
    
    init(list: GatherList, viewModel: ListViewModel) {
        self.list = list
        self.viewModel = viewModel
        _name = State(initialValue: list.name)
        _selectedEmoji = State(initialValue: list.emoji)
        _selectedColor = State(initialValue: list.color)
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
        HStack(spacing: 12) {
            ForEach(presetColors, id: \.self) { colorHex in
                Button {
                    selectedColor = colorHex
                } label: {
                    Circle()
                        .fill(Color(hex: colorHex))
                        .frame(width: 32, height: 32)
                        .overlay {
                            if selectedColor == colorHex {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }
    
    private func saveChanges() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isSaving = true
        Task {
            // Pass empty string for cleared emoji so it updates in DB
            let emojiValue = selectedEmoji?.isEmpty == false ? selectedEmoji : ""
            await viewModel.updateList(id: list.id, name: trimmedName, emoji: emojiValue, color: selectedColor)
            dismiss()
        }
    }
}

#Preview {
    EditListSheet(
        list: GatherList(ownerId: UUID(), name: "Groceries", emoji: "🛒", color: "#1565c0"),
        viewModel: ListViewModel(userId: UUID(), userEmail: "test@example.com")
    )
}

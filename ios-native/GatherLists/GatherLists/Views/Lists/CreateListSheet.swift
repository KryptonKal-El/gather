import SwiftUI

/// Bottom sheet for creating a new list with name, emoji, and color selection.
struct CreateListSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let viewModel: ListViewModel
    
    @State private var name = ""
    @State private var selectedEmoji: String? = nil
    @State private var selectedColor = "#1565c0"
    @State private var showEmojiPicker = false
    @State private var isCreating = false
    
    private let presetColors = [
        "#1565c0", "#2e7d32", "#c62828", "#ef6c00", "#6a1b9a",
        "#00838f", "#ad1457", "#f9a825", "#37474f", "#4e342e"
    ]
    
    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isCreating
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
                    }
                    .buttonStyle(.plain)
                }
                
                Section("Color") {
                    colorPickerRow
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
                    .disabled(!canCreate)
                }
            }
            .sheet(isPresented: $showEmojiPicker) {
                EmojiPickerView(selectedEmoji: $selectedEmoji)
            }
        }
        .interactiveDismissDisabled(isCreating)
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
    
    private func createList() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isCreating = true
        Task {
            await viewModel.createList(name: trimmedName, emoji: selectedEmoji, color: selectedColor)
            dismiss()
        }
    }
}

#Preview {
    CreateListSheet(viewModel: ListViewModel(userId: UUID(), userEmail: "test@example.com"))
}

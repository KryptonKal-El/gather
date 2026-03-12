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
    @State private var selectedType: String? = nil
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    private let presetColors = [
        "#1565c0", "#2e7d32", "#c62828", "#ef6c00", "#6a1b9a",
        "#00838f", "#ad1457", "#f9a825", "#37474f", "#4e342e"
    ]
    
    private let typeGridColumns = [
        GridItem(.flexible()),
        GridItem(.flexible()),
        GridItem(.flexible())
    ]
    
    private var canCreate: Bool {
        selectedType != nil &&
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !isCreating
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
                            } label: {
                                VStack(spacing: 6) {
                                    Text(config.icon)
                                        .font(.system(size: 28))
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
        }
        .interactiveDismissDisabled(isCreating)
    }
    
    private var colorPickerRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
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
            .padding(.vertical, 4)
        }
    }
    
    private func createList() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isCreating = true
        Task {
            await viewModel.createList(name: trimmedName, emoji: selectedEmoji, color: selectedColor, type: selectedType ?? "grocery")
            dismiss()
        }
    }
}

#Preview {
    CreateListSheet(viewModel: ListViewModel(userId: UUID(), userEmail: "test@example.com"))
}

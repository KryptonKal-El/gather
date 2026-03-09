import SwiftUI

/// Sheet for editing a collection's name, emoji, and description.
struct EditCollectionSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let collection: RecipeCollection
    let viewModel: RecipeViewModel
    
    @State private var name: String
    @State private var selectedEmoji: String?
    @State private var descriptionText: String
    @State private var showEmojiPicker = false
    @State private var isSaving = false
    
    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }
    
    init(collection: RecipeCollection, viewModel: RecipeViewModel) {
        self.collection = collection
        self.viewModel = viewModel
        _name = State(initialValue: collection.name)
        _selectedEmoji = State(initialValue: collection.emoji)
        _descriptionText = State(initialValue: collection.description ?? "")
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Collection name", text: $name)
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
                
                Section("Description") {
                    TextField("Optional description", text: $descriptionText, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle("Edit Collection")
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
                        saveCollection()
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
    
    private func saveCollection() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isSaving = true
        Task {
            let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
            await viewModel.updateCollection(
                id: collection.id,
                name: trimmedName,
                emoji: selectedEmoji,
                description: desc.isEmpty ? nil : desc
            )
            dismiss()
        }
    }
}

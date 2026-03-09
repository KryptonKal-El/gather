import SwiftUI

/// Sheet for creating a new recipe collection with name, emoji, and optional description.
struct CreateCollectionSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let viewModel: RecipeViewModel
    
    @State private var name = ""
    @State private var selectedEmoji: String? = "📖"
    @State private var descriptionText = ""
    @State private var showEmojiPicker = false
    @State private var isCreating = false
    
    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isCreating
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
            .navigationTitle("New Collection")
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
                        createCollection()
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
    
    private func createCollection() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isCreating = true
        Task {
            let desc = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
            await viewModel.createCollection(
                name: trimmedName,
                emoji: selectedEmoji,
                description: desc.isEmpty ? nil : desc
            )
            dismiss()
        }
    }
}

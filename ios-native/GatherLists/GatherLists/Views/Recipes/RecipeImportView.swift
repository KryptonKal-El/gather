import SwiftUI
import UIKit

/// Step 1 of the "Import from Text" flow. The user pastes or types raw recipe
/// text and taps Next, which runs the AI parser. The structured result is then
/// reviewed in a pre-filled `RecipeFormSheet` before it's imported as a new
/// recipe. Falls back to the local line parser if the AI parser is unavailable.
struct RecipeImportView: View {
    let viewModel: RecipeViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var text = ""
    @State private var isParsing = false
    @State private var draft: ParsedRecipe?
    @State private var showForm = false

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        ZStack {
            Form {
                Section {
                    Button {
                        if let clip = UIPasteboard.general.string,
                           !clip.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            text = clip
                        }
                    } label: {
                        Label("Paste from clipboard", systemImage: "doc.on.clipboard")
                    }
                } footer: {
                    Text("Paste a whole recipe — the ingredients and steps are detected automatically. You can review and edit everything on the next screen before importing.")
                }

                Section("Recipe text") {
                    TextEditor(text: $text)
                        .frame(minHeight: 220)
                        .textInputAutocapitalization(.sentences)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .disabled(isParsing)

            if isParsing {
                Color.black.opacity(0.2).ignoresSafeArea()
                VStack(spacing: 12) {
                    ProgressView()
                        .scaleEffect(1.2)
                    Text("Reading your recipe…")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Import from Text")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Next") {
                    Task { await parse() }
                }
                .fontWeight(.semibold)
                .disabled(trimmedText.isEmpty || isParsing)
            }
        }
        .interactiveDismissDisabled(isParsing)
        .sheet(isPresented: $showForm) {
            if let draft {
                RecipeFormSheet(
                    viewModel: viewModel,
                    prefillName: draft.name,
                    prefillIngredients: draft.ingredients.map { (name: $0.name, quantity: $0.quantity) },
                    prefillSteps: draft.steps,
                    saveButtonTitle: "Import",
                    onComplete: { dismiss() },
                    showCollectionPicker: true
                )
            }
        }
    }

    @MainActor
    private func parse() async {
        let raw = trimmedText
        guard !raw.isEmpty else { return }

        isParsing = true
        defer { isParsing = false }

        // Prefer the AI parser (ingredients with quantities + steps); fall back
        // to the local ingredient-only parser if it's unavailable or empty.
        if let parsed = await RecipeTextParseService.parse(text: raw),
           !(parsed.ingredients.isEmpty && parsed.steps.isEmpty) {
            draft = parsed
        } else {
            let local = RecipeTextParser.parseRecipeText(raw)
            draft = ParsedRecipe(
                name: "",
                ingredients: local.map { (quantity: "", name: $0.name) },
                steps: []
            )
        }
        showForm = true
    }
}

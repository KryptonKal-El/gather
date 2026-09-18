import SwiftUI
import UIKit

/// Step 1 of the "Import from Text" flow. The user pastes or types raw recipe
/// text and taps Next, which runs the on-device parser. The structured result
/// is then reviewed in a pre-filled `RecipeFormSheet` before it's imported as a
/// new recipe. Only reachable when `RecipeTextParseService.isAvailable`.
struct RecipeImportView: View {
    let viewModel: RecipeViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var text = ""
    @State private var isParsing = false
    @State private var draft: ParsedRecipe?
    @State private var showForm = false
    @State private var errorMessage: String?

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
                        .font(.quicksand(.subheadline))
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
        .alert("Couldn't Import", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
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

        do {
            draft = try await RecipeTextParseService.parse(text: raw)
            showForm = true
        } catch RecipeParseError.tooLong {
            errorMessage = "That's too much text to read on this device. Trim it down to just the ingredients and steps, then try again."
        } catch {
            errorMessage = "We couldn't find a recipe in that text. Check it and try again."
        }
    }
}

import SwiftUI
import UIKit

/// Step 1 of the "Import from URL" flow. The user pastes a recipe's web address
/// and taps Next, which asks the import-recipe-url edge function to fetch and
/// parse the page. The structured result is reviewed in a pre-filled
/// `RecipeFormSheet` before it's imported as a new recipe.
struct RecipeUrlImportView: View {
    let viewModel: RecipeViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var urlText = ""
    @State private var isImporting = false
    @State private var draft: ImportedRecipe?
    @State private var showForm = false
    @State private var errorMessage: String?

    private var trimmedUrl: String {
        urlText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canImport: Bool {
        guard let url = URL(string: trimmedUrl), let scheme = url.scheme?.lowercased() else { return false }
        return (scheme == "http" || scheme == "https") && url.host != nil
    }

    var body: some View {
        ZStack {
            Form {
                Section {
                    Button {
                        if let clip = UIPasteboard.general.string,
                           !clip.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            urlText = clip
                        }
                    } label: {
                        Label("Paste link", systemImage: "doc.on.clipboard")
                    }
                } footer: {
                    Text("Paste a recipe's web address — the title, ingredients, steps, and photo are pulled in automatically. You can review and edit everything on the next screen before importing.")
                }

                Section("Recipe URL") {
                    TextField("https://…", text: $urlText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .submitLabel(.go)
                        .onSubmit {
                            if canImport { Task { await importRecipe() } }
                        }
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .disabled(isImporting)

            if isImporting {
                Color.black.opacity(0.35).ignoresSafeArea()
                VStack(spacing: 14) {
                    ProgressView()
                        .controlSize(.large)
                        .tint(.white)
                    Text("Fetching the recipe…")
                        .font(.quicksand(.subheadline, weight: .medium))
                        .foregroundStyle(.white)
                }
                .padding(28)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
            }
        }
        .navigationTitle("Import from URL")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Next") {
                    Task { await importRecipe() }
                }
                .fontWeight(.semibold)
                .disabled(!canImport || isImporting)
            }
        }
        .interactiveDismissDisabled(isImporting)
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
                    prefillImageUrl: draft.imageUrl ?? "",
                    saveButtonTitle: "Import",
                    onComplete: { dismiss() },
                    showCollectionPicker: true
                )
            }
        }
    }

    @MainActor
    private func importRecipe() async {
        guard canImport else { return }
        isImporting = true
        defer { isImporting = false }

        do {
            draft = try await RecipeUrlImportService.importRecipe(from: trimmedUrl)
            showForm = true
        } catch RecipeUrlImportError.invalidUrl {
            errorMessage = "That doesn't look like a valid recipe link. Check the address and try again."
        } catch RecipeUrlImportError.noRecipeFound {
            errorMessage = "We couldn't find a recipe on that page. Some sites don't publish a readable recipe — try the \"Import from Text\" option instead."
        } catch {
            errorMessage = "We couldn't reach that page. Check your connection and try again."
        }
    }
}

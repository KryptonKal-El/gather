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
            // A VStack (not a Form) so the editor can grow to fill all the space
            // below the paste button, giving the user maximum room for long text.
            VStack(alignment: .leading, spacing: 12) {
                Button {
                    if let clip = UIPasteboard.general.string,
                       !clip.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        text = clip
                    }
                } label: {
                    Label("Paste from clipboard", systemImage: "doc.on.clipboard")
                        .font(.quicksand(.subheadline, weight: .medium))
                }

                Text("Paste a whole recipe — the ingredients and steps are detected automatically. You can review and edit everything on the next screen before importing.")
                    .font(.quicksand(.caption))
                    .foregroundStyle(.secondary)

                ScrollingTextEditor(text: $text)
                    .padding(10)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .background(Color(.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color(.systemGroupedBackground))
            .disabled(isParsing)

            if isParsing {
                Color.black.opacity(0.35).ignoresSafeArea()
                VStack(spacing: 14) {
                    ProgressView()
                        .controlSize(.large)
                        .tint(.white)
                    Text("Reading your recipe…")
                        .font(.quicksand(.subheadline, weight: .medium))
                        .foregroundStyle(.white)
                }
                .padding(28)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
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

/// A multiline, fill-the-space text editor backed by UITextView that keeps the
/// caret visible while typing. Used instead of SwiftUI's `TextEditor`, which
/// doesn't reliably auto-scroll to the cursor, so a long recipe would leave the
/// current line hidden below the visible area.
private struct ScrollingTextEditor: UIViewRepresentable {
    @Binding var text: String

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()
        textView.delegate = context.coordinator
        textView.font = .preferredFont(forTextStyle: .body)
        textView.adjustsFontForContentSizeCategory = true
        textView.autocapitalizationType = .sentences
        textView.backgroundColor = .clear
        textView.isScrollEnabled = true
        textView.keyboardDismissMode = .interactive
        textView.textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
        textView.textContainer.lineFragmentPadding = 0
        return textView
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        if uiView.text != text {
            uiView.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        private let text: Binding<String>

        init(text: Binding<String>) {
            self.text = text
        }

        func textViewDidChange(_ textView: UITextView) {
            text.wrappedValue = textView.text
            scrollCaretToVisible(textView)
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            scrollCaretToVisible(textView)
        }

        /// Keeps the caret in view; deferred so it runs after the text view has
        /// laid out the change.
        private func scrollCaretToVisible(_ textView: UITextView) {
            guard let range = textView.selectedTextRange else { return }
            let caretRect = textView.caretRect(for: range.end)
            guard caretRect.origin.y.isFinite else { return }
            DispatchQueue.main.async {
                textView.scrollRectToVisible(caretRect, animated: false)
            }
        }
    }
}

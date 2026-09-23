import SwiftUI

/// The recipe's planner details (meals, protein, cuisine, effort…) as chips, with an editor.
struct RecipeAttributesSection: View {
    let recipe: Recipe
    let canEdit: Bool
    let userId: UUID

    @State private var attributes: RecipeAttributes?
    @State private var didLoad = false
    @State private var showEditor = false
    @State private var isTagging = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Details")
                    .font(.quicksand(.headline, weight: .bold))
                Spacer()
                if canEdit && didLoad {
                    Button(attributes == nil ? "Add" : "Edit") { showEditor = true }
                        .font(.quicksand(.subheadline, weight: .semibold))
                        .tint(Color.brandGreen)
                }
            }

            if let chips = attributes?.displayChips, !chips.isEmpty {
                FlowChips(labels: chips)
            } else if isTagging {
                Label("Adding details on this iPhone…", systemImage: "sparkles")
                    .font(.quicksand(.subheadline))
                    .foregroundStyle(.secondary)
            } else if didLoad {
                Text("Meal, protein, cuisine and effort help the Plan tab suggest a balanced week.")
                    .font(.quicksand(.subheadline))
                    .foregroundStyle(.secondary)
            }
        }
        .task(id: recipe.id) { await load() }
        .sheet(isPresented: $showEditor) {
            RecipeAttributesSheet(
                recipeName: recipe.name,
                attributes: attributes ?? RecipeAttributes(recipeId: recipe.id),
                onSave: save
            )
        }
    }

    private func load() async {
        do {
            attributes = try await RecipeAttributeService.fetch(recipeId: recipe.id)
        } catch {
            print("[RecipeAttributesSection] Failed to load: \(error.localizedDescription)")
        }
        didLoad = true
        if attributes == nil, canEdit, RecipeTaggingService.isAvailable {
            await tagNow()
        }
    }

    /// Tags a never-tagged recipe right away while the user is looking at it.
    private func tagNow() async {
        isTagging = true
        defer { isTagging = false }
        do {
            let detail = try await RecipeService.fetchRecipeDetail(recipeId: recipe.id)
            let names = detail.ingredients.map(\.name)
            guard !names.isEmpty,
                  let result = await RecipeTaggingService.tag(
                      recipeId: recipe.id,
                      name: detail.recipe.name,
                      description: detail.recipe.description,
                      ingredients: names,
                      steps: detail.steps.map(\.instruction),
                      existing: nil
                  )
            else { return }
            attributes = try await RecipeAttributeService.upsert(result, userId: userId)
        } catch {
            print("[RecipeAttributesSection] Tagging failed: \(error.localizedDescription)")
        }
    }

    private func save(_ updated: RecipeAttributes) async -> Bool {
        do {
            attributes = try await RecipeAttributeService.upsert(updated, userId: userId)
            return true
        } catch {
            print("[RecipeAttributesSection] Failed to save: \(error.localizedDescription)")
            return false
        }
    }
}

/// Wrapping row of small capsule labels.
private struct FlowChips: View {
    let labels: [String]

    var body: some View {
        FlowLayout(spacing: 6) {
            ForEach(labels, id: \.self) { label in
                Text(label)
                    .font(.quicksand(.caption, weight: .semibold))
                    .foregroundStyle(Color.brandGreen)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.brandGreen.opacity(0.12), in: Capsule())
            }
        }
    }
}

/// Minimal left-aligned wrapping layout.
private struct FlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var widest: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                y += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            widest = max(widest, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: min(widest, maxWidth), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += rowHeight + spacing
                x = bounds.minX
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

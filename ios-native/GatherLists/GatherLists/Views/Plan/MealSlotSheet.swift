import SwiftUI

/// Sheet for choosing what goes in a meal slot: a recipe, leftovers, eating out, skip, or another meal.
struct MealSlotSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: MealPlanViewModel
    let day: Date
    let meal: MealType
    var onViewRecipe: (Recipe) -> Void

    @State private var kind: MealEntryKind = .recipe
    @State private var selectedRecipe: Recipe?
    @State private var customTitle = ""
    @State private var note = ""
    @State private var isSaving = false
    @State private var didLoad = false

    private static let kindOrder: [MealEntryKind] = [.recipe, .custom, .leftovers, .eatingOut, .skip]

    private var existing: MealPlanEntry? {
        viewModel.entry(for: day, meal: meal)
    }

    private var canSave: Bool {
        switch kind {
        case .recipe: return selectedRecipe != nil
        case .custom: return !customTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        default: return true
        }
    }

    private var title: String {
        "\(day.formatted(.dateTime.weekday(.abbreviated))) \(meal.label)"
    }

    var body: some View {
        NavigationStack {
            Form {
                kindSection
                detailSection
                noteSection
                actionsSection
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save").fontWeight(.semibold)
                        }
                    }
                    .disabled(!canSave || isSaving)
                }
            }
            .onAppear(perform: loadExisting)
        }
    }

    // MARK: - Sections

    private var kindSection: some View {
        Section("What's for \(meal.label.lowercased())?") {
            ForEach(Self.kindOrder, id: \.self) { option in
                Button {
                    kind = option
                } label: {
                    HStack {
                        Label(option.label, systemImage: option.systemImage)
                            .foregroundStyle(Color.primary)
                        Spacer()
                        if kind == option {
                            Image(systemName: "checkmark")
                                .foregroundStyle(Color.brandGreen)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var detailSection: some View {
        if kind == .recipe {
            Section("Recipe") {
                NavigationLink {
                    RecipePickerList(recipes: viewModel.recipes, selected: $selectedRecipe)
                } label: {
                    HStack {
                        Text(selectedRecipe?.name ?? "Choose a recipe")
                            .foregroundStyle(selectedRecipe == nil ? Color.secondary : Color.primary)
                        Spacer()
                    }
                }
            }
        } else if kind == .custom {
            Section("Meal") {
                TextField("e.g. Sandwiches", text: $customTitle)
            }
        }
    }

    private var noteSection: some View {
        Section("Note") {
            TextField("Optional", text: $note, axis: .vertical)
                .lineLimit(1...3)
        }
    }

    @ViewBuilder
    private var actionsSection: some View {
        if let existing {
            Section {
                if existing.kind == .recipe, let recipeId = existing.recipeId, let recipe = viewModel.recipesById[recipeId] {
                    Button {
                        onViewRecipe(recipe)
                    } label: {
                        Label("View Recipe", systemImage: "book")
                            .foregroundStyle(Color.brandGreen)
                    }
                    .buttonStyle(.plain)
                }
                Button(role: .destructive) {
                    Task {
                        await viewModel.clearSlot(day: day, meal: meal)
                        dismiss()
                    }
                } label: {
                    Label("Clear Meal", systemImage: "xmark.circle")
                        .foregroundStyle(.red)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Actions

    private func loadExisting() {
        guard !didLoad else { return }
        didLoad = true
        guard let existing else { return }
        kind = existing.kind
        note = existing.note ?? ""
        if existing.kind == .recipe, let recipeId = existing.recipeId {
            selectedRecipe = viewModel.recipesById[recipeId]
        }
        if existing.kind == .custom {
            customTitle = existing.title ?? ""
        }
    }

    private func save() async {
        isSaving = true
        if kind == .recipe, let selectedRecipe {
            await viewModel.setRecipe(selectedRecipe, day: day, meal: meal, note: note)
        } else {
            await viewModel.setMarker(kind, title: kind == .custom ? customTitle : nil, day: day, meal: meal, note: note)
        }
        isSaving = false
        if viewModel.error == nil {
            dismiss()
        }
    }
}

/// Searchable list of recipes for picking one to plan.
private struct RecipePickerList: View {
    @Environment(\.dismiss) private var dismiss

    let recipes: [Recipe]
    @Binding var selected: Recipe?

    @State private var query = ""

    private var filtered: [Recipe] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return recipes }
        return recipes.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
    }

    var body: some View {
        List {
            if recipes.isEmpty {
                ContentUnavailableView(
                    "No recipes yet",
                    systemImage: "book",
                    description: Text("Add recipes in the Recipes tab to plan them here.")
                )
            } else if filtered.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
                ForEach(filtered) { recipe in
                    Button {
                        selected = recipe
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(recipe.name)
                                    .foregroundStyle(Color.primary)
                                if let lastCooked = recipe.lastCookedAt {
                                    Text("Last made \(lastCooked.formatted(.relative(presentation: .named)))")
                                        .font(.quicksand(.caption))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if selected?.id == recipe.id {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.brandGreen)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Choose Recipe")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search recipes")
    }
}

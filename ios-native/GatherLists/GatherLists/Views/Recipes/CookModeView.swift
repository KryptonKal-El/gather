import SwiftUI

/// Full-screen guided cooking mode: an ingredient checklist first, then one
/// step per screen in large text with next/back controls and a progress bar.
/// Closing the view keeps the session in progress so it can be resumed later.
struct CookModeView: View {
    @Environment(\.dismiss) private var dismiss

    let recipe: Recipe
    let ingredients: [RecipeIngredient]
    let cookViewModel: CookSessionViewModel

    @State private var showIngredientPhase: Bool
    @State private var currentStepIndex: Int
    @State private var gatheredIngredients: Set<UUID> = []
    @State private var showDiscardConfirm = false
    @State private var showFinishScreen = false

    init(recipe: Recipe, ingredients: [RecipeIngredient], cookViewModel: CookSessionViewModel) {
        self.recipe = recipe
        self.ingredients = ingredients
        self.cookViewModel = cookViewModel

        let session = cookViewModel.activeSession
        let hasProgress = (session?.currentStep ?? 0) > 0
            || cookViewModel.activeSteps.contains { $0.completedAt != nil }
        _showIngredientPhase = State(initialValue: !hasProgress && !ingredients.isEmpty)
        _currentStepIndex = State(initialValue: min(
            session?.currentStep ?? 0,
            max(cookViewModel.activeSteps.count - 1, 0)
        ))
    }

    var body: some View {
        NavigationStack {
            Group {
                if showIngredientPhase {
                    ingredientPhase
                } else if showFinishScreen || cookViewModel.activeSteps.isEmpty {
                    finishScreen
                } else {
                    stepPhase
                }
            }
            .navigationTitle(recipe.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(.primary)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button(role: .destructive) {
                            showDiscardConfirm = true
                        } label: {
                            Label("Discard Cook", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                    }
                }
            }
            .confirmationDialog(
                "Discard this cook?",
                isPresented: $showDiscardConfirm,
                titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) {
                    Task {
                        await cookViewModel.cancelCook()
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This cook won't be recorded in the recipe's history.")
            }
        }
        .tint(Color.brandGreen)
        .interactiveDismissDisabled()
    }

    // MARK: - Ingredient Phase

    @ViewBuilder
    private var ingredientPhase: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Gather your ingredients")
                        .font(.quicksand(.title2))
                        .fontWeight(.bold)
                        .padding(.top, 8)

                    ForEach(ingredients) { ingredient in
                        Button {
                            toggleGathered(ingredient.id)
                        } label: {
                            HStack(spacing: 14) {
                                Image(systemName: gatheredIngredients.contains(ingredient.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(gatheredIngredients.contains(ingredient.id) ? .green : .secondary)
                                    .font(.quicksand(.title2))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(ingredient.name)
                                        .font(.quicksand(.title3))
                                        .strikethrough(gatheredIngredients.contains(ingredient.id))
                                        .foregroundStyle(gatheredIngredients.contains(ingredient.id) ? .secondary : .primary)
                                    if let qty = ingredient.quantity, !qty.isEmpty {
                                        Text(qty)
                                            .font(.quicksand(.subheadline))
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }

            bottomBar {
                Button {
                    showIngredientPhase = false
                } label: {
                    Text(gatheredIngredients.count == ingredients.count
                         ? "Begin Cooking"
                         : "Begin Cooking (\(gatheredIngredients.count)/\(ingredients.count) gathered)")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.brandGreen)
                        .foregroundStyle(.white)
                        .fontWeight(.semibold)
                        .cornerRadius(14)
                }
            }
        }
    }

    // MARK: - Step Phase

    @ViewBuilder
    private var stepPhase: some View {
        let steps = cookViewModel.activeSteps
        let step = steps[min(currentStepIndex, steps.count - 1)]

        VStack(spacing: 0) {
            VStack(spacing: 10) {
                ProgressView(value: Double(completedCount), total: Double(steps.count))
                    .tint(.green)
                    .animation(.easeInOut(duration: 0.35), value: completedCount)
                Text("Step \(currentStepIndex + 1) of \(steps.count)")
                    .font(.quicksand(.subheadline))
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)
            .padding(.top, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if step.completedAt != nil {
                        Label("Done", systemImage: "checkmark.circle.fill")
                            .font(.quicksand(.headline))
                            .foregroundStyle(.green)
                    }
                    Text(step.instruction)
                        .font(.quicksand(.title))
                        .fontWeight(.medium)
                        .lineSpacing(6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding()
            }

            bottomBar {
                HStack(spacing: 12) {
                    if currentStepIndex > 0 {
                        Button {
                            goToStep(currentStepIndex - 1)
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.quicksand(.title3))
                                .fontWeight(.semibold)
                                .padding(.vertical, 16)
                                .padding(.horizontal, 20)
                                .background(Color(.systemGray5))
                                .foregroundStyle(.primary)
                                .cornerRadius(14)
                        }
                    }

                    Button {
                        Task { await cookViewModel.setStepCompleted(step, completed: true) }
                        if currentStepIndex < steps.count - 1 {
                            goToStep(currentStepIndex + 1)
                        } else {
                            showFinishScreen = true
                        }
                    } label: {
                        Text(currentStepIndex < steps.count - 1 ? "Next Step" : "All Steps Done")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.brandGreen)
                            .foregroundStyle(.white)
                            .fontWeight(.semibold)
                            .cornerRadius(14)
                    }
                }
            }
        }
    }

    // MARK: - Finish Screen

    @ViewBuilder
    private var finishScreen: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.quicksand(size: 64))
                .foregroundStyle(.green)
            Text("Nice cooking!")
                .font(.quicksand(.largeTitle))
                .fontWeight(.bold)
            if let session = cookViewModel.activeSession {
                Text("Cooked in \(formattedDuration(session.duration))")
                    .font(.quicksand(.title3))
                    .foregroundStyle(.secondary)
            }
            Spacer()

            bottomBar {
                HStack(spacing: 12) {
                    if !cookViewModel.activeSteps.isEmpty {
                        Button {
                            showFinishScreen = false
                        } label: {
                            Text("Back")
                                .padding(.vertical, 16)
                                .padding(.horizontal, 24)
                                .background(Color(.systemGray5))
                                .foregroundStyle(.primary)
                                .cornerRadius(14)
                        }
                    }

                    Button {
                        Task {
                            await cookViewModel.finishCook()
                            dismiss()
                        }
                    } label: {
                        Text("Finish Cooking")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.brandGreen)
                            .foregroundStyle(.white)
                            .fontWeight(.semibold)
                            .cornerRadius(14)
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func bottomBar<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) {
            Divider()
            content()
                .padding()
        }
        .background(Color(.systemBackground))
    }

    private var completedCount: Int {
        cookViewModel.activeSteps.filter { $0.completedAt != nil }.count
    }

    private func goToStep(_ index: Int) {
        currentStepIndex = index
        Task { await cookViewModel.setCurrentStep(index) }
    }

    private func toggleGathered(_ id: UUID) {
        if gatheredIngredients.contains(id) {
            gatheredIngredients.remove(id)
        } else {
            gatheredIngredients.insert(id)
        }
    }

    private func formattedDuration(_ interval: TimeInterval) -> String {
        let minutes = Int(interval / 60)
        if minutes < 1 { return "under a minute" }
        if minutes < 60 { return "\(minutes) min" }
        let hours = minutes / 60
        let remainder = minutes % 60
        return remainder == 0 ? "\(hours) hr" : "\(hours) hr \(remainder) min"
    }
}

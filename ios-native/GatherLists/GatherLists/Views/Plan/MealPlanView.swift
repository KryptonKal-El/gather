import SwiftUI

/// Identifies the slot being edited in the slot sheet.
private struct SlotSelection: Identifiable {
    let day: Date
    let meal: MealType
    var id: String { "\(MealPlanWeek.key(for: day))|\(meal.rawValue)" }
}

/// The Plan tab: a shared weekly meal plan with breakfast, lunch and dinner for each day.
struct MealPlanView: View {
    @Environment(AuthViewModel.self) private var authViewModel

    @State private var viewModel: MealPlanViewModel?
    @State private var recipeViewModel: RecipeViewModel?
    @State private var path: [Recipe] = []
    @State private var editingSlot: SlotSelection?
    @State private var showShareSheet = false
    @State private var showAddToList = false
    @State private var weekIngredients: [(name: String, quantity: String?, amount: Double?, unit: String?)] = []
    @State private var isPreparingList = false
    @State private var showLeaveConfirm = false

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let viewModel {
                    planContent(viewModel)
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("Plan")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { toolbarContent }
            .navigationDestination(for: Recipe.self) { recipe in
                recipeDestination(recipe)
            }
        }
        .onAppear(perform: initializeViewModelsIfNeeded)
        .sheet(item: $editingSlot) { slot in
            slotSheet(slot)
        }
        .sheet(isPresented: $showShareSheet) {
            if let viewModel {
                ShareMealPlanSheet(viewModel: viewModel)
            }
        }
        .sheet(isPresented: $showAddToList) {
            if let user = authViewModel.currentUser {
                AddToListSheet(
                    ingredients: weekIngredients,
                    userId: user.id,
                    userEmail: user.email ?? "",
                    onDismiss: { showAddToList = false }
                )
            }
        }
        .confirmationDialog("Leave this meal plan?", isPresented: $showLeaveConfirm, titleVisibility: .visible) {
            Button("Leave", role: .destructive) {
                Task { await viewModel?.leaveActivePlan() }
            }
        } message: {
            Text("You'll stop seeing this plan. The owner can invite you again.")
        }
    }

    // MARK: - Content

    private func planContent(_ viewModel: MealPlanViewModel) -> some View {
        List {
            Section {
                WeekSwitcherView(viewModel: viewModel)
                    .listRowInsets(EdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8))
                PlanBarView(viewModel: viewModel)
                if let note = viewModel.libraryNote {
                    Label(note, systemImage: "info.circle")
                        .font(.quicksand(.subheadline))
                        .foregroundStyle(.secondary)
                }
                if viewModel.isShowingCachedData {
                    CachedDataBanner(cachedAt: nil)
                }
                if let error = viewModel.error {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.quicksand(.subheadline))
                        .foregroundStyle(.orange)
                }
            }

            ForEach(viewModel.days, id: \.self) { day in
                Section {
                    ForEach(viewModel.enabledMeals) { meal in
                        slotRow(viewModel: viewModel, day: day, meal: meal)
                    }
                } header: {
                    DayHeaderView(day: day)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await viewModel.refresh() }
    }

    private func slotRow(viewModel: MealPlanViewModel, day: Date, meal: MealType) -> some View {
        let entry = viewModel.entry(for: day, meal: meal)
        let recipe = entry?.recipeId.flatMap { viewModel.recipesById[$0] }
        return MealSlotRow(
            meal: meal,
            entry: entry,
            recipe: recipe,
            onToggleLock: { Task { await viewModel.toggleLock(day: day, meal: meal) } },
            onSwap: { Task { await viewModel.swap(day: day, meal: meal) } }
        )
            .contentShape(Rectangle())
            .onTapGesture { editingSlot = SlotSelection(day: day, meal: meal) }
            .contextMenu {
                if let recipe {
                    Button {
                        path.append(recipe)
                    } label: {
                        Label("View Recipe", systemImage: "book")
                    }
                }
                Button {
                    editingSlot = SlotSelection(day: day, meal: meal)
                } label: {
                    Label(entry == nil ? "Plan Meal" : "Change", systemImage: "pencil")
                }
                if entry != nil {
                    Button(role: .destructive) {
                        Task { await viewModel.clearSlot(day: day, meal: meal) }
                    } label: {
                        Label("Clear", systemImage: "xmark.circle")
                    }
                }
            }
            .swipeActions(edge: .trailing) {
                if entry != nil {
                    // Not role: .destructive — that makes List animate the row away, but the
                    // slot stays (it just becomes empty), so the row would vanish until reload.
                    Button {
                        Task { await viewModel.clearSlot(day: day, meal: meal) }
                    } label: {
                        Label("Clear", systemImage: "xmark.circle")
                    }
                    .tint(.red)
                }
            }
    }

    @ViewBuilder
    private func slotSheet(_ slot: SlotSelection) -> some View {
        if let viewModel {
            MealSlotSheet(
                viewModel: viewModel,
                day: slot.day,
                meal: slot.meal,
                onViewRecipe: { recipe in
                    editingSlot = nil
                    path.append(recipe)
                }
            )
        }
    }

    @ViewBuilder
    private func recipeDestination(_ recipe: Recipe) -> some View {
        if let recipeViewModel, let user = authViewModel.currentUser {
            RecipeDetailView(
                recipe: recipe,
                viewModel: recipeViewModel,
                userId: user.id,
                userEmail: user.email ?? ""
            )
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if let viewModel {
            if !viewModel.collaborators.isEmpty {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showShareSheet = true
                    } label: {
                        AvatarGroupView(collaborators: viewModel.collaborators, size: 28, color: .brandGreen)
                    }
                    .accessibilityLabel("Plan members")
                }
            }
            ToolbarItem(placement: .primaryAction) {
                planMenu(viewModel)
            }
        }
    }

    private func planMenu(_ viewModel: MealPlanViewModel) -> some View {
        Menu {
            Button {
                Task { await prepareAddToList(viewModel) }
            } label: {
                Label("Add Week to List", systemImage: "cart.badge.plus")
            }
            .disabled(viewModel.plannedRecipeEntries.isEmpty || isPreparingList)

            Button {
                showShareSheet = true
            } label: {
                Label(viewModel.isOwner ? "Share Plan" : "Plan Members", systemImage: "person.2")
            }

            Menu {
                ForEach(MealType.allCases) { meal in
                    Toggle(isOn: mealBinding(viewModel, meal)) {
                        Label(meal.label, systemImage: meal.systemImage)
                    }
                    .disabled(viewModel.enabledMeals == [meal])
                }
            } label: {
                Label("Meals Shown", systemImage: "slider.horizontal.3")
            }

            if viewModel.plans.count > 1 {
                Picker("Plan", selection: planBinding(viewModel)) {
                    ForEach(viewModel.plans) { plan in
                        Text(plan.ownerId == viewModel.userId ? "My Plan" : "Shared Plan").tag(Optional(plan.id))
                    }
                }
            }

            if !viewModel.isOwner {
                Divider()
                Button(role: .destructive) {
                    showLeaveConfirm = true
                } label: {
                    Label("Leave Plan", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        } label: {
            if isPreparingList {
                ProgressView()
            } else {
                Image(systemName: "ellipsis")
            }
        }
    }

    private func mealBinding(_ viewModel: MealPlanViewModel, _ meal: MealType) -> Binding<Bool> {
        Binding(
            get: { viewModel.enabledMeals.contains(meal) },
            set: { enabled in Task { await viewModel.setMeal(meal, enabled: enabled) } }
        )
    }

    private func planBinding(_ viewModel: MealPlanViewModel) -> Binding<UUID?> {
        Binding(
            get: { viewModel.activePlanId },
            set: { planId in
                guard let planId else { return }
                Task { await viewModel.selectPlan(planId) }
            }
        )
    }

    // MARK: - Actions

    private func prepareAddToList(_ viewModel: MealPlanViewModel) async {
        isPreparingList = true
        defer { isPreparingList = false }
        do {
            weekIngredients = try await viewModel.weekIngredients()
            if weekIngredients.isEmpty {
                viewModel.error = "The planned recipes have no ingredients yet."
            } else {
                showAddToList = true
            }
        } catch {
            viewModel.error = "Couldn't load this week's ingredients."
            print("[MealPlanView] Failed to load ingredients: \(error.localizedDescription)")
        }
    }

    private func initializeViewModelsIfNeeded() {
        guard let user = authViewModel.currentUser else { return }
        if viewModel == nil {
            viewModel = MealPlanViewModel(userId: user.id, userEmail: user.email ?? "")
        }
        if recipeViewModel == nil {
            recipeViewModel = RecipeViewModel(userId: user.id, userEmail: user.email ?? "")
        }
    }
}

// MARK: - Week Switcher

private struct WeekSwitcherView: View {
    let viewModel: MealPlanViewModel

    private var rangeText: String {
        guard let first = viewModel.days.first, let last = viewModel.days.last else { return "" }
        let start = first.formatted(.dateTime.month(.abbreviated).day())
        let end = last.formatted(.dateTime.month(.abbreviated).day())
        return "\(start) – \(end)"
    }

    var body: some View {
        HStack {
            Button {
                Task { await viewModel.goToWeek(offset: -1) }
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Previous week")

            Spacer()

            VStack(spacing: 2) {
                Text(rangeText)
                    .font(.quicksand(.headline, weight: .semibold))
                if viewModel.isCurrentWeek {
                    Text("This week")
                        .font(.quicksand(.caption))
                        .foregroundStyle(.secondary)
                } else {
                    Button("Back to this week") {
                        Task { await viewModel.goToCurrentWeek() }
                    }
                    .font(.quicksand(.caption, weight: .semibold))
                }
            }

            Spacer()

            Button {
                Task { await viewModel.goToWeek(offset: 1) }
            } label: {
                Image(systemName: "chevron.right")
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Next week")
        }
        .buttonStyle(.borderless)
        .tint(Color.brandGreen)
    }
}

// MARK: - Plan Bar

private struct PlanBarView: View {
    let viewModel: MealPlanViewModel

    var body: some View {
        HStack(spacing: 10) {
            Button {
                Task { await viewModel.planMyWeek() }
            } label: {
                HStack(spacing: 6) {
                    if viewModel.isPlanning {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "sparkles")
                    }
                    Text("Plan my week")
                }
                .font(.quicksand(.subheadline, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.brandGreen, in: Capsule())
            }
            .disabled(viewModel.isPlanning || viewModel.activePlan == nil)

            if viewModel.hasReplaceableSuggestions {
                Button {
                    Task { await viewModel.regenerate() }
                } label: {
                    Text("Regenerate")
                        .font(.quicksand(.subheadline, weight: .semibold))
                        .foregroundStyle(Color.brandGreen)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .overlay(Capsule().stroke(Color.brandGreen.opacity(0.5)))
                }
                .disabled(viewModel.isPlanning)
            }
            Spacer(minLength: 0)
        }
        .buttonStyle(.borderless)
    }
}

// MARK: - Day Header

private struct DayHeaderView: View {
    let day: Date

    private var isToday: Bool {
        Calendar.current.isDateInToday(day)
    }

    var body: some View {
        HStack(spacing: 6) {
            Text(day.formatted(.dateTime.weekday(.wide)))
                .font(.quicksand(.subheadline, weight: .bold))
                .foregroundStyle(isToday ? Color.brandGreen : Color.primary)
            Text(day.formatted(.dateTime.month(.abbreviated).day()))
                .font(.quicksand(.subheadline))
                .foregroundStyle(.secondary)
            if isToday {
                Text("Today")
                    .font(.quicksand(.caption2, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.brandGreen, in: Capsule())
            }
        }
        .textCase(nil)
    }
}

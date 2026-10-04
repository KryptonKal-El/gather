import SwiftUI

/// A pushed view showing full recipe details with ingredients, steps, and actions.
struct RecipeDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(NotificationService.self) private var notificationService

    let recipe: Recipe
    let viewModel: RecipeViewModel
    let userId: UUID
    let userEmail: String

    /// The recipe as it currently exists in the view model, so edits made this
    /// session (e.g. a newly added photo) are reflected here without a relaunch.
    /// Falls back to the value passed in at navigation time.
    private var liveRecipe: Recipe {
        viewModel.recipes.first(where: { $0.id == recipe.id })
            ?? viewModel.activeRecipeDetail?.recipe
            ?? recipe
    }
    
    @State private var checkedIngredients: Set<UUID> = []
    @State private var showEditSheet = false
    @State private var showDeleteConfirm = false
    @State private var showMoveSheet = false
    @State private var showAddToListSheet = false
    @State private var addAllToList = false
    @State private var editIngredients: [RecipeIngredient] = []
    @State private var editSteps: [RecipeStep] = []
    @State private var cookViewModel: CookSessionViewModel?
    @State private var showCookMode = false
    @State private var selectedTab: DetailTab = .ingredients

    /// The three sections of the recipe detail, shown one at a time under a sticky tab bar.
    private enum DetailTab: String, CaseIterable {
        case ingredients = "Ingredients"
        case steps = "Steps"
        case history = "Cook History"
    }

    var body: some View {
        Group {
            if viewModel.activeRecipeDetail == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                scrollContent
            }
        }
        .navigationTitle(liveRecipe.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        addAllToList = true
                        showAddToListSheet = true
                    } label: {
                        Label("Add to List", systemImage: "cart.badge.plus")
                    }
                    
                    if viewModel.canEditRecipe(recipe) {
                        Button {
                            Task {
                                await viewModel.selectRecipe(id: recipe.id)
                                if let detail = viewModel.activeRecipeDetail {
                                    editIngredients = detail.ingredients
                                    editSteps = detail.steps
                                }
                                showEditSheet = true
                            }
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }

                        // Moving can pull a recipe out of a shared collection,
                        // so it stays limited to the recipe's owner.
                        if recipe.ownerId == userId {
                            Button {
                                showMoveSheet = true
                            } label: {
                                Label("Move to Collection", systemImage: "folder")
                            }
                        }

                        Divider()

                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            RecipeFormSheet(
                viewModel: viewModel,
                editRecipe: liveRecipe,
                editIngredients: editIngredients,
                editSteps: editSteps
            )
        }
        .sheet(isPresented: $showMoveSheet) {
            moveToCollectionSheet
        }
        .sheet(isPresented: $showAddToListSheet) {
            AddToListSheet(
                ingredients: addAllToList ? allIngredientsData : checkedIngredientsData,
                userId: userId,
                userEmail: userEmail,
                onDismiss: {
                    checkedIngredients.removeAll()
                    addAllToList = false
                    showAddToListSheet = false
                }
            )
        }
        .confirmationDialog("Delete Recipe?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    await viewModel.deleteRecipe(id: recipe.id)
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .fullScreenCover(isPresented: $showCookMode, onDismiss: {
            Task { await cookViewModel?.loadState() }
        }) {
            if let cookViewModel {
                CookModeView(
                    recipe: recipe,
                    ingredients: viewModel.activeRecipeDetail?.ingredients ?? [],
                    cookViewModel: cookViewModel
                )
            }
        }
        .onAppear {
            if cookViewModel == nil {
                cookViewModel = CookSessionViewModel(recipeId: recipe.id, recipeName: recipe.name, userId: userId)
            }
            Task {
                await viewModel.selectRecipe(id: recipe.id)
                await cookViewModel?.loadState()
                resumeCookIfRequested()
            }
        }
        .onChange(of: notificationService.pendingCookRecipeId) { _, _ in
            resumeCookIfRequested()
        }
    }

    /// If the user arrived from tapping the cook Live Activity, reopen cook mode
    /// for this recipe's in-progress session so the ⋯ menu (Discard Cook) is at hand.
    private func resumeCookIfRequested() {
        guard notificationService.pendingCookRecipeId == recipe.id else { return }
        notificationService.pendingCookRecipeId = nil
        if cookViewModel?.activeSession != nil {
            showCookMode = true
        }
    }
    
    @ViewBuilder
    private var scrollContent: some View {
        ScrollView {
            // pinnedViews keeps the tab bar stuck to the top once the header
            // above it scrolls off (single-level pinning).
            LazyVStack(alignment: .leading, spacing: 16, pinnedViews: [.sectionHeaders]) {
                Group {
                    titleHeader

                    if let imageUrl = liveRecipe.imageUrl, let url = URL(string: imageUrl) {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Rectangle()
                                .fill(Color(.systemGray5))
                                .overlay {
                                    ProgressView()
                                }
                        }
                        .frame(maxWidth: .infinity, maxHeight: 250)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    if let description = liveRecipe.description, !description.isEmpty {
                        Text(description)
                            .font(.quicksand(.body))
                            .foregroundStyle(.secondary)
                    }

                    startCookingButton
                    metaRow
                    RecipeAttributesSection(recipe: recipe, canEdit: viewModel.canEditRecipe(recipe), userId: userId)
                }
                .padding(.horizontal, 16)

                Section {
                    tabContent
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                } header: {
                    tabBar
                }
            }
            .padding(.vertical, 16)
        }
    }

    /// Sticky three-tab selector. Full-width opaque background + bottom divider so
    /// content doesn't show through when it's pinned to the top.
    @ViewBuilder
    private var tabBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(DetailTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { selectedTab = tab }
                    } label: {
                        VStack(spacing: 6) {
                            Text(tab.rawValue)
                                .font(.quicksand(.subheadline, weight: selectedTab == tab ? .semibold : .regular))
                                .foregroundStyle(selectedTab == tab ? Color.brandGreen : .secondary)
                            Rectangle()
                                .fill(selectedTab == tab ? Color.brandGreen : Color.clear)
                                .frame(height: 2)
                        }
                        .frame(maxWidth: .infinity)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
            Divider()
        }
        .background(Color(.systemBackground))
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .ingredients: ingredientsTab
        case .steps: stepsTab
        case .history: cookHistoryTab
        }
    }

    /// The recipe title (one step smaller than the nav large title, wrapping to
    /// as many lines as needed so it's never truncated) with the source name as
    /// a subtext line directly beneath. The source name is a tappable link that
    /// opens in the default browser when a URL is set, otherwise plain text.
    @ViewBuilder
    private var titleHeader: some View {
        let source = liveRecipe.sourceName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let urlString = liveRecipe.sourceUrl?.trimmingCharacters(in: .whitespacesAndNewlines)
        let url = urlString.flatMap { $0.isEmpty ? nil : URL(string: $0) }

        VStack(alignment: .leading, spacing: 4) {
            Text(liveRecipe.name)
                .font(.quicksand(.title, weight: .bold))
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let source, !source.isEmpty {
                if let url {
                    Button {
                        openURL(url)
                    } label: {
                        Text(source)
                            .font(.quicksand(.subheadline, weight: .medium))
                            .foregroundStyle(Color.brandGreen)
                            .underline()
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .buttonStyle(.plain)
                } else {
                    Text(source)
                        .font(.quicksand(.subheadline))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The prep / cook / servings values joined into one line, or nil if none set.
    private var metaSummary: String? {
        let prep = liveRecipe.prepTime?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cook = liveRecipe.cookTime?.trimmingCharacters(in: .whitespacesAndNewlines)
        let servings = liveRecipe.servings

        var parts: [String] = []
        if let prep, !prep.isEmpty { parts.append("Prep \(prep)") }
        if let cook, !cook.isEmpty { parts.append("Cook \(cook)") }
        if let servings { parts.append("\(servings) serving\(servings == 1 ? "" : "s")") }
        return parts.isEmpty ? nil : parts.joined(separator: "  ·  ")
    }

    /// Subtle one-line metadata (prep / cook / servings) under the Start Cooking
    /// button. Only shown when at least one value exists, listing only those set.
    @ViewBuilder
    private var metaRow: some View {
        if let metaSummary {
            Text(metaSummary)
                .font(.quicksand(.caption))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var startCookingButton: some View {
        let hasActiveCook = cookViewModel?.activeSession != nil

        Button {
            if hasActiveCook {
                showCookMode = true
            } else {
                Task {
                    let steps = viewModel.activeRecipeDetail?.steps ?? []
                    if await cookViewModel?.startCook(steps: steps) == true {
                        showCookMode = true
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: hasActiveCook ? "arrow.clockwise" : "frying.pan")
                Text(hasActiveCook ? "Continue Cooking" : "Start Cooking")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(hasActiveCook ? Color.orange : Color.accentColor)
            .foregroundStyle(.white)
            .fontWeight(.semibold)
            .cornerRadius(12)
        }
    }

    /// Cook History tab: the completed cook sessions for this recipe (date, time,
    /// and duration), with an empty state before the recipe has been cooked.
    @ViewBuilder
    private var cookHistoryTab: some View {
        let history = cookViewModel?.history ?? []

        if history.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.quicksand(.title))
                    .foregroundStyle(.secondary)
                Text("No cooks yet")
                    .font(.quicksand(.subheadline, weight: .medium))
                    .foregroundStyle(.secondary)
                Text("Cook this recipe and it'll show up here.")
                    .font(.quicksand(.caption))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 40)
        } else {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(history) { session in
                    HStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .font(.quicksand(.title3))
                        VStack(alignment: .leading, spacing: 2) {
                            Text((session.completedAt ?? session.startedAt).formatted(date: .abbreviated, time: .shortened))
                                .font(.quicksand(.body))
                            Text(historyDuration(session))
                                .font(.quicksand(.caption))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(session.completedAt ?? session.startedAt, style: .relative)
                            .font(.quicksand(.caption))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func historyDuration(_ session: CookSession) -> String {
        let minutes = Int(session.duration / 60)
        if minutes < 1 { return "Under a minute" }
        if minutes < 60 { return "\(minutes) min" }
        let hours = minutes / 60
        let remainder = minutes % 60
        return remainder == 0 ? "\(hours) hr" : "\(hours) hr \(remainder) min"
    }
    
    @ViewBuilder
    private var ingredientsTab: some View {
        let ingredients = viewModel.activeRecipeDetail?.ingredients ?? []

        VStack(alignment: .leading, spacing: 12) {
            ForEach(ingredients) { ingredient in
                HStack(spacing: 12) {
                    Button {
                        toggleIngredient(ingredient.id)
                    } label: {
                        Image(systemName: checkedIngredients.contains(ingredient.id) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(checkedIngredients.contains(ingredient.id) ? .green : .secondary)
                            .font(.quicksand(.title3))
                    }
                    .buttonStyle(.plain)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ingredient.name)
                            .strikethrough(checkedIngredients.contains(ingredient.id))
                            .foregroundStyle(checkedIngredients.contains(ingredient.id) ? .secondary : .primary)
                        if let qty = ingredient.quantity, !qty.isEmpty {
                            Text(qty)
                                .font(.quicksand(.caption))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            
            addToListButton
        }
    }
    
    @ViewBuilder
    private var addToListButton: some View {
        let checkedCount = checkedIngredients.count
        
        Button {
            showAddToListSheet = true
        } label: {
            Text(checkedCount > 0 ? "Add \(checkedCount) to List" : "Select ingredients to add")
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(checkedCount > 0 ? Color.accentColor : Color(.systemGray4))
                .foregroundStyle(.white)
                .fontWeight(.semibold)
                .cornerRadius(12)
        }
        .disabled(checkedCount == 0)
        .padding(.top, 8)
    }
    
    @ViewBuilder
    private var stepsTab: some View {
        let steps = viewModel.activeRecipeDetail?.steps ?? []

        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(.quicksand(.caption))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.accentColor)
                        .clipShape(Circle())
                    
                    Text(step.instruction)
                        .font(.quicksand(.body))
                }
            }
        }
    }
    
    @ViewBuilder
    private var moveToCollectionSheet: some View {
        NavigationStack {
            List {
                ForEach(viewModel.collections.filter { $0.id != recipe.collectionId }) { targetCollection in
                    Button {
                        Task {
                            await viewModel.moveRecipe(recipeId: recipe.id, toCollectionId: targetCollection.id)
                            showMoveSheet = false
                        }
                    } label: {
                        HStack(spacing: 12) {
                            Text((targetCollection.emoji?.containsVisualEmoji == true ? targetCollection.emoji : nil) ?? "📁")
                                .font(.quicksand(.title2))
                            Text(targetCollection.name)
                                .font(.quicksand(.body))
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle("Move to Collection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showMoveSheet = false
                    }
                }
            }
        }
    }
    
    private var checkedIngredientsData: [(name: String, quantity: String?, amount: Double?, unit: String?)] {
        guard let ingredients = viewModel.activeRecipeDetail?.ingredients else { return [] }
        return ingredients
            .filter { checkedIngredients.contains($0.id) }
            .map { (name: $0.name, quantity: $0.quantity, amount: nil, unit: nil) }
    }
    
    private var allIngredientsData: [(name: String, quantity: String?, amount: Double?, unit: String?)] {
        guard let ingredients = viewModel.activeRecipeDetail?.ingredients else { return [] }
        return ingredients.map { (name: $0.name, quantity: $0.quantity, amount: nil, unit: nil) }
    }
    
    private func toggleIngredient(_ id: UUID) {
        if checkedIngredients.contains(id) {
            checkedIngredients.remove(id)
        } else {
            checkedIngredients.insert(id)
        }
    }
}

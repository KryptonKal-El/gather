import SwiftUI

/// Lists the plan's eat-out deals (e.g. "kids eat free on Tuesdays") and lets members add,
/// edit, switch off and delete them.
struct EatOutDealsSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: MealPlanViewModel

    @State private var editing: DealEditorTarget?

    var body: some View {
        NavigationStack {
            List {
                if viewModel.deals.isEmpty {
                    ContentUnavailableView {
                        Label("No eat-out deals yet", systemImage: "tag")
                    } description: {
                        Text("Add restaurants with deals on certain days, like kids eat free on Tuesdays. Matching meals on your plan will show the deal.")
                    } actions: {
                        Button("Add a Deal") { editing = .new }
                            .font(.quicksand(.body, weight: .semibold))
                            .tint(Color.brandGreen)
                    }
                } else {
                    Section {
                        ForEach(viewModel.deals) { deal in
                            Button {
                                editing = .existing(deal)
                            } label: {
                                DealRow(deal: deal)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing) {
                                Button {
                                    Task { await viewModel.deleteDeal(deal) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                .tint(.red)
                            }
                        }
                    } footer: {
                        Text("Everyone on this plan sees these deals.")
                            .font(.quicksand(.caption))
                    }
                }
            }
            .navigationTitle("Eat-out Deals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                if !viewModel.deals.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            editing = .new
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("Add Deal")
                    }
                }
            }
            .sheet(item: $editing) { target in
                DealEditor(viewModel: viewModel, existing: target.deal)
            }
        }
    }
}

private enum DealEditorTarget: Identifiable {
    case new
    case existing(MealPlanDeal)

    var id: String {
        switch self {
        case .new: return "new"
        case .existing(let deal): return deal.id.uuidString
        }
    }

    var deal: MealPlanDeal? {
        if case .existing(let deal) = self { return deal }
        return nil
    }
}

// MARK: - Row

private struct DealRow: View {
    let deal: MealPlanDeal

    /// Deals change often, so flag ones nobody has confirmed in about three months.
    private var needsCheck: Bool {
        guard let key = deal.lastCheckedOn else { return true }
        return MealPlanner.daysBetween(key, MealPlanWeek.key(for: Date())) > 90
    }

    private var mealsText: String {
        deal.mealTypes.map(\.label).joined(separator: ", ")
    }

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.dealOrange.opacity(deal.isActive ? 0.15 : 0.06))
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: "tag.fill")
                        .foregroundStyle(deal.isActive ? Color.dealOrange : Color.secondary)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(deal.restaurant)
                    .font(.quicksand(.body, weight: .semibold))
                    .foregroundStyle(Color.primary)
                if let details = deal.details, !details.isEmpty {
                    Text(details)
                        .font(.quicksand(.subheadline))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Text("\(deal.weekdaysText) · \(mealsText)")
                    .font(.quicksand(.caption))
                    .foregroundStyle(.secondary)
                if !deal.isActive {
                    Text("Switched off")
                        .font(.quicksand(.caption, weight: .semibold))
                        .foregroundStyle(.secondary)
                } else if needsCheck {
                    Label("Check it's still running", systemImage: "clock.arrow.circlepath")
                        .font(.quicksand(.caption))
                        .foregroundStyle(Color.dealOrange)
                }
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }
}

// MARK: - Editor

private struct DealEditor: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: MealPlanViewModel
    let existing: MealPlanDeal?

    @State private var restaurant = ""
    @State private var details = "Kids eat free"
    @State private var address = ""
    @State private var weekdays: Set<Int> = []
    @State private var meals: Set<MealType> = [.dinner]
    @State private var isActive = true
    @State private var lastCheckedOn: String?
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var showDeleteConfirm = false
    @State private var didLoad = false

    private static let weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    private var trimmedRestaurant: String {
        restaurant.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSave: Bool {
        !trimmedRestaurant.isEmpty && !weekdays.isEmpty && !meals.isEmpty && !isSaving
    }

    private var lastCheckedText: String {
        guard let key = lastCheckedOn, let date = MealPlanWeek.date(fromKey: key) else { return "Never" }
        if Calendar.current.isDateInToday(date) { return "Today" }
        return date.formatted(.dateTime.month(.abbreviated).day().year())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Restaurant") {
                    TextField("e.g. Chili's", text: $restaurant)
                        .textInputAutocapitalization(.words)
                    TextField("Address (optional)", text: $address)
                }

                Section {
                    TextField("e.g. Kids eat free", text: $details, axis: .vertical)
                        .lineLimit(1...3)
                } header: {
                    Text("Deal")
                } footer: {
                    Text("Shown on your plan, e.g. \"Kids eat free at Chili's\".")
                }

                Section("Days") {
                    ForEach(Self.weekdayNames.indices, id: \.self) { index in
                        Toggle(Self.weekdayNames[index], isOn: weekdayBinding(index))
                    }
                }

                Section("Meals") {
                    ForEach(MealType.allCases) { meal in
                        Toggle(isOn: mealBinding(meal)) {
                            Label(meal.label, systemImage: meal.systemImage)
                        }
                    }
                }

                Section {
                    Toggle("Deal is on", isOn: $isActive)
                    HStack {
                        Text("Last checked")
                        Spacer()
                        Text(lastCheckedText)
                            .foregroundStyle(.secondary)
                    }
                    Button("Checked It Today") {
                        lastCheckedOn = MealPlanWeek.key(for: Date())
                    }
                    .foregroundStyle(Color.brandGreen)
                } footer: {
                    Text("Deals change often. Switch one off rather than deleting it if it might come back.")
                }

                if let saveError {
                    Section {
                        Label(saveError, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                }

                if existing != nil {
                    Section {
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete Deal", systemImage: "trash")
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
            .navigationTitle(existing == nil ? "New Deal" : "Edit Deal")
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
                    .disabled(!canSave)
                }
            }
            .confirmationDialog("Delete this deal?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    guard let existing else { return }
                    Task {
                        await viewModel.deleteDeal(existing)
                        dismiss()
                    }
                }
            } message: {
                Text("It will be removed for everyone on this plan.")
            }
            .onAppear(perform: loadExisting)
        }
    }

    private func weekdayBinding(_ index: Int) -> Binding<Bool> {
        Binding(
            get: { weekdays.contains(index) },
            set: { isOn in
                if isOn { weekdays.insert(index) } else { weekdays.remove(index) }
            }
        )
    }

    private func mealBinding(_ meal: MealType) -> Binding<Bool> {
        Binding(
            get: { meals.contains(meal) },
            set: { isOn in
                if isOn { meals.insert(meal) } else { meals.remove(meal) }
            }
        )
    }

    private func loadExisting() {
        guard !didLoad else { return }
        didLoad = true
        guard let existing else {
            lastCheckedOn = MealPlanWeek.key(for: Date())
            return
        }
        restaurant = existing.restaurant
        details = existing.details ?? ""
        address = existing.address ?? ""
        weekdays = Set(existing.weekdays)
        meals = Set(existing.mealTypes)
        isActive = existing.isActive
        lastCheckedOn = existing.lastCheckedOn
    }

    private func save() async {
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        let trimmedDetails = details.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedAddress = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let draft = MealPlanDealDraft(
            restaurant: trimmedRestaurant,
            details: trimmedDetails.isEmpty ? nil : trimmedDetails,
            address: trimmedAddress.isEmpty ? nil : trimmedAddress,
            weekdays: weekdays,
            meals: meals,
            isActive: isActive,
            lastCheckedOn: lastCheckedOn
        )
        do {
            try await viewModel.saveDeal(draft, existing: existing)
            dismiss()
        } catch {
            saveError = "Couldn't save this deal. Try again."
            print("[DealEditor] Failed to save deal: \(error.localizedDescription)")
        }
    }
}

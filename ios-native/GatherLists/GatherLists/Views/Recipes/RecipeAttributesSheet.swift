import SwiftUI

/// Editor for a recipe's planner details. Any field the person changes is recorded as set by
/// hand, so automatic tagging never overwrites it.
struct RecipeAttributesSheet: View {
    @Environment(\.dismiss) private var dismiss

    let recipeName: String
    let original: RecipeAttributes
    var onSave: (RecipeAttributes) async -> Bool

    @State private var draft: RecipeAttributes
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(recipeName: String, attributes: RecipeAttributes, onSave: @escaping (RecipeAttributes) async -> Bool) {
        self.recipeName = recipeName
        self.original = attributes
        self.onSave = onSave
        _draft = State(initialValue: attributes)
    }

    var body: some View {
        NavigationStack {
            Form {
                mealsSection
                Section("Dish") {
                    optionPicker("Course", RecipeCourse.self, value: $draft.course)
                    optionPicker("Main protein", RecipeProtein.self, value: $draft.protein)
                    optionPicker("Cuisine", RecipeCuisine.self, value: $draft.cuisine)
                }
                Section("Cooking") {
                    optionPicker("Effort", RecipeEffort.self, value: $draft.effort)
                    optionPicker("Method", RecipeMethod.self, value: $draft.method)
                    Picker("Kid-friendly", selection: $draft.kidFriendly) {
                        Text("Not set").tag(Bool?.none)
                        Text("Yes").tag(Bool?.some(true))
                        Text("No").tag(Bool?.some(false))
                    }
                }
                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                }
            }
            .navigationTitle(recipeName)
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
                    .disabled(isSaving || draft == original)
                }
            }
        }
    }

    private var mealsSection: some View {
        Section {
            ForEach(MealType.allCases) { meal in
                Toggle(isOn: mealBinding(meal)) {
                    Label(meal.label, systemImage: meal.systemImage)
                }
                .tint(Color.brandGreen)
            }
        } header: {
            Text("Good for")
        } footer: {
            Text("The Plan tab only suggests this recipe for the meals turned on here.")
        }
    }

    private func mealBinding(_ meal: MealType) -> Binding<Bool> {
        Binding(
            get: { draft.mealTypes.contains(meal.rawValue) },
            set: { isOn in
                var meals = Set(draft.mealTypes)
                if isOn { meals.insert(meal.rawValue) } else { meals.remove(meal.rawValue) }
                draft.mealTypes = MealType.allCases.map(\.rawValue).filter(meals.contains)
            }
        )
    }

    private func optionPicker<Option: RecipeAttributeOption>(
        _ title: String,
        _ type: Option.Type,
        value: Binding<String?>
    ) -> some View {
        Picker(title, selection: value) {
            Text("Not set").tag(String?.none)
            ForEach(Array(Option.allCases)) { option in
                Text(option.label).tag(String?.some(option.rawValue))
            }
        }
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        var updated = draft
        var manual = Set(original.manualFields)
        if draft.course != original.course { manual.insert(RecipeAttributes.Field.course.rawValue) }
        if draft.mealTypes != original.mealTypes { manual.insert(RecipeAttributes.Field.mealTypes.rawValue) }
        if draft.protein != original.protein { manual.insert(RecipeAttributes.Field.protein.rawValue) }
        if draft.cuisine != original.cuisine { manual.insert(RecipeAttributes.Field.cuisine.rawValue) }
        if draft.effort != original.effort { manual.insert(RecipeAttributes.Field.effort.rawValue) }
        if draft.method != original.method { manual.insert(RecipeAttributes.Field.method.rawValue) }
        if draft.kidFriendly != original.kidFriendly { manual.insert(RecipeAttributes.Field.kidFriendly.rawValue) }
        updated.manualFields = RecipeAttributes.Field.allCases.map(\.rawValue).filter(manual.contains)

        if await onSave(updated) {
            dismiss()
        } else {
            errorMessage = "Couldn't save. Try again."
        }
        isSaving = false
    }
}

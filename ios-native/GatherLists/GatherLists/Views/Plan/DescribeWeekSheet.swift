import SwiftUI

/// Lets the household describe their week in plain words, shows what the on-device model
/// understood (each item can be switched off), then plans the week with it.
struct DescribeWeekSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: MealPlanViewModel

    @State private var note = ""
    @State private var brief: WeekBrief?
    @State private var isReading = false
    @State private var errorMessage: String?
    @FocusState private var isNoteFocused: Bool

    private var trimmedNote: String {
        note.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                noteSection
                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                }
                if let brief {
                    understoodSections(brief)
                }
            }
            .navigationTitle("Describe Your Week")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await plan() }
                    } label: {
                        Text("Plan").fontWeight(.semibold)
                    }
                    .disabled(brief == nil || isReading || viewModel.isPlanning)
                }
            }
            .onAppear { isNoteFocused = true }
        }
    }

    private var noteSection: some View {
        Section {
            TextField(
                "e.g. Light week. Soccer Wednesday so something quick, use up the spinach, eating out Friday.",
                text: $note,
                axis: .vertical
            )
            .lineLimit(3...6)
            .focused($isNoteFocused)
            .onChange(of: note) { _, _ in brief = nil }

            Button {
                Task { await read() }
            } label: {
                HStack {
                    if isReading {
                        ProgressView()
                    } else {
                        Image(systemName: "sparkles")
                    }
                    Text(brief == nil ? "Read my note" : "Read it again")
                }
                .foregroundStyle(Color.brandGreen)
            }
            .buttonStyle(.plain)
            .disabled(trimmedNote.isEmpty || isReading)
        } footer: {
            Text("Read on this iPhone — your note isn't sent anywhere.")
        }
    }

    @ViewBuilder
    private func understoodSections(_ current: WeekBrief) -> some View {
        if current.isEmpty {
            Section {
                Text("Nothing in the note changes the plan. Try mentioning days, ingredients or cuisines.")
                    .foregroundStyle(.secondary)
            }
        } else {
            Section {
                ForEach(current.dayNotes.indices, id: \.self) { index in
                    Toggle(dayNoteText(current.dayNotes[index]), isOn: dayNoteBinding(index))
                }
                ForEach(current.useUp.indices, id: \.self) { index in
                    Toggle("Use up \(current.useUp[index].text)", isOn: termBinding(\.useUp, index))
                }
                ForEach(current.avoid.indices, id: \.self) { index in
                    Toggle("Avoid \(current.avoid[index].text)", isOn: termBinding(\.avoid, index))
                }
                ForEach(current.cuisines.indices, id: \.self) { index in
                    Toggle("In the mood for \(current.cuisines[index].text)", isOn: termBinding(\.cuisines, index))
                }
                if current.lightWeek {
                    Toggle("Keep the whole week light and quick", isOn: lightWeekBinding)
                }
            } header: {
                Text("What I understood")
            } footer: {
                Text("Turn off anything that's wrong, then tap Plan. Meals you've already planned stay as they are.")
            }
            .tint(Color.brandGreen)
        }
    }

    private func dayNoteText(_ dayNote: WeekBrief.DayNote) -> String {
        let day = WeekBriefService.weekdayNames[dayNote.weekday].capitalized
        let meal = dayNote.meal?.label.lowercased() ?? "all day"
        return "\(day) \(meal): \(dayNote.plan.label)"
    }

    private func dayNoteBinding(_ index: Int) -> Binding<Bool> {
        Binding(
            get: { brief?.dayNotes[index].isOn ?? false },
            set: { brief?.dayNotes[index].isOn = $0 }
        )
    }

    private func termBinding(_ keyPath: WritableKeyPath<WeekBrief, [WeekBrief.Term]>, _ index: Int) -> Binding<Bool> {
        Binding(
            get: { brief?[keyPath: keyPath][index].isOn ?? false },
            set: { brief?[keyPath: keyPath][index].isOn = $0 }
        )
    }

    private var lightWeekBinding: Binding<Bool> {
        Binding(
            get: { brief?.lightWeek ?? false },
            set: { brief?.lightWeek = $0 }
        )
    }

    private func read() async {
        isNoteFocused = false
        isReading = true
        errorMessage = nil
        defer { isReading = false }
        if let result = await WeekBriefService.read(note: trimmedNote) {
            brief = result
        } else {
            errorMessage = "Couldn't read that note. Try rephrasing it."
        }
    }

    private func plan() async {
        guard let brief else { return }
        await viewModel.planMyWeek(brief: brief, note: trimmedNote)
        if viewModel.error == nil {
            dismiss()
        } else {
            errorMessage = viewModel.error
        }
    }
}

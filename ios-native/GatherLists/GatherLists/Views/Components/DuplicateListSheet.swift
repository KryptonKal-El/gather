import SwiftUI

struct DuplicateListSheet: View {
    let list: GatherList
    let onDuplicate: (String, Bool) -> Void
    let onCancel: () -> Void

    @State private var name: String
    @State private var resetRsvp = false
    @FocusState private var nameFocused: Bool

    init(list: GatherList, onDuplicate: @escaping (String, Bool) -> Void, onCancel: @escaping () -> Void) {
        self.list = list
        self.onDuplicate = onDuplicate
        self.onCancel = onCancel
        _name = State(initialValue: "\(list.name) (2)")
    }

    private var isGuestList: Bool {
        list.type == "guest_list"
    }

    private var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("List name", text: $name)
                        .textInputAutocapitalization(.words)
                        .focused($nameFocused)
                }

                if isGuestList {
                    Section {
                        Toggle("Reset RSVP statuses", isOn: $resetRsvp)
                    } footer: {
                        Text("Mark all guests as Not Yet Invited in the new list")
                    }
                }
            }
            .navigationTitle("Duplicate List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        onCancel()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Duplicate") {
                        onDuplicate(trimmedName, isGuestList ? resetRsvp : false)
                    }
                    .fontWeight(.semibold)
                    .disabled(trimmedName.isEmpty)
                }
            }
        }
        .tint(Color.brandGreen)
        .presentationDetents([.medium])
        .presentationBackground(Color(.systemGroupedBackground))
        .task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            nameFocused = true
        }
    }
}

#Preview {
    DuplicateListSheet(
        list: GatherList(ownerId: UUID(), name: "Guests", type: "guest_list"),
        onDuplicate: { _, _ in },
        onCancel: {}
    )
}

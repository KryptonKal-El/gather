import SwiftUI

/// Displays the completion history for a recurring item.
struct CompletionHistorySheet: View {
    let listId: UUID
    let itemName: String
    @Environment(\.dismiss) private var dismiss
    @State private var history: [Item] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading history...")
                } else if let error = errorMessage {
                    ContentUnavailableView("Error", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if history.isEmpty {
                    ContentUnavailableView("No Completions", systemImage: "checkmark.circle", description: Text("No completion history yet"))
                } else {
                    List(history) { item in
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            VStack(alignment: .leading, spacing: 2) {
                                if let dueDate = item.dueDate {
                                    Text("Due: \(dueDate, format: .dateTime.month().day().year())")
                                        .font(.subheadline)
                                }
                                if let checkedAt = item.checkedAt {
                                    Text("Completed: \(checkedAt, format: .dateTime.month().day().year())")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Completion History")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await loadHistory()
            }
        }
    }

    private func loadHistory() async {
        do {
            history = try await ItemService.fetchCompletionHistory(listId: listId, itemName: itemName)
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

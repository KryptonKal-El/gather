import SwiftUI

/// Sheet for editing a store's name and color.
struct EditStoreSheet: View {
    let store: Store
    let viewModel: StoreViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Text("Edit Store — Coming Soon")
                .navigationTitle("Edit Store")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
    }
}

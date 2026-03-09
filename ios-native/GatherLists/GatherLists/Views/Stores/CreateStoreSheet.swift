import SwiftUI

/// Sheet for creating a new store.
struct CreateStoreSheet: View {
    let viewModel: StoreViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Text("Create Store — Coming Soon")
                .navigationTitle("New Store")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
    }
}

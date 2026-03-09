import SwiftUI

/// Editor for a store's categories.
struct CategoryEditorView: View {
    let store: Store
    let viewModel: StoreViewModel
    
    var body: some View {
        Text("Category Editor — Coming Soon")
            .navigationTitle("\(store.name) Categories")
    }
}

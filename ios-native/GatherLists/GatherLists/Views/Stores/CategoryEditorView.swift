import SwiftUI

// DEPRECATED: Store-level categories removed in US-006.
// Categories now resolve at the list level via CategoryService.
struct CategoryEditorView: View {
    let store: Store
    let viewModel: StoreViewModel
    
    var body: some View {
        Text("Categories are now managed at the list level.")
            .foregroundStyle(.secondary)
    }
}

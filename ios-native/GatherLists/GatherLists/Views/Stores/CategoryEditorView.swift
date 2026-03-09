import SwiftUI

/// Editor for a store's categories.
struct CategoryEditorView: View {
    let store: Store
    let viewModel: StoreViewModel
    
    @State private var categories: [CategoryDef]
    @State private var showAddAlert = false
    @State private var newCategoryName = ""
    @State private var categoryToDelete: CategoryDef?
    @State private var showDeleteConfirm = false
    @State private var showReplaceConfirm = false
    @State private var pendingCopySource: [CategoryDef]?
    @State private var replaceAlertMessage = ""
    
    private let categoryPresetColors = [
        "#4caf50", "#2196f3", "#e53935", "#ff9800", "#00bcd4",
        "#795548", "#9c27b0", "#ffc107", "#ff5722", "#607d8b",
        "#e91e63", "#9e9e9e", "#1565c0", "#6a1b9a", "#00838f",
        "#2e7d32", "#ef6c00", "#4527a0"
    ]
    
    init(store: Store, viewModel: StoreViewModel) {
        self.store = store
        self.viewModel = viewModel
        _categories = State(initialValue: store.categories)
    }
    
    var body: some View {
        Group {
            if categories.isEmpty {
                emptyStateView
            } else {
                categoryList
            }
        }
        .navigationTitle("\(store.name) Categories")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                if !categories.isEmpty {
                    EditButton()
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddAlert = true
                } label: {
                    Image(systemName: "plus")
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Menu {
                    Button {
                        copyCategories(from: CategoryDefinitions.defaults, sourceLabel: "defaults")
                    } label: {
                        Label("Copy Default Categories", systemImage: "arrow.down.doc")
                    }
                    
                    if !otherStores.isEmpty {
                        Menu("Copy from Store...") {
                            ForEach(otherStores) { otherStore in
                                Button {
                                    copyCategories(from: otherStore.categories, sourceLabel: "categories from \(otherStore.name)")
                                } label: {
                                    Label("\(otherStore.name) (\(otherStore.categories.count))", systemImage: "storefront")
                                }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .alert("New Category", isPresented: $showAddAlert) {
            TextField("Category name", text: $newCategoryName)
            Button("Cancel", role: .cancel) { newCategoryName = "" }
            Button("Add") { addCategory() }
        } message: {
            Text("Enter a name for the new category.")
        }
        .alert("Delete Category?", isPresented: $showDeleteConfirm, presenting: categoryToDelete) { cat in
            Button("Delete", role: .destructive) {
                deleteCategory(cat)
            }
            Button("Cancel", role: .cancel) {}
        } message: { cat in
            Text("Delete \"\(cat.name)\"?")
        }
        .alert("Replace Categories?", isPresented: $showReplaceConfirm) {
            Button("Replace", role: .destructive) {
                if let source = pendingCopySource {
                    categories = source
                    Task { await viewModel.updateCategories(store.id, categories: categories) }
                }
            }
            Button("Cancel", role: .cancel) {
                pendingCopySource = nil
            }
        } message: {
            Text(replaceAlertMessage)
        }
    }
    
    private var categoryList: some View {
        List {
            ForEach(Array(categories.enumerated()), id: \.element.key) { index, cat in
                NavigationLink {
                    CategoryDetailView(
                        categoryIndex: index,
                        categories: $categories,
                        storeId: store.id,
                        viewModel: viewModel
                    )
                } label: {
                    categoryRow(cat)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        categoryToDelete = cat
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
            .onMove { source, destination in
                categories.move(fromOffsets: source, toOffset: destination)
                Task {
                    await viewModel.updateCategories(store.id, categories: categories)
                }
            }
        }
        .listStyle(.insetGrouped)
    }
    
    private func categoryRow(_ cat: CategoryDef) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: cat.color))
                .frame(width: 12, height: 12)
            
            Text(cat.name)
                .font(.body)
            
            Spacer()
            
            Text("\(cat.keywords.count) keywords")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "folder.badge.questionmark")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No categories")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Add categories or copy from defaults.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
    
    private func addCategory() {
        let trimmedName = newCategoryName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            newCategoryName = ""
            return
        }
        
        let newCategory = CategoryDef(
            key: "custom_\(Int(Date().timeIntervalSince1970))",
            name: trimmedName,
            color: categoryPresetColors[categories.count % categoryPresetColors.count],
            keywords: []
        )
        
        categories.append(newCategory)
        newCategoryName = ""
        
        Task {
            await viewModel.updateCategories(store.id, categories: categories)
        }
    }
    
    private func deleteCategory(_ cat: CategoryDef) {
        categories.removeAll { $0.key == cat.key }
        
        Task {
            await viewModel.updateCategories(store.id, categories: categories)
        }
    }
    
    private var otherStores: [Store] {
        viewModel.stores.filter { $0.id != store.id }
    }
    
    private func copyCategories(from source: [CategoryDef], sourceLabel: String) {
        if categories.isEmpty {
            categories = source
            Task { await viewModel.updateCategories(store.id, categories: categories) }
        } else {
            pendingCopySource = source
            replaceAlertMessage = "Replace \(categories.count) existing categories with \(sourceLabel)?"
            showReplaceConfirm = true
        }
    }
}

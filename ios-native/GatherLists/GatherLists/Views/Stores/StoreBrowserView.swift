import SwiftUI

/// Browse all stores with search, edit mode for reorder, and CRUD actions.
struct StoreBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.dismiss) private var dismiss
    let listId: UUID
    @State private var viewModel: StoreViewModel
    @State private var showCreateSheet = false
    @State private var storeToEdit: Store?
    @State private var storeToDelete: Store?
    @State private var showDeleteConfirm = false
    
    init(listId: UUID) {
        self.listId = listId
        _viewModel = State(initialValue: StoreViewModel(listId: listId))
    }
    
    private var filteredStores: [Store] {
        guard !searchQuery.isEmpty else { return viewModel.stores }
        let query = searchQuery.lowercased()
        return viewModel.stores.filter { $0.name.lowercased().contains(query) }
    }
    
    @State private var searchQuery = ""
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.stores.isEmpty {
                    loadingView
                } else if viewModel.stores.isEmpty {
                    emptyStateView
                } else {
                    storeListContent
                }
            }
            .navigationTitle("Stores")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .foregroundStyle(Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255))
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                CreateStoreSheet(viewModel: viewModel)
            }
            .sheet(item: $storeToEdit) { store in
                EditStoreSheet(store: store, viewModel: viewModel)
            }
            .alert("Delete Store?", isPresented: $showDeleteConfirm, presenting: storeToDelete) { store in
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.deleteStore(store.id)
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: { store in
                Text("Delete \"\(store.name)\"? Items assigned to this store will become unassigned.")
            }
        }
        .tint(brandGreen)
        .background(Color(.systemGroupedBackground))
        .task {
            await viewModel.start()
        }
    }
    
    @ViewBuilder
    private var storeListContent: some View {
        List {
            if viewModel.isShowingCachedData {
                CachedDataBanner(cachedAt: viewModel.cachedAt)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
            }

            Section {
                ForEach(filteredStores) { store in
                    Button {
                        storeToEdit = store
                    } label: {
                        storeRow(store)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button {
                            storeToEdit = store
                        } label: {
                            Label("Edit Name & Color", systemImage: "pencil")
                        }

                        Divider()

                        Button(role: .destructive) {
                            storeToDelete = store
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            storeToDelete = store
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        .tint(.red)
                    }
                }
                .onMove { source, destination in
                    viewModel.moveStore(from: source, to: destination)
                }
            } footer: {
                Text("Swipe to delete. Press and hold to reorder.")
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await viewModel.refresh()
        }
        .searchable(text: $searchQuery, prompt: "Search stores")
    }
    
    private func storeRow(_ store: Store) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: store.color ?? "#1565c0"))
                .frame(width: 12, height: 12)
            
            Text(store.name)
                .font(.body)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Loading stores...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "storefront")
                .font(.system(size: 48))
                .foregroundStyle(Color(.secondaryLabel))
            
            Text("No stores yet")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(Color(.secondaryLabel))
            
            Text("Add a store to organize items by where you shop.")
                .font(.subheadline)
                .foregroundStyle(Color(.tertiaryLabel))
                .multilineTextAlignment(.center)
            
            Button {
                showCreateSheet = true
            } label: {
                Label("Add Store", systemImage: "plus")
                    .fontWeight(.medium)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .padding()
    }
}


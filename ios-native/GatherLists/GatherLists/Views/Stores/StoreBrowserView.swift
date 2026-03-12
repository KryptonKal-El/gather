import SwiftUI

/// Browse all stores with search, edit mode for reorder, and CRUD actions.
struct StoreBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel: StoreViewModel?
    @State private var showCreateSheet = false
    @State private var storeToEdit: Store?
    @State private var storeToDelete: Store?
    @State private var showDeleteConfirm = false
    
    private var filteredStores: [Store] {
        guard let vm = viewModel else { return [] }
        guard !searchQuery.isEmpty else { return vm.stores }
        let query = searchQuery.lowercased()
        return vm.stores.filter { $0.name.lowercased().contains(query) }
    }
    
    @State private var searchQuery = ""
    
    var body: some View {
        NavigationStack {
            Group {
                if let vm = viewModel {
                    if vm.isLoading && vm.stores.isEmpty {
                        loadingView
                    } else if vm.stores.isEmpty {
                        emptyStateView
                    } else {
                        storeListContent(vm: vm)
                    }
                } else {
                    loadingView
                }
            }
            .navigationTitle("Stores")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if let vm = viewModel, !vm.stores.isEmpty {
                        EditButton()
                    }
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
                if let vm = viewModel {
                    CreateStoreSheet(viewModel: vm)
                }
            }
            .sheet(item: $storeToEdit) { store in
                if let vm = viewModel {
                    EditStoreSheet(store: store, viewModel: vm)
                }
            }
            .alert("Delete Store?", isPresented: $showDeleteConfirm, presenting: storeToDelete) { store in
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel?.deleteStore(store.id)
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: { store in
                Text("Delete \"\(store.name)\"? Items assigned to this store will become unassigned.")
            }
        }
        .onAppear {
            initializeViewModelIfNeeded()
        }
    }
    
    @ViewBuilder
    private func storeListContent(vm: StoreViewModel) -> some View {
        List {
            if vm.isShowingCachedData {
                CachedDataBanner(cachedAt: vm.cachedAt)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
            }
            
            ForEach(filteredStores) { store in
                NavigationLink(value: store) {
                    storeRow(store)
                }
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
                }
            }
            .onMove { source, destination in
                vm.moveStore(from: source, to: destination)
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await vm.refresh()
        }
        .searchable(text: $searchQuery, prompt: "Search stores")
        .navigationDestination(for: Store.self) { store in
            if let vm = viewModel {
                CategoryEditorView(store: store, viewModel: vm)
            }
        }
    }
    
    private func storeRow(_ store: Store) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: store.color ?? "#1565c0"))
                .frame(width: 12, height: 12)
            
            Text(store.name)
                .font(.body)
            
            Spacer()
            
            Text("\(store.categories.count) categories")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
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
                .foregroundStyle(.secondary)
            
            Text("No stores yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Add a store to organize items by where you shop.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
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
    
    private func initializeViewModelIfNeeded() {
        guard viewModel == nil else { return }
        guard let user = authViewModel.currentUser else { return }
        viewModel = StoreViewModel(userId: user.id)
    }
}

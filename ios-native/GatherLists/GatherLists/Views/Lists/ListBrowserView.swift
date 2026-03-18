import SwiftUI

/// Browse all lists (owned and shared) in a unified list with search.
struct ListBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel: ListViewModel?
    @State private var showCreateSheet = false
    @State private var listToEdit: GatherList?
    @State private var listToDelete: GatherList?
    @State private var listToShare: GatherList?
    @State private var showDeleteConfirm = false
    @State private var navigationPath = NavigationPath()
    
    private var allFiltered: [GatherList] {
        guard let vm = viewModel else { return [] }
        guard !vm.searchQuery.isEmpty else { return vm.allLists }
        let query = vm.searchQuery.lowercased()
        return vm.allLists.filter { list in
            list.name.lowercased().contains(query) ||
            (list.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
    private var hasNoLists: Bool {
        guard let vm = viewModel else { return true }
        return vm.allLists.isEmpty
    }
    
    var body: some View {
        NavigationStack(path: $navigationPath) {
            Group {
                if let vm = viewModel {
                    if vm.isLoading && hasNoLists {
                        loadingView
                    } else if hasNoLists {
                        emptyStateView
                    } else {
                        listContent(vm: vm)
                    }
                } else {
                    loadingView
                }
            }
            .navigationTitle("Lists")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if let vm = viewModel, !vm.allLists.isEmpty {
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
                    CreateListSheet(viewModel: vm)
                }
            }
            .sheet(item: $listToEdit) { list in
                if let vm = viewModel {
                    EditListSheet(list: list, viewModel: vm)
                }
            }
            .sheet(item: $listToShare) { list in
                if let vm = viewModel {
                    ShareListSheet(
                        list: list,
                        viewModel: vm,
                        ownerEmail: authViewModel.currentUser?.email ?? ""
                    )
                }
            }
            .alert("Delete List?", isPresented: $showDeleteConfirm, presenting: listToDelete) { list in
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel?.deleteList(id: list.id)
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: { list in
                Text("Are you sure you want to delete \"\(list.name)\"? This action cannot be undone.")
            }
        }
        .onAppear {
            initializeViewModelIfNeeded()
        }
    }
    
    @ViewBuilder
    private func listContent(vm: ListViewModel) -> some View {
        List {
            if vm.isShowingCachedData {
                CachedDataBanner(cachedAt: vm.cachedAt)
                    .listRowInsets(EdgeInsets())
                    .listRowSeparator(.hidden)
            }
            
            if !allFiltered.isEmpty {
                Section {
                    ForEach(allFiltered) { list in
                        let isOwned = vm.ownedLists.contains { $0.id == list.id }
                        NavigationLink(value: list) {
                            ListRowView(list: list, isShared: !isOwned)
                        }
                        .contextMenu {
                            if isOwned {
                                Button {
                                    listToEdit = list
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                
                                Button {
                                    listToShare = list
                                } label: {
                                    Label("Share Settings", systemImage: "person.badge.plus")
                                }
                                
                                Divider()
                                
                                Button(role: .destructive) {
                                    listToDelete = list
                                    showDeleteConfirm = true
                                } label: {
                                    Label("Delete List", systemImage: "trash")
                                }
                            }
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            if isOwned {
                                Button(role: .destructive) {
                                    listToDelete = list
                                    showDeleteConfirm = true
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                .tint(.red)
                            }
                        }
                    }
                    .onMove { source, destination in
                        // Only allow moves when not searching (indices must match allLists)
                        if vm.searchQuery.isEmpty {
                            viewModel?.moveList(from: source, to: destination)
                        }
                    }
                    .moveDisabled(!vm.searchQuery.isEmpty)
                }
            }
            
            if allFiltered.isEmpty && !vm.searchQuery.isEmpty {
                Section {
                    Text("No lists match your search")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 24)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await vm.refresh()
        }
        .searchable(text: Binding(
            get: { vm.searchQuery },
            set: { vm.searchQuery = $0 }
        ), prompt: "Search lists")
        .navigationDestination(for: GatherList.self) { list in
            ListDetailView(
                list: list,
                viewModel: vm,
                isOwned: vm.ownedLists.contains { $0.id == list.id },
                shareSortConfig: vm.shareSortConfigs[list.id]
            )
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Loading lists...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "list.bullet.rectangle")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No lists yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Create one to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            Button {
                showCreateSheet = true
            } label: {
                Label("Create List", systemImage: "plus")
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
        viewModel = ListViewModel(userId: user.id, userEmail: user.email ?? "")
    }
}

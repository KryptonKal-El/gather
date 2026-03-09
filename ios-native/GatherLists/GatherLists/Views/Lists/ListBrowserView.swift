import SwiftUI

/// Browse owned and shared lists with search, grouped into sections.
struct ListBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var viewModel: ListViewModel?
    @State private var showCreateSheet = false
    
    private var ownedFiltered: [GatherList] {
        guard let vm = viewModel else { return [] }
        guard !vm.searchQuery.isEmpty else { return vm.ownedLists }
        let query = vm.searchQuery.lowercased()
        return vm.ownedLists.filter { list in
            list.name.lowercased().contains(query) ||
            (list.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
    private var sharedFiltered: [GatherList] {
        guard let vm = viewModel else { return [] }
        guard !vm.searchQuery.isEmpty else { return vm.sharedLists }
        let query = vm.searchQuery.lowercased()
        return vm.sharedLists.filter { list in
            list.name.lowercased().contains(query) ||
            (list.emoji?.lowercased().contains(query) ?? false)
        }
    }
    
    private var hasNoLists: Bool {
        guard let vm = viewModel else { return true }
        return vm.ownedLists.isEmpty && vm.sharedLists.isEmpty
    }
    
    var body: some View {
        NavigationStack {
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
            .toolbar {
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
        }
        .onAppear {
            initializeViewModelIfNeeded()
        }
    }
    
    @ViewBuilder
    private func listContent(vm: ListViewModel) -> some View {
        List {
            if !ownedFiltered.isEmpty {
                Section("My Lists") {
                    ForEach(ownedFiltered) { list in
                        NavigationLink(value: list) {
                            ListRowView(list: list, isShared: false)
                        }
                        .listRowInsets(EdgeInsets())
                    }
                }
            }
            
            if !sharedFiltered.isEmpty {
                Section("Shared with me") {
                    ForEach(sharedFiltered) { list in
                        NavigationLink(value: list) {
                            ListRowView(list: list, isShared: true)
                        }
                        .listRowInsets(EdgeInsets())
                    }
                }
            }
            
            if ownedFiltered.isEmpty && sharedFiltered.isEmpty && !vm.searchQuery.isEmpty {
                Section {
                    Text("No lists match your search")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 24)
                }
            }
        }
        .listStyle(.insetGrouped)
        .searchable(text: Binding(
            get: { vm.searchQuery },
            set: { vm.searchQuery = $0 }
        ), prompt: "Search lists")
        .navigationDestination(for: GatherList.self) { list in
            ListDetailPlaceholderView(list: list)
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

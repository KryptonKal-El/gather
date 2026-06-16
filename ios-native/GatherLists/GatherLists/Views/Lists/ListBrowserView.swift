import SwiftUI

/// Browse all lists (owned and shared) in a unified list with search.
struct ListBrowserView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(NotificationService.self) private var notificationService
    @Environment(ToastController.self) private var toastController
    @State private var viewModel: ListViewModel?
    @State private var showCreateSheet = false
    @State private var listToEdit: GatherList?
    @State private var listToDelete: GatherList?
    @State private var listToShare: GatherList?
    @State private var showDeleteConfirm = false
    @State private var navigationPath = NavigationPath()
    @State private var pendingDeepLinkId: UUID?
    // Remembers whether the user left off inside a list detail (vs the browser),
    // so a relaunch restores the same screen.
    @AppStorage("gather.listDetailOpen") private var listDetailOpen = true
    @State private var listToDuplicate: GatherList?
    @State private var showResetItemsConfirm = false
    @State private var listToResetItems: GatherList?
    @State private var listToManageStores: GatherList?
    @State private var listToManageCategories: GatherList?
    
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
                    EditListSheet(
                        list: list,
                        viewModel: vm,
                        isOwned: vm.ownedLists.contains { $0.id == list.id }
                    )
                }
            }
            .sheet(item: $listToManageStores) { list in
                StoreBrowserView(listId: list.id)
                    .environment(authViewModel)
            }
            .sheet(item: $listToManageCategories) { list in
                CategoryEditorSheet(
                    listId: list.id,
                    listType: list.type,
                    initialCategories: list.categories ?? [],
                    onSave: { updatedCategories in
                        Task {
                            await viewModel?.updateList(
                                id: list.id,
                                name: nil,
                                emoji: nil,
                                color: nil,
                                type: nil,
                                categories: updatedCategories
                            )
                        }
                    }
                )
                .environment(authViewModel)
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
            .sheet(item: $listToDuplicate) { list in
                DuplicateListSheet(
                    list: list,
                    onDuplicate: { name, resetRsvp in
                        listToDuplicate = nil
                        Task {
                            let result = await viewModel?.duplicateList(
                                listId: list.id,
                                newName: name,
                                resetRsvp: resetRsvp,
                                toastController: toastController
                            )
                            if let newId = result?.list.id {
                                navigateToList(id: newId)
                            }
                        }
                    },
                    onCancel: {
                        listToDuplicate = nil
                    }
                )
            }
            .alert("Reset items", isPresented: $showResetItemsConfirm, presenting: listToResetItems) { list in
                Button("Cancel", role: .cancel) {}
                Button("Reset", role: .destructive) {
                    Task {
                        await handleResetItems(for: list)
                    }
                }
            } message: { list in
                Text("Reset all \(list.itemCount) guest\(list.itemCount == 1 ? "" : "s")? Reset cannot be undone — all guests will be marked Not Yet Invited.")
            }
        }
        .onAppear {
            initializeViewModelIfNeeded()
            handlePendingDeepLinkOnAppear()
        }
        .onChange(of: notificationService.pendingListId) { _, listId in
            guard let listId else { return }
            navigateToList(id: listId)
            notificationService.pendingListId = nil
        }
        .onChange(of: viewModel?.allLists.count) { _, _ in
            if let deferredId = pendingDeepLinkId {
                navigateToList(id: deferredId)
            }
        }
        .onChange(of: viewModel?.activeListId) { oldId, newId in
            guard listDetailOpen,
                  let newId,
                  newId != oldId,
                  let vm = viewModel,
                  vm.allLists.contains(where: { $0.id == newId }),
                  navigationPath.count == 0
            else { return }
            navigateToList(id: newId)
        }
        .onChange(of: navigationPath.count) { _, newCount in
            // Track whether a list detail is open so the choice survives relaunch.
            listDetailOpen = newCount > 0
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
                        let collaborators = vm.collaboratorsByListId[list.id] ?? []
                        NavigationLink(value: list) {
                            ListRowView(list: list, isShared: !isOwned, collaborators: collaborators)
                        }
                        .contextMenu {
                            Button {
                                listToEdit = list
                            } label: {
                                Label("Name, Icon & Color", systemImage: "pencil")
                            }

                            if ListTypes.getConfig(list.type).fields.store {
                                Button {
                                    listToManageStores = list
                                } label: {
                                    Label("Manage Stores", systemImage: "storefront")
                                }
                            }

                            if EditListSheet.categorySupportedTypes.contains(list.type) {
                                Button {
                                    listToManageCategories = list
                                } label: {
                                    Label("Manage Categories", systemImage: "tag")
                                }
                            }

                            if isOwned {
                                Button {
                                    listToShare = list
                                } label: {
                                    Label("Share Settings", systemImage: "person.badge.plus")
                                }

                                Button {
                                    listToDuplicate = list
                                } label: {
                                    Label("Duplicate", systemImage: "doc.on.doc")
                                }

                                if list.type == "guest_list" {
                                    Button {
                                        // Browser rows do not load item RSVP data, so this view always
                                        // shows the confirmation alert and lets the detail screen handle
                                        // the already-reset edge case when item data is available.
                                        listToResetItems = list
                                        showResetItemsConfirm = true
                                    } label: {
                                        Label("Reset items", systemImage: "arrow.counterclockwise")
                                    }
                                    .disabled(list.itemCount == 0)
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
    
    private func handlePendingDeepLinkOnAppear() {
        if let listId = notificationService.pendingListId {
            navigateToList(id: listId)
            notificationService.pendingListId = nil
        } else if let deferredId = pendingDeepLinkId {
            navigateToList(id: deferredId)
        }
    }
    
    private func navigateToList(id: UUID) {
        guard let vm = viewModel,
              let list = vm.allLists.first(where: { $0.id == id }) else {
            pendingDeepLinkId = id
            return
        }
        pendingDeepLinkId = nil
        navigationPath = NavigationPath()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            navigationPath.append(list)
        }
    }

    private func handleResetItems(for list: GatherList) async {
        guard let viewModel else { return }

        guard let affectedCount = await viewModel.resetGuestListRsvp(listId: list.id) else {
            toastController.show("Couldn't reset — try again", variant: .error)
            return
        }

        guard affectedCount > 0 else {
            toastController.show("Already reset", variant: .info)
            return
        }
        toastController.show("Reset \(affectedCount) guest\(affectedCount == 1 ? "" : "s")", variant: .success)
    }
}

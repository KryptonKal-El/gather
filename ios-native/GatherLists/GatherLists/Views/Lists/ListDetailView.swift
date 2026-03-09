import SwiftUI

/// Detail view for a single list showing items, sharing status, and empty state.
struct ListDetailView: View {
    let list: GatherList
    let viewModel: ListViewModel
    let isOwned: Bool
    
    @State private var shareCount: Int = 0
    @State private var isLoadingShares = false
    
    private var navigationTitle: String {
        if let emoji = list.emoji, !emoji.isEmpty {
            return "\(emoji) \(list.name)"
        }
        return list.name
    }
    
    private var listColor: Color {
        Color(hex: list.color)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            if list.itemCount == 0 {
                emptyState
            } else {
                itemsPlaceholder
            }
            
            Spacer()
            
            addItemToolbar
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(listColor, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                shareStatusIndicator
            }
        }
        .task {
            await loadShareInfo()
        }
    }
    
    // MARK: - Empty State
    
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "cart")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("No items yet")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Add items to get started")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Items Placeholder
    
    private var itemsPlaceholder: some View {
        VStack(spacing: 16) {
            Image(systemName: "list.bullet")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text("\(list.itemCount) items")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Item list coming in Phase 3")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Share Status Indicator
    
    @ViewBuilder
    private var shareStatusIndicator: some View {
        if isLoadingShares {
            ProgressView()
                .tint(.white)
        } else if isOwned {
            if shareCount > 0 {
                Label {
                    Text("\(shareCount)")
                } icon: {
                    Image(systemName: "person.2.fill")
                }
                .font(.subheadline)
                .foregroundStyle(.white)
            }
        } else {
            Label {
                Text("Shared")
            } icon: {
                Image(systemName: "person.fill")
            }
            .font(.subheadline)
            .foregroundStyle(.white)
        }
    }
    
    // MARK: - Add Item Toolbar
    
    private var addItemToolbar: some View {
        HStack(spacing: 12) {
            Image(systemName: "plus.circle.fill")
                .font(.title2)
                .foregroundStyle(listColor)
            
            Text("Add item...")
                .foregroundStyle(.secondary)
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
    }
    
    // MARK: - Data Loading
    
    private func loadShareInfo() async {
        guard isOwned else { return }
        isLoadingShares = true
        do {
            let shares = try await ListService.fetchSharesForList(listId: list.id)
            shareCount = shares.count
        } catch {
            print("[ListDetailView] Failed to load shares: \(error.localizedDescription)")
        }
        isLoadingShares = false
    }
}

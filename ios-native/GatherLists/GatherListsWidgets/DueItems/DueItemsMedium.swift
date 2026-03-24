import SwiftUI
import WidgetKit

/// Medium widget view showing up to 5 due items.
struct DueItemsMedium: View {
    var entry: DueItemsEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private let maxItems = 5
    
    private var displayedItems: [DueItemInfo] {
        Array(entry.dueItems.prefix(maxItems))
    }
    
    private var remainingCount: Int {
        max(0, entry.dueItems.count - maxItems)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            headerRow
            
            Divider()
            
            if displayedItems.isEmpty {
                emptyState
            } else {
                itemsList
            }
            
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(Color(.systemBackground), for: .widget)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
    
    private var headerRow: some View {
        HStack(spacing: 6) {
            Image(systemName: "calendar.badge.clock")
                .font(.title3)
                .foregroundStyle(Color.accentColor)
            
            Text("Due Items")
                .font(.headline)
                .lineLimit(1)
                .foregroundStyle(.primary)
        }
    }
    
    private var emptyState: some View {
        Text("All clear! No items due.")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var itemsList: some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(displayedItems) { item in
                Link(destination: URL(string: "gatherlists://list/\(item.listId.uuidString)")!) {
                    itemRow(item)
                }
            }
            
            if remainingCount > 0 {
                Text("+\(remainingCount) more")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    private func itemRow(_ item: DueItemInfo) -> some View {
        HStack(spacing: 6) {
            Text((item.listEmoji?.containsVisualEmoji == true ? item.listEmoji : nil) ?? "📝")
                .font(.caption)
            
            Text(item.name)
                .font(.subheadline)
                .lineLimit(1)
                .foregroundStyle(.primary)
            
            Spacer(minLength: 0)
            
            Text(item.formattedDueDate)
                .font(.caption)
                .foregroundStyle(item.isOverdue ? .orange : .secondary)
        }
    }
}

import SwiftUI
import WidgetKit

/// Large widget view showing up to 10 due items with sections.
struct DueItemsLarge: View {
    var entry: DueItemsEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private let maxItems = 10
    
    private var overdueItems: [DueItemInfo] {
        entry.dueItems.filter { $0.isOverdue }
    }
    
    private var todayItems: [DueItemInfo] {
        entry.dueItems.filter { $0.isDueToday }
    }
    
    private var upcomingItems: [DueItemInfo] {
        entry.dueItems.filter { !$0.isOverdue && !$0.isDueToday }
    }
    
    private var displayedItems: [DueItemInfo] {
        Array(entry.dueItems.prefix(maxItems))
    }
    
    private var remainingCount: Int {
        max(0, entry.dueItems.count - maxItems)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            headerRow
            
            Divider()
            
            if displayedItems.isEmpty {
                emptyState
            } else {
                itemsList
            }
            
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(Color(.systemBackground), for: .widget)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
    
    private var headerRow: some View {
        HStack(spacing: 8) {
            Image(systemName: "calendar.badge.clock")
                .font(.title2)
                .foregroundStyle(Color.accentColor)
            
            VStack(alignment: .leading, spacing: 0) {
                Text("Due Items")
                    .font(.headline)
                    .lineLimit(1)
                    .foregroundStyle(.primary)
                
                Text(entry.scopeLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    private var emptyState: some View {
        VStack {
            Spacer()
            Text("All clear!")
                .font(.body)
                .foregroundStyle(.primary)
            Text("No items due")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
    
    private var itemsList: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !overdueItems.isEmpty {
                sectionHeader("Overdue", color: .orange)
                ForEach(overdueItems.prefix(3)) { item in
                    itemLink(item)
                }
            }
            
            if !todayItems.isEmpty {
                sectionHeader("Today", color: .blue)
                ForEach(todayItems.prefix(3)) { item in
                    itemLink(item)
                }
            }
            
            if !upcomingItems.isEmpty {
                sectionHeader("This Week", color: .secondary)
                let remaining = maxItems - overdueItems.prefix(3).count - todayItems.prefix(3).count
                ForEach(upcomingItems.prefix(max(0, remaining))) { item in
                    itemLink(item)
                }
            }
            
            if remainingCount > 0 {
                Text("+\(remainingCount) more")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
        }
    }
    
    private func sectionHeader(_ title: String, color: Color) -> some View {
        Text(title)
            .font(.caption)
            .fontWeight(.semibold)
            .foregroundStyle(color)
            .padding(.top, 4)
    }
    
    private func itemLink(_ item: DueItemInfo) -> some View {
        Link(destination: URL(string: "gatherlists://list/\(item.listId.uuidString)")!) {
            itemRow(item)
        }
    }
    
    private func itemRow(_ item: DueItemInfo) -> some View {
        HStack(spacing: 8) {
            Text((item.listEmoji?.containsVisualEmoji == true ? item.listEmoji : nil) ?? "📝")
                .font(.subheadline)
            
            Text(item.name)
                .font(.subheadline)
                .lineLimit(1)
                .foregroundStyle(.primary)
            
            if item.isRecurring {
                Image(systemName: "arrow.clockwise")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            
            Spacer(minLength: 0)
            
            VStack(alignment: .trailing, spacing: 0) {
                Text(item.formattedDueDate)
                    .font(.caption)
                    .foregroundStyle(item.isOverdue ? .orange : .secondary)
                
                if let listName = item.listName {
                    Text(listName)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
        }
    }
}

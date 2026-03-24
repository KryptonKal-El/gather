import SwiftUI
import WidgetKit

/// Medium widget view showing list header and up to 6 unchecked items.
struct ListQuickViewMedium: View {
    var entry: ListQuickViewEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private let maxItems = 6
    
    private var backgroundColor: Color {
        if let hex = entry.listColor {
            return Color(hex: hex).opacity(colorScheme == .dark ? 0.3 : 0.15)
        }
        return Color(.systemBackground)
    }
    
    private var displayedItems: [Item] {
        Array(entry.uncheckedItems.prefix(maxItems))
    }
    
    private var remainingCount: Int {
        max(0, entry.uncheckedItems.count - maxItems)
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
        .containerBackground(backgroundColor, for: .widget)
        .widgetURL(URL(string: "gatherlists://list/\(entry.listId.uuidString)"))
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
    
    private var headerRow: some View {
        HStack(spacing: 6) {
            Text((entry.listEmoji?.containsVisualEmoji == true ? entry.listEmoji : nil) ?? "📝")
                .font(.title3)
            
            Text(entry.listName)
                .font(.headline)
                .lineLimit(1)
                .foregroundStyle(.primary)
        }
    }
    
    private var emptyState: some View {
        Text("All done!")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var itemsList: some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(displayedItems) { item in
                itemRow(item)
            }
            
            if remainingCount > 0 {
                Text("+\(remainingCount) more")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
    
    private func itemRow(_ item: Item) -> some View {
        HStack(spacing: 6) {
            Text("○")
                .font(.caption)
                .foregroundStyle(.secondary)
            
            Text(item.name)
                .font(.subheadline)
                .lineLimit(1)
                .foregroundStyle(.primary)
            
            Spacer(minLength: 0)
            
            if item.quantity > 1 {
                Text("x\(item.quantity)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

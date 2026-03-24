import SwiftUI
import WidgetKit

/// Medium widget view showing list header, 2-3 recent items, and add button.
struct QuickAddMedium: View {
    var entry: QuickAddEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private let maxItems = 3
    
    private var backgroundColor: Color {
        if let hex = entry.listColor {
            return Color(hex: hex).opacity(colorScheme == .dark ? 0.3 : 0.15)
        }
        return Color(.systemBackground)
    }
    
    private var accentColor: Color {
        if let hex = entry.listColor {
            return Color(hex: hex)
        }
        return .accentColor
    }
    
    private var displayedItems: [Item] {
        Array(entry.uncheckedItems.prefix(maxItems))
    }
    
    private var remainingCount: Int {
        max(0, entry.uncheckedItems.count - maxItems)
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Left side: list info and items
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
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // Right side: add button
            Button(intent: QuickAddPromptIntent(listId: entry.listId.uuidString)) {
                VStack {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(accentColor)
                    
                    Text("Add")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .frame(width: 60)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(backgroundColor, for: .widget)
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
        Text("No items yet")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxHeight: .infinity)
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

import SwiftUI
import WidgetKit

/// Large widget view showing list header and up to 12 unchecked items with units.
struct ListQuickViewLarge: View {
    var entry: ListQuickViewEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private let maxItems = 12
    
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
        .containerBackground(backgroundColor, for: .widget)
        .widgetURL(URL(string: "gatherlists://list/\(entry.listId.uuidString)"))
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
    
    private var headerRow: some View {
        HStack(spacing: 8) {
            Text(entry.listEmoji ?? "📝")
                .font(.title2)
            
            Text(entry.listName)
                .font(.headline)
                .lineLimit(1)
                .foregroundStyle(.primary)
        }
    }
    
    private var emptyState: some View {
        VStack {
            Spacer()
            Text("All done!")
                .font(.body)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
    
    private var itemsList: some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(displayedItems) { item in
                itemRow(item)
            }
            
            if remainingCount > 0 {
                Text("+\(remainingCount) more")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
        }
    }
    
    private func itemRow(_ item: Item) -> some View {
        HStack(spacing: 8) {
            Text("○")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            Text(item.name)
                .font(.subheadline)
                .lineLimit(1)
                .foregroundStyle(.primary)
            
            Spacer(minLength: 0)
            
            Text(quantityText(for: item))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
    
    private func quantityText(for item: Item) -> String {
        let unit = item.unit.lowercased()
        
        if unit != "each" && !unit.isEmpty {
            return "\(item.quantity) \(item.unit)"
        } else if item.quantity > 1 {
            return "x\(item.quantity)"
        }
        return ""
    }
}

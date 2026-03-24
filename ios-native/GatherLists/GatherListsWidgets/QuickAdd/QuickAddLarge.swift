import SwiftUI
import WidgetKit

/// Large widget view showing list header, up to 6-8 unchecked items, and add button.
struct QuickAddLarge: View {
    var entry: QuickAddEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private let maxItems = 8
    
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
        VStack(alignment: .leading, spacing: 6) {
            // Header with add button
            HStack {
                headerRow
                
                Spacer()
                
                Button(intent: QuickAddPromptIntent(listId: entry.listId.uuidString)) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        
                        Text("Add")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(accentColor)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            
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
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
    
    private var headerRow: some View {
        HStack(spacing: 8) {
            Text((entry.listEmoji?.containsVisualEmoji == true ? entry.listEmoji : nil) ?? "📝")
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
            Text("No items yet. Tap + to add one!")
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

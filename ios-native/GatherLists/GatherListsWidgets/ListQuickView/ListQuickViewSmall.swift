import SwiftUI
import WidgetKit

/// Small widget view showing list emoji, name, and unchecked item count.
struct ListQuickViewSmall: View {
    var entry: ListQuickViewEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
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
    
    var body: some View {
        VStack(spacing: 8) {
            Text(entry.listEmoji ?? "📝")
                .font(.system(size: 40))
            
            Text(entry.listName)
                .font(.headline)
                .lineLimit(1)
                .truncationMode(.tail)
                .foregroundStyle(.primary)
            
            Text(itemCountText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(backgroundColor, for: .widget)
        .widgetURL(URL(string: "gatherlists://list/\(entry.listId.uuidString)"))
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
    
    private var itemCountText: String {
        if entry.uncheckedCount == 1 {
            return "1 item"
        }
        return "\(entry.uncheckedCount) items"
    }
}

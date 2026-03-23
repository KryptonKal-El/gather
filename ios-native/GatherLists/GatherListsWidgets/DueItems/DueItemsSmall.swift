import SwiftUI
import WidgetKit

/// Small widget view showing count of due items.
struct DueItemsSmall: View {
    var entry: DueItemsEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private var totalDueCount: Int {
        entry.overdueCount + entry.dueSoonCount
    }
    
    private var hasOverdue: Bool {
        entry.overdueCount > 0
    }
    
    private var deepLinkURL: URL {
        if let listId = entry.listId {
            return URL(string: "gatherlists://list/\(listId.uuidString)")!
        }
        return URL(string: "gatherlists://")!
    }
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 36))
                .foregroundStyle(hasOverdue ? .orange : .accentColor)
            
            if totalDueCount == 0 {
                Text("All clear")
                    .font(.headline)
                    .foregroundStyle(.primary)
                
                Text("No items due")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 2) {
                    Text("\(totalDueCount) due")
                        .font(.headline)
                        .foregroundStyle(.primary)
                    
                    if hasOverdue {
                        Text("\(entry.overdueCount) overdue")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    } else {
                        Text("this week")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(Color(.systemBackground), for: .widget)
        .widgetURL(deepLinkURL)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
}

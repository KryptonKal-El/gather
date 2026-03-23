import WidgetKit
import SwiftUI

/// Timeline entry for the Next Due Item lock screen widget.
struct NextDueLockScreenEntry: TimelineEntry {
    var date: Date
    var listId: UUID?
    var listName: String?
    var listEmoji: String?
    var itemName: String?
    var dueDate: Date?
    var isOverdue: Bool
    var hasItems: Bool
    var isPlaceholder: Bool
    
    var dueDateText: String {
        guard let dueDate = dueDate else { return "" }
        
        let calendar = Calendar.current
        
        if calendar.isDateInToday(dueDate) {
            return "Today"
        } else if calendar.isDateInTomorrow(dueDate) {
            return "Tomorrow"
        } else if isOverdue {
            return "Overdue"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: dueDate)
        }
    }
    
    static var placeholder: NextDueLockScreenEntry {
        NextDueLockScreenEntry(
            date: Date(),
            listId: UUID(),
            listName: "Groceries",
            listEmoji: "🛒",
            itemName: "Buy milk",
            dueDate: Date().addingTimeInterval(86400),
            isOverdue: false,
            hasItems: true,
            isPlaceholder: true
        )
    }
    
    static var empty: NextDueLockScreenEntry {
        NextDueLockScreenEntry(
            date: Date(),
            listId: nil,
            listName: nil,
            listEmoji: nil,
            itemName: nil,
            dueDate: nil,
            isOverdue: false,
            hasItems: false,
            isPlaceholder: false
        )
    }
}

/// Timeline provider for the Next Due Item lock screen widget.
struct NextDueLockScreenProvider: AppIntentTimelineProvider {
    typealias Entry = NextDueLockScreenEntry
    typealias Intent = SelectListOrAllIntent
    
    func placeholder(in context: Context) -> NextDueLockScreenEntry {
        .placeholder
    }
    
    func snapshot(for configuration: SelectListOrAllIntent, in context: Context) async -> NextDueLockScreenEntry {
        await makeEntry(for: configuration)
    }
    
    func timeline(for configuration: SelectListOrAllIntent, in context: Context) async -> Timeline<NextDueLockScreenEntry> {
        let entry = await makeEntry(for: configuration)
        let nextUpdate = Date().addingTimeInterval(15 * 60)
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func makeEntry(for configuration: SelectListOrAllIntent) async -> NextDueLockScreenEntry {
        let listId = configuration.list?.id
        let dueItems = await WidgetDataProvider.shared.fetchDueItems(listId: listId)
        
        guard let nextItem = dueItems.first else {
            return .empty
        }
        
        let lists = await WidgetDataProvider.shared.fetchLists()
        let itemList = lists.first { $0.id == nextItem.listId }
        
        let isOverdue = nextItem.dueDate.map { $0 < Date() } ?? false
        
        return NextDueLockScreenEntry(
            date: Date(),
            listId: nextItem.listId,
            listName: itemList?.name,
            listEmoji: itemList?.emoji,
            itemName: nextItem.name,
            dueDate: nextItem.dueDate,
            isOverdue: isOverdue,
            hasItems: true,
            isPlaceholder: false
        )
    }
}

/// Entry view for Next Due Item lock screen widget.
struct NextDueLockScreenEntryView: View {
    var entry: NextDueLockScreenEntry
    
    var body: some View {
        rectangularView
    }
    
    private var rectangularView: some View {
        Group {
            if entry.hasItems, let itemName = entry.itemName {
                HStack(spacing: 6) {
                    Text(entry.listEmoji ?? "📝")
                        .font(.system(size: 20))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(itemName)
                            .font(.headline)
                            .lineLimit(1)
                        
                        Text(entry.dueDateText)
                            .font(.subheadline)
                            .foregroundStyle(entry.isOverdue ? .red : .secondary)
                    }
                    
                    Spacer(minLength: 0)
                }
            } else {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 20))
                        .foregroundStyle(.secondary)
                    
                    Text("All clear")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(entry.listId.map { URL(string: "gatherlists://list/\($0.uuidString)") } ?? URL(string: "gatherlists://"))
        .containerBackground(.fill.tertiary, for: .widget)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
}

/// Lock screen widget showing the next due item.
struct NextDueLockScreenWidget: Widget {
    let kind: String = "NextDueLockScreenWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectListOrAllIntent.self,
            provider: NextDueLockScreenProvider()
        ) { entry in
            NextDueLockScreenEntryView(entry: entry)
        }
        .configurationDisplayName("Next Due Item")
        .description("Shows your next due item.")
        .supportedFamilies([.accessoryRectangular])
    }
}

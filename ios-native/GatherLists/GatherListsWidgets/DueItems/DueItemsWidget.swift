import WidgetKit
import SwiftUI

/// Information about a due item for widget display.
struct DueItemInfo: Identifiable {
    var id: UUID
    var name: String
    var dueDate: Date
    var isOverdue: Bool
    var isDueToday: Bool
    var isDueTomorrow: Bool
    var listEmoji: String?
    var listName: String?
    var listId: UUID
    var isRecurring: Bool
    
    var formattedDueDate: String {
        if isDueToday {
            return "Today"
        } else if isDueTomorrow {
            return "Tomorrow"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: dueDate)
        }
    }
}

/// Timeline entry for the Due Items widget.
struct DueItemsEntry: TimelineEntry {
    var date: Date
    var scopeLabel: String
    var listId: UUID?
    var overdueCount: Int
    var dueSoonCount: Int
    var dueItems: [DueItemInfo]
    var isPlaceholder: Bool
    
    static var placeholder: DueItemsEntry {
        DueItemsEntry(
            date: Date(),
            scopeLabel: "All Lists",
            listId: nil,
            overdueCount: 2,
            dueSoonCount: 3,
            dueItems: DueItemsEntry.placeholderItems,
            isPlaceholder: true
        )
    }
    
    private static var placeholderItems: [DueItemInfo] {
        let calendar = Calendar.current
        let today = Date()
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today)!
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
        let nextWeek = calendar.date(byAdding: .day, value: 5, to: today)!
        
        return [
            DueItemInfo(id: UUID(), name: "Pay rent", dueDate: yesterday, isOverdue: true, isDueToday: false, isDueTomorrow: false, listEmoji: "🏠", listName: "Home", listId: UUID(), isRecurring: true),
            DueItemInfo(id: UUID(), name: "Doctor appointment", dueDate: today, isOverdue: false, isDueToday: true, isDueTomorrow: false, listEmoji: "🏥", listName: "Health", listId: UUID(), isRecurring: false),
            DueItemInfo(id: UUID(), name: "Submit report", dueDate: tomorrow, isOverdue: false, isDueToday: false, isDueTomorrow: true, listEmoji: "💼", listName: "Work", listId: UUID(), isRecurring: false),
            DueItemInfo(id: UUID(), name: "Dentist", dueDate: nextWeek, isOverdue: false, isDueToday: false, isDueTomorrow: false, listEmoji: "🦷", listName: "Health", listId: UUID(), isRecurring: false),
            DueItemInfo(id: UUID(), name: "Renew subscription", dueDate: nextWeek, isOverdue: false, isDueToday: false, isDueTomorrow: false, listEmoji: "💳", listName: "Bills", listId: UUID(), isRecurring: true),
        ]
    }
}

/// Timeline provider for the Due Items widget using AppIntent configuration.
struct DueItemsProvider: AppIntentTimelineProvider {
    typealias Entry = DueItemsEntry
    typealias Intent = SelectListOrAllIntent
    
    func placeholder(in context: Context) -> DueItemsEntry {
        .placeholder
    }
    
    func snapshot(for configuration: SelectListOrAllIntent, in context: Context) async -> DueItemsEntry {
        await makeEntry(for: configuration)
    }
    
    func timeline(for configuration: SelectListOrAllIntent, in context: Context) async -> Timeline<DueItemsEntry> {
        let entry = await makeEntry(for: configuration)
        let nextUpdate = Calendar.current.startOfDay(for: Date()).addingTimeInterval(24 * 60 * 60)
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func makeEntry(for configuration: SelectListOrAllIntent) async -> DueItemsEntry {
        let listId = configuration.list?.id
        let scopeLabel = configuration.list?.name ?? "All Lists"
        
        let dueItems = await WidgetDataProvider.shared.fetchDueItems(listId: listId)
        let lists = await WidgetDataProvider.shared.fetchLists()
        
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
        let nextWeek = calendar.date(byAdding: .day, value: 7, to: today)!
        
        var dueItemInfos: [DueItemInfo] = []
        var overdueCount = 0
        var dueSoonCount = 0
        
        for item in dueItems {
            guard let dueDate = item.dueDate else { continue }
            
            let dueDateStart = calendar.startOfDay(for: dueDate)
            let isOverdue = dueDateStart < today
            let isDueToday = calendar.isDate(dueDate, inSameDayAs: today)
            let isDueTomorrow = calendar.isDate(dueDate, inSameDayAs: tomorrow)
            let isDueWithinWeek = dueDateStart < nextWeek
            
            if isOverdue {
                overdueCount += 1
            } else if isDueWithinWeek {
                dueSoonCount += 1
            }
            
            let list = lists.first { $0.id == item.listId }
            
            let info = DueItemInfo(
                id: item.id,
                name: item.name,
                dueDate: dueDate,
                isOverdue: isOverdue,
                isDueToday: isDueToday,
                isDueTomorrow: isDueTomorrow,
                listEmoji: list?.emoji,
                listName: list?.name,
                listId: item.listId,
                isRecurring: item.recurrenceRule != nil
            )
            dueItemInfos.append(info)
        }
        
        return DueItemsEntry(
            date: Date(),
            scopeLabel: scopeLabel,
            listId: listId,
            overdueCount: overdueCount,
            dueSoonCount: dueSoonCount,
            dueItems: dueItemInfos,
            isPlaceholder: false
        )
    }
}

/// Entry view that switches based on widget family.
struct DueItemsWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: DueItemsEntry
    
    var body: some View {
        switch family {
        case .systemSmall:
            DueItemsSmall(entry: entry)
        case .systemMedium:
            DueItemsMedium(entry: entry)
        case .systemLarge:
            DueItemsLarge(entry: entry)
        default:
            DueItemsSmall(entry: entry)
        }
    }
}

/// The Due Items widget definition.
struct DueItemsWidget: Widget {
    let kind: String = "DueItemsWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectListOrAllIntent.self,
            provider: DueItemsProvider()
        ) { entry in
            DueItemsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Due Items")
        .description("See items due soon at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

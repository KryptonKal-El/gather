import WidgetKit
import SwiftUI

/// Timeline entry for the List Quick View widget.
struct ListQuickViewEntry: TimelineEntry {
    var date: Date
    var listId: UUID
    var listName: String
    var listEmoji: String?
    var listColor: String?
    var uncheckedCount: Int
    var uncheckedItems: [Item]
    var isPlaceholder: Bool
    
    static var placeholder: ListQuickViewEntry {
        ListQuickViewEntry(
            date: Date(),
            listId: UUID(),
            listName: "Shopping List",
            listEmoji: "🛒",
            listColor: nil,
            uncheckedCount: 5,
            uncheckedItems: ListQuickViewEntry.placeholderItems,
            isPlaceholder: true
        )
    }
    
    private static var placeholderItems: [Item] {
        [
            Item(listId: UUID(), name: "Milk", quantity: 2),
            Item(listId: UUID(), name: "Bread"),
            Item(listId: UUID(), name: "Eggs", quantity: 12, unit: "ct"),
            Item(listId: UUID(), name: "Butter"),
            Item(listId: UUID(), name: "Cheese"),
        ]
    }
}

/// Timeline provider for the List Quick View widget using AppIntent configuration.
struct ListQuickViewProvider: AppIntentTimelineProvider {
    typealias Entry = ListQuickViewEntry
    typealias Intent = SelectListIntent
    
    func placeholder(in context: Context) -> ListQuickViewEntry {
        .placeholder
    }
    
    func snapshot(for configuration: SelectListIntent, in context: Context) async -> ListQuickViewEntry {
        await makeEntry(for: configuration)
    }
    
    func timeline(for configuration: SelectListIntent, in context: Context) async -> Timeline<ListQuickViewEntry> {
        let entry = await makeEntry(for: configuration)
        let nextUpdate = Date().addingTimeInterval(30 * 60)
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func makeEntry(for configuration: SelectListIntent) async -> ListQuickViewEntry {
        guard let listEntity = configuration.list else {
            return .placeholder
        }
        
        let lists = await WidgetDataProvider.shared.fetchLists()
        guard let list = lists.first(where: { $0.id == listEntity.id }) else {
            return .placeholder
        }
        
        let uncheckedItems = await WidgetDataProvider.shared.fetchUncheckedItems(listId: list.id)
        
        return ListQuickViewEntry(
            date: Date(),
            listId: list.id,
            listName: list.name,
            listEmoji: list.emoji,
            listColor: list.color,
            uncheckedCount: uncheckedItems.count,
            uncheckedItems: uncheckedItems,
            isPlaceholder: false
        )
    }
}

/// Entry view that switches based on widget family.
struct ListQuickViewWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: ListQuickViewEntry
    
    var body: some View {
        switch family {
        case .systemSmall:
            ListQuickViewSmall(entry: entry)
        case .systemMedium:
            ListQuickViewMedium(entry: entry)
        case .systemLarge:
            ListQuickViewLarge(entry: entry)
        default:
            ListQuickViewSmall(entry: entry)
        }
    }
}

/// The List Quick View widget definition.
struct ListQuickViewWidget: Widget {
    let kind: String = "ListQuickViewWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectListIntent.self,
            provider: ListQuickViewProvider()
        ) { entry in
            ListQuickViewWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("List Quick View")
        .description("See items remaining in a list at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

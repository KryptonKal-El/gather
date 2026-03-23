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
    var isPlaceholder: Bool
    
    static var placeholder: ListQuickViewEntry {
        ListQuickViewEntry(
            date: Date(),
            listId: UUID(),
            listName: "Shopping List",
            listEmoji: "🛒",
            listColor: nil,
            uncheckedCount: 5,
            isPlaceholder: true
        )
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
        
        let uncheckedCount = await WidgetDataProvider.shared.fetchUncheckedCount(listId: list.id)
        
        return ListQuickViewEntry(
            date: Date(),
            listId: list.id,
            listName: list.name,
            listEmoji: list.emoji,
            listColor: list.color,
            uncheckedCount: uncheckedCount,
            isPlaceholder: false
        )
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
            ListQuickViewSmall(entry: entry)
        }
        .configurationDisplayName("List Quick View")
        .description("See items remaining in a list at a glance.")
        .supportedFamilies([.systemSmall])
    }
}

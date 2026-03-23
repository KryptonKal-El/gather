import WidgetKit
import SwiftUI

/// Timeline entry for the Quick-Add widget.
struct QuickAddEntry: TimelineEntry {
    var date: Date
    var listId: UUID
    var listName: String
    var listEmoji: String?
    var listColor: String?
    var uncheckedItems: [Item]
    var isPlaceholder: Bool
    
    static var placeholder: QuickAddEntry {
        QuickAddEntry(
            date: Date(),
            listId: UUID(),
            listName: "Shopping List",
            listEmoji: "🛒",
            listColor: nil,
            uncheckedItems: QuickAddEntry.placeholderItems,
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
            Item(listId: UUID(), name: "Apples"),
            Item(listId: UUID(), name: "Bananas"),
            Item(listId: UUID(), name: "Coffee"),
        ]
    }
}

/// Timeline provider for the Quick-Add widget using AppIntent configuration.
struct QuickAddProvider: AppIntentTimelineProvider {
    typealias Entry = QuickAddEntry
    typealias Intent = SelectListIntent
    
    func placeholder(in context: Context) -> QuickAddEntry {
        .placeholder
    }
    
    func snapshot(for configuration: SelectListIntent, in context: Context) async -> QuickAddEntry {
        await makeEntry(for: configuration)
    }
    
    func timeline(for configuration: SelectListIntent, in context: Context) async -> Timeline<QuickAddEntry> {
        let entry = await makeEntry(for: configuration)
        let nextUpdate = Date().addingTimeInterval(15 * 60) // Update every 15 minutes
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func makeEntry(for configuration: SelectListIntent) async -> QuickAddEntry {
        guard let listEntity = configuration.list else {
            return .placeholder
        }
        
        let lists = await WidgetDataProvider.shared.fetchLists()
        guard let list = lists.first(where: { $0.id == listEntity.id }) else {
            return .placeholder
        }
        
        let uncheckedItems = await WidgetDataProvider.shared.fetchUncheckedItems(listId: list.id)
        
        return QuickAddEntry(
            date: Date(),
            listId: list.id,
            listName: list.name,
            listEmoji: list.emoji,
            listColor: list.color,
            uncheckedItems: uncheckedItems,
            isPlaceholder: false
        )
    }
}

/// Entry view that switches based on widget family.
struct QuickAddWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: QuickAddEntry
    
    var body: some View {
        switch family {
        case .systemSmall:
            QuickAddSmall(entry: entry)
        case .systemMedium:
            QuickAddMedium(entry: entry)
        case .systemLarge:
            QuickAddLarge(entry: entry)
        default:
            QuickAddSmall(entry: entry)
        }
    }
}

/// The Quick-Add widget definition.
struct QuickAddWidget: Widget {
    let kind: String = "QuickAddWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectListIntent.self,
            provider: QuickAddProvider()
        ) { entry in
            QuickAddWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Quick Add")
        .description("Quickly add items to a list.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

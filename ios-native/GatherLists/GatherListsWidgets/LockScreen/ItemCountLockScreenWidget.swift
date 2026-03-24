import WidgetKit
import SwiftUI

/// Timeline entry for the Item Count lock screen widget.
struct ItemCountLockScreenEntry: TimelineEntry {
    var date: Date
    var listId: UUID
    var listName: String
    var listEmoji: String?
    var uncheckedCount: Int
    var isPlaceholder: Bool
    
    static var placeholder: ItemCountLockScreenEntry {
        ItemCountLockScreenEntry(
            date: Date(),
            listId: UUID(),
            listName: "Shopping List",
            listEmoji: "🛒",
            uncheckedCount: 5,
            isPlaceholder: true
        )
    }
}

/// Timeline provider for the Item Count lock screen widget.
struct ItemCountLockScreenProvider: AppIntentTimelineProvider {
    typealias Entry = ItemCountLockScreenEntry
    typealias Intent = SelectListIntent
    
    func placeholder(in context: Context) -> ItemCountLockScreenEntry {
        .placeholder
    }
    
    func snapshot(for configuration: SelectListIntent, in context: Context) async -> ItemCountLockScreenEntry {
        await makeEntry(for: configuration)
    }
    
    func timeline(for configuration: SelectListIntent, in context: Context) async -> Timeline<ItemCountLockScreenEntry> {
        let entry = await makeEntry(for: configuration)
        let nextUpdate = Date().addingTimeInterval(15 * 60)
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func makeEntry(for configuration: SelectListIntent) async -> ItemCountLockScreenEntry {
        guard let listEntity = configuration.list else {
            return .placeholder
        }
        
        let lists = await WidgetDataProvider.shared.fetchLists()
        guard let list = lists.first(where: { $0.id == listEntity.id }) else {
            return .placeholder
        }
        
        let uncheckedCount = await WidgetDataProvider.shared.fetchUncheckedCount(listId: list.id)
        
        return ItemCountLockScreenEntry(
            date: Date(),
            listId: list.id,
            listName: list.name,
            listEmoji: list.emoji,
            uncheckedCount: uncheckedCount,
            isPlaceholder: false
        )
    }
}

/// Entry view for Item Count lock screen widget that switches based on family.
struct ItemCountLockScreenEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: ItemCountLockScreenEntry
    
    var body: some View {
        switch family {
        case .accessoryCircular:
            circularView
        case .accessoryRectangular:
            rectangularView
        default:
            circularView
        }
    }
    
    private var circularView: some View {
        VStack(spacing: 2) {
            Text((entry.listEmoji?.containsVisualEmoji == true ? entry.listEmoji : nil) ?? "📝")
                .font(.system(size: 20))
            
            Text("\(entry.uncheckedCount)")
                .font(.system(size: 16, weight: .semibold))
                .minimumScaleFactor(0.6)
        }
        .widgetURL(URL(string: "gatherlists://list/\(entry.listId.uuidString)"))
        .containerBackground(.fill.tertiary, for: .widget)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
    
    private var rectangularView: some View {
        HStack(spacing: 8) {
            Text((entry.listEmoji?.containsVisualEmoji == true ? entry.listEmoji : nil) ?? "📝")
                .font(.system(size: 24))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.listName)
                    .font(.headline)
                    .lineLimit(1)
                
                Text(entry.uncheckedCount == 1 ? "1 item" : "\(entry.uncheckedCount) items")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Spacer(minLength: 0)
        }
        .widgetURL(URL(string: "gatherlists://list/\(entry.listId.uuidString)"))
        .containerBackground(.fill.tertiary, for: .widget)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
}

/// Lock screen widget showing unchecked item count for a selected list.
struct ItemCountLockScreenWidget: Widget {
    let kind: String = "ItemCountLockScreenWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectListIntent.self,
            provider: ItemCountLockScreenProvider()
        ) { entry in
            ItemCountLockScreenEntryView(entry: entry)
        }
        .configurationDisplayName("Item Count")
        .description("Shows unchecked item count for a list.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
    }
}

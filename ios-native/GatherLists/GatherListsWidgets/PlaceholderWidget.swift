import WidgetKit
import SwiftUI

struct PlaceholderWidgetEntry: TimelineEntry {
    let date: Date
}

struct PlaceholderWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> PlaceholderWidgetEntry {
        PlaceholderWidgetEntry(date: Date())
    }
    
    func getSnapshot(in context: Context, completion: @escaping (PlaceholderWidgetEntry) -> Void) {
        completion(PlaceholderWidgetEntry(date: Date()))
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<PlaceholderWidgetEntry>) -> Void) {
        let entry = PlaceholderWidgetEntry(date: Date())
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600)))
        completion(timeline)
    }
}

struct PlaceholderWidgetEntryView: View {
    var entry: PlaceholderWidgetProvider.Entry
    
    var body: some View {
        VStack {
            Image(systemName: "list.bullet")
                .font(.largeTitle)
            Text("Gather Lists")
                .font(.headline)
            Text("Coming Soon")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct PlaceholderWidget: Widget {
    let kind: String = "PlaceholderWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PlaceholderWidgetProvider()) { entry in
            PlaceholderWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Gather Lists")
        .description("Quick access to your lists.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

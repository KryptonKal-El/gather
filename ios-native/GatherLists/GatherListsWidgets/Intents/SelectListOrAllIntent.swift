import AppIntents
import WidgetKit

/// Configuration intent that lets users select either all lists or a specific list for due items display.
struct SelectListOrAllIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select List"
    static var description = IntentDescription("Choose all lists or a specific list")
    
    @Parameter(title: "List", default: nil)
    var list: ListEntity?
}

import AppIntents
import WidgetKit

/// Configuration intent that lets users select which list to display in a widget.
struct SelectListIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select List"
    static var description = IntentDescription("Choose which list to display")
    
    @Parameter(title: "List")
    var list: ListEntity?
}

/// Entity representing a list that can be selected in widget configuration.
struct ListEntity: AppEntity {
    var id: UUID
    var name: String
    var emoji: String?
    var color: String?
    
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "List")
    
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(emoji ?? "📝") \(name)")
    }
    
    static var defaultQuery = ListEntityQuery()
}

/// Query provider for ListEntity that fetches available lists from the shared data store.
struct ListEntityQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [ListEntity] {
        let lists = await WidgetDataProvider.shared.fetchLists()
        return lists
            .filter { identifiers.contains($0.id) }
            .map { ListEntity(id: $0.id, name: $0.name, emoji: $0.emoji, color: $0.color) }
    }
    
    func suggestedEntities() async throws -> [ListEntity] {
        let lists = await WidgetDataProvider.shared.fetchLists()
        return lists.map { ListEntity(id: $0.id, name: $0.name, emoji: $0.emoji, color: $0.color) }
    }
    
    func defaultResult() async -> ListEntity? {
        let lists = await WidgetDataProvider.shared.fetchLists()
        return lists.first.map { ListEntity(id: $0.id, name: $0.name, emoji: $0.emoji, color: $0.color) }
    }
}

import AppIntents
import WidgetKit

/// Intent for adding an item to a list via the Quick-Add widget.
struct AddItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Item to List"
    static var description = IntentDescription("Add an item to a Gather list")
    
    @Parameter(title: "Item Name", requestValueDialog: "What would you like to add?")
    var itemName: String
    
    @Parameter(title: "List ID")
    var listId: String
    
    init() {}
    
    init(listId: String) {
        self.listId = listId
    }
    
    func perform() async throws -> some IntentResult {
        guard !itemName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .result()
        }
        
        guard let listUUID = UUID(uuidString: listId) else {
            return .result()
        }
        
        do {
            try await WidgetSupabaseClient.addItem(
                name: itemName.trimmingCharacters(in: .whitespacesAndNewlines),
                listId: listUUID
            )
            
            // Refresh widget timelines to show the new item
            WidgetCenter.shared.reloadTimelines(ofKind: "QuickAddWidget")
            WidgetCenter.shared.reloadTimelines(ofKind: "ListQuickViewWidget")
        } catch {
            // Log error but don't throw - widget intents should fail gracefully
            print("[AddItemIntent] Failed to add item: \(error.localizedDescription)")
        }
        
        return .result()
    }
}

/// Intent specifically for the small widget "+" button that prompts for item name.
struct QuickAddPromptIntent: AppIntent {
    static var title: LocalizedStringResource = "Quick Add Item"
    static var description = IntentDescription("Quickly add an item to a list")
    
    @Parameter(title: "Item Name", requestValueDialog: "What would you like to add?")
    var itemName: String
    
    @Parameter(title: "List ID")
    var listId: String
    
    init() {}
    
    init(listId: String) {
        self.listId = listId
    }
    
    func perform() async throws -> some IntentResult {
        guard !itemName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .result()
        }
        
        guard let listUUID = UUID(uuidString: listId) else {
            return .result()
        }
        
        do {
            try await WidgetSupabaseClient.addItem(
                name: itemName.trimmingCharacters(in: .whitespacesAndNewlines),
                listId: listUUID
            )
            
            WidgetCenter.shared.reloadTimelines(ofKind: "QuickAddWidget")
            WidgetCenter.shared.reloadTimelines(ofKind: "ListQuickViewWidget")
        } catch {
            print("[QuickAddPromptIntent] Failed to add item: \(error.localizedDescription)")
        }
        
        return .result()
    }
}

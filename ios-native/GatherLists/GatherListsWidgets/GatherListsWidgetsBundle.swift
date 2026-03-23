import WidgetKit
import SwiftUI

@main
struct GatherListsWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PlaceholderWidget()
        ListQuickViewWidget()
        DueItemsWidget()
        QuickAddWidget()
        ItemCountLockScreenWidget()
        NextDueLockScreenWidget()
    }
}

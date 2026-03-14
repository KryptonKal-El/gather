import Foundation

/// Valid sort level options for the sort pipeline.
enum SortLevel: String, Codable, CaseIterable {
    case store
    case category
    case name
    case date
    case price
    case rsvp
}

/// Sort pipeline engine for shopping list items.
/// Provides flexible, composable sorting and grouping of items based on a configurable sort pipeline.
enum SortPipeline {
    /// System default sort configuration.
    static let systemDefault: [SortLevel] = [.store, .category, .name]
    
    /// Returns the default sort config for a given list type.
    static func getDefaultConfig(for listType: String) -> [SortLevel] {
        let config = ListTypes.getConfig(listType)
        return config.defaultSort.compactMap { SortLevel(rawValue: $0) }
    }
    
    /// Levels that create groups (vs just sorting within existing groups).
    private static let groupingLevels: Set<SortLevel> = [.store, .category, .rsvp]
    
    /// A group of items created by store or category grouping.
    struct SortGroup {
        let key: String
        let label: String
        let color: String?
        let type: SortLevel
        var items: [Item]?
        var subGroups: [SortGroup]?
    }
    
    /// Result of applying the sort pipeline.
    struct PipelineResult {
        var groups: [SortGroup]
        var ungrouped: [Item]
        var items: [Item]?
    }
    
    // MARK: - Validation
    
    /// Validates a sort configuration.
    static func isValid(_ config: [SortLevel]) -> Bool {
        guard !config.isEmpty, config.count <= 3 else { return false }
        var seen = Set<SortLevel>()
        for level in config {
            if seen.contains(level) { return false }
            seen.insert(level)
        }
        return true
    }
    
    /// Normalizes any input into a valid sort configuration.
    static func normalize(_ config: [SortLevel]?) -> [SortLevel] {
        guard let config = config else { return systemDefault }
        
        var seen = Set<SortLevel>()
        var normalized: [SortLevel] = []
        
        for level in config {
            guard !seen.contains(level) else { continue }
            seen.insert(level)
            normalized.append(level)
            if normalized.count == 3 { break }
        }
        
        return normalized.isEmpty ? systemDefault : normalized
    }
    
    /// Normalizes from string array (for Supabase JSON decoding).
    static func normalize(strings: [String]?) -> [SortLevel] {
        guard let strings = strings else { return systemDefault }
        
        var seen = Set<SortLevel>()
        var normalized: [SortLevel] = []
        
        for str in strings {
            guard let level = SortLevel(rawValue: str), !seen.contains(level) else { continue }
            seen.insert(level)
            normalized.append(level)
            if normalized.count == 3 { break }
        }
        
        return normalized.isEmpty ? systemDefault : normalized
    }
    
    // MARK: - Core Function
    
    /// Applies the sort pipeline to items, returning a nested group structure.
    /// - Parameters:
    ///   - items: Array of items to sort/group.
    ///   - config: Array of 1-3 sort levels.
    ///   - stores: Array of store objects for store grouping and category lookup.
    ///   - listType: The list type (for type-specific category lookup).
    /// - Returns: Nested structure with groups, subGroups, and items.
    static func apply(items: [Item], config: [SortLevel], stores: [Store], listType: String = "grocery") -> PipelineResult {
        let normalizedConfig = normalize(config)
        let safeStores = stores
        
        guard !items.isEmpty else {
            return PipelineResult(groups: [], ungrouped: [], items: [])
        }
        
        let hasGroupingLevel = normalizedConfig.contains { groupingLevels.contains($0) }
        
        if !hasGroupingLevel {
            var sorted = items
            for level in normalizedConfig {
                sorted = applySortLevel(sorted, level: level)
            }
            return PipelineResult(groups: [], ungrouped: [], items: sorted)
        }
        
        let result = applyRemainingLevels(
            items: items,
            remainingLevels: normalizedConfig,
            stores: safeStores,
            parentStoreId: nil,
            listType: listType
        )
        
        return PipelineResult(
            groups: result.groups ?? [],
            ungrouped: result.ungrouped ?? []
        )
    }
    
    // MARK: - Private Helpers
    
    private struct IntermediateResult {
        var groups: [SortGroup]?
        var items: [Item]?
        var ungrouped: [Item]?
    }
    
    private static func applySortLevel(_ items: [Item], level: SortLevel) -> [Item] {
        switch level {
        case .name:
            return sortByName(items)
        case .date:
            return sortByDate(items)
        case .price:
            return sortByPrice(items)
        default:
            return items
        }
    }
    
    private static func sortByName(_ items: [Item]) -> [Item] {
        items.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    
    private static func sortByDate(_ items: [Item]) -> [Item] {
        items.sorted { $0.addedAt > $1.addedAt }
    }
    
    private static func sortByPrice(_ items: [Item]) -> [Item] {
        items.sorted { a, b in
            let priceA = a.price
            let priceB = b.price
            if priceA == nil && priceB == nil { return false }
            if priceA == nil { return false }
            if priceB == nil { return true }
            return priceA! < priceB!
        }
    }
    
    private static func applyRemainingLevels(
        items: [Item],
        remainingLevels: [SortLevel],
        stores: [Store],
        parentStoreId: UUID?,
        listType: String
    ) -> IntermediateResult {
        guard !remainingLevels.isEmpty else {
            return IntermediateResult(items: items)
        }
        
        let currentLevel = remainingLevels[0]
        let nextLevels = Array(remainingLevels.dropFirst())
        
        if !groupingLevels.contains(currentLevel) {
            var sorted = items
            for level in remainingLevels {
                sorted = applySortLevel(sorted, level: level)
            }
            return IntermediateResult(items: sorted)
        }
        
        switch currentLevel {
        case .store:
            return groupByStore(items: items, stores: stores, remainingLevels: nextLevels, listType: listType)
        case .category:
            return groupByCategory(items: items, stores: stores, remainingLevels: nextLevels, parentStoreId: parentStoreId, listType: listType)
        case .rsvp:
            return groupByRsvp(items: items, stores: stores, remainingLevels: nextLevels, listType: listType)
        default:
            return IntermediateResult(items: items)
        }
    }
    
    private static func groupByStore(
        items: [Item],
        stores: [Store],
        remainingLevels: [SortLevel],
        listType: String
    ) -> IntermediateResult {
        let storeMap = Dictionary(uniqueKeysWithValues: stores.map { ($0.id, $0) })
        
        var grouped: [UUID: [Item]] = [:]
        var ungrouped: [Item] = []
        
        for item in items {
            if let storeId = item.storeId, storeMap[storeId] != nil {
                grouped[storeId, default: []].append(item)
            } else {
                ungrouped.append(item)
            }
        }
        
        let sortedStores = stores.sorted { $0.sortOrder < $1.sortOrder }
        
        var groups: [SortGroup] = []
        for store in sortedStores {
            guard let storeItems = grouped[store.id], !storeItems.isEmpty else { continue }
            
            let subResult = applyRemainingLevels(
                items: storeItems,
                remainingLevels: remainingLevels,
                stores: stores,
                parentStoreId: store.id,
                listType: listType
            )
            
            var group = SortGroup(
                key: "store-\(store.id.uuidString)",
                label: store.name,
                color: store.color,
                type: .store,
                items: nil,
                subGroups: nil
            )
            
            if let subGroups = subResult.groups {
                var finalSubGroups = subGroups
                if let subUngrouped = subResult.ungrouped, !subUngrouped.isEmpty {
                    finalSubGroups.append(SortGroup(
                        key: "store-\(store.id.uuidString)-other",
                        label: "Other",
                        color: "#9e9e9e",
                        type: .category,
                        items: subUngrouped,
                        subGroups: nil
                    ))
                }
                group.subGroups = finalSubGroups
            } else {
                group.items = subResult.items
            }
            
            groups.append(group)
        }
        
        if !ungrouped.isEmpty {
            let subResult = applyRemainingLevels(
                items: ungrouped,
                remainingLevels: remainingLevels,
                stores: stores,
                parentStoreId: nil,
                listType: listType
            )
            
            var unassignedGroup = SortGroup(
                key: "store-unassigned",
                label: "Unassigned",
                color: nil,
                type: .store,
                items: nil,
                subGroups: nil
            )
            
            if let subGroups = subResult.groups {
                var finalSubGroups = subGroups
                if let subUngrouped = subResult.ungrouped, !subUngrouped.isEmpty {
                    finalSubGroups.append(SortGroup(
                        key: "store-unassigned-other",
                        label: "Other",
                        color: "#9e9e9e",
                        type: .category,
                        items: subUngrouped,
                        subGroups: nil
                    ))
                }
                unassignedGroup.subGroups = finalSubGroups
            } else {
                unassignedGroup.items = subResult.items ?? ungrouped
            }
            
            groups.append(unassignedGroup)
        }
        
        return IntermediateResult(groups: groups, ungrouped: [])
    }
    
    private static func groupByCategory(
        items: [Item],
        stores: [Store],
        remainingLevels: [SortLevel],
        parentStoreId: UUID?,
        listType: String
    ) -> IntermediateResult {
        let categoryInfo = getCategoryInfo(stores: stores, parentStoreId: parentStoreId, listType: listType)
        let validCategories = Set(categoryInfo.orderedKeys)
        
        var grouped: [String: [Item]] = [:]
        var other: [Item] = []
        
        for item in items {
            if let cat = item.category, validCategories.contains(cat) {
                grouped[cat, default: []].append(item)
            } else {
                other.append(item)
            }
        }
        
        var groups: [SortGroup] = []
        for categoryKey in categoryInfo.orderedKeys {
            guard let categoryItems = grouped[categoryKey], !categoryItems.isEmpty else { continue }
            
            let subResult = applyRemainingLevels(
                items: categoryItems,
                remainingLevels: remainingLevels,
                stores: stores,
                parentStoreId: parentStoreId,
                listType: listType
            )
            
            var group = SortGroup(
                key: "category-\(categoryKey)",
                label: categoryInfo.labels[categoryKey] ?? categoryKey,
                color: categoryInfo.colors[categoryKey] ?? "#9e9e9e",
                type: .category,
                items: nil,
                subGroups: nil
            )
            
            if let subGroups = subResult.groups {
                group.subGroups = subGroups
            } else {
                group.items = subResult.items
            }
            
            groups.append(group)
        }
        
        var processedOther = other
        if !other.isEmpty && !remainingLevels.isEmpty {
            let subResult = applyRemainingLevels(
                items: other,
                remainingLevels: remainingLevels,
                stores: stores,
                parentStoreId: parentStoreId,
                listType: listType
            )
            processedOther = subResult.items ?? other
        }
        
        if !processedOther.isEmpty {
            groups.append(SortGroup(
                key: "category-other",
                label: "Other",
                color: "#9e9e9e",
                type: .category,
                items: processedOther,
                subGroups: nil
            ))
        }
        
        return IntermediateResult(groups: groups, ungrouped: [])
    }
    
    private static func groupByRsvp(
        items: [Item],
        stores: [Store],
        remainingLevels: [SortLevel],
        listType: String
    ) -> IntermediateResult {
        let rsvpOrder: [(status: String, label: String, color: String)] = [
            ("confirmed", "Confirmed", "#4caf50"),
            ("maybe", "Maybe", "#ff9800"),
            ("invited", "Invited", "#9e9e9e"),
            ("declined", "Declined", "#f44336")
        ]
        
        var grouped: [String: [Item]] = [:]
        
        for item in items {
            let status = item.rsvpStatus ?? "invited"
            grouped[status, default: []].append(item)
        }
        
        var groups: [SortGroup] = []
        for rsvp in rsvpOrder {
            guard let rsvpItems = grouped[rsvp.status], !rsvpItems.isEmpty else { continue }
            
            let subResult = applyRemainingLevels(
                items: rsvpItems,
                remainingLevels: remainingLevels,
                stores: stores,
                parentStoreId: nil,
                listType: listType
            )
            
            var group = SortGroup(
                key: "rsvp-\(rsvp.status)",
                label: rsvp.label,
                color: rsvp.color,
                type: .rsvp,
                items: nil,
                subGroups: nil
            )
            
            if let subGroups = subResult.groups {
                group.subGroups = subGroups
            } else {
                group.items = subResult.items
            }
            
            groups.append(group)
        }
        
        return IntermediateResult(groups: groups, ungrouped: [])
    }
    
    private struct CategoryInfo {
        var labels: [String: String]
        var colors: [String: String]
        var orderedKeys: [String]
    }
    
    private static func getCategoryInfo(stores: [Store], parentStoreId: UUID?, listType: String) -> CategoryInfo {
        // Packing/todo types use their own categories
        if listType == "packing" {
            let cats = ListTypeCategories.packing
            var labels: [String: String] = [:]
            var colors: [String: String] = [:]
            var orderedKeys: [String] = []
            for cat in cats {
                labels[cat.key] = cat.name
                colors[cat.key] = cat.color
                orderedKeys.append(cat.key)
            }
            return CategoryInfo(labels: labels, colors: colors, orderedKeys: orderedKeys)
        }
        if listType == "todo" {
            let cats = ListTypeCategories.todo
            var labels: [String: String] = [:]
            var colors: [String: String] = [:]
            var orderedKeys: [String] = []
            for cat in cats {
                labels[cat.key] = cat.name
                colors[cat.key] = cat.color
                orderedKeys.append(cat.key)
            }
            return CategoryInfo(labels: labels, colors: colors, orderedKeys: orderedKeys)
        }
        
        // Grocery (existing behavior)
        var categories = CategoryDefinitions.defaults
        
        if let storeId = parentStoreId,
           let store = stores.first(where: { $0.id == storeId }),
           !store.categories.isEmpty {
            categories = store.categories
        }
        
        var labels: [String: String] = [:]
        var colors: [String: String] = [:]
        var orderedKeys: [String] = []
        
        for cat in categories {
            labels[cat.key] = cat.name
            colors[cat.key] = cat.color
            orderedKeys.append(cat.key)
        }
        
        return CategoryInfo(labels: labels, colors: colors, orderedKeys: orderedKeys)
    }
}

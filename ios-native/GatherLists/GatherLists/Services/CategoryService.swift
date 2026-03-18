import Foundation

enum CategoryService {
    static func getSystemDefaults(for listType: String) -> [CategoryDef]? {
        switch listType {
        case "grocery":
            return CategoryDefinitions.defaults
        case "packing":
            return ListTypeCategories.packing.map { CategoryDef(key: $0.key, name: $0.name, color: $0.color, keywords: $0.keywords) }
        case "todo":
            return ListTypeCategories.todo.map { CategoryDef(key: $0.key, name: $0.name, color: $0.color, keywords: $0.keywords) }
        case "project":
            return ListTypeCategories.project.map { CategoryDef(key: $0.key, name: $0.name, color: $0.color, keywords: $0.keywords) }
        default:
            return nil
        }
    }
    
    static func getEffectiveCategories(
        list: GatherList?,
        userDefaults: [UserCategoryDefault] = []
    ) -> [CategoryDef]? {
        guard let list = list else { return nil }
        let listType = list.type
        
        if listType == "basic" || listType == "guest_list" { return nil }
        
        if let listCats = list.categories, !listCats.isEmpty {
            return listCats
        }
        
        if let userDefault = userDefaults.first(where: { $0.listType == listType }),
           !userDefault.categories.isEmpty {
            return userDefault.categories
        }
        
        return getSystemDefaults(for: listType)
    }
}

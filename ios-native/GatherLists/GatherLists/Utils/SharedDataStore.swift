import Foundation

/// Thread-safe actor for caching lists and items to the App Group shared container.
/// Uses file-based JSON storage for widget access.
actor SharedDataStore {
    static let shared = SharedDataStore()
    
    private let containerURL: URL?
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    
    private init() {
        containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: SharedDefaults.suiteName
        )
        
        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }
    
    // MARK: - File Paths
    
    private var listsFileURL: URL? {
        containerURL?.appendingPathComponent("cached_lists.json")
    }
    
    private var itemsDirectoryURL: URL? {
        containerURL?.appendingPathComponent("items", isDirectory: true)
    }
    
    private func itemsFileURL(for listId: UUID) -> URL? {
        itemsDirectoryURL?.appendingPathComponent("\(listId.uuidString).json")
    }
    
    // MARK: - Lists
    
    func saveLists(_ lists: [GatherList]) async {
        guard let url = listsFileURL else {
            print("[SharedDataStore] No container URL available")
            return
        }
        
        do {
            let data = try encoder.encode(lists)
            try data.write(to: url, options: .atomic)
        } catch {
            print("[SharedDataStore] Failed to save lists: \(error.localizedDescription)")
        }
    }
    
    func loadLists() async -> [GatherList]? {
        guard let url = listsFileURL,
              FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }
        
        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode([GatherList].self, from: data)
        } catch {
            print("[SharedDataStore] Failed to load lists: \(error.localizedDescription)")
            return nil
        }
    }
    
    // MARK: - Items
    
    func saveItems(_ items: [Item], for listId: UUID) async {
        guard let directoryURL = itemsDirectoryURL else {
            print("[SharedDataStore] No container URL available")
            return
        }
        
        do {
            // Ensure items directory exists
            if !FileManager.default.fileExists(atPath: directoryURL.path) {
                try FileManager.default.createDirectory(
                    at: directoryURL,
                    withIntermediateDirectories: true
                )
            }
            
            guard let url = itemsFileURL(for: listId) else { return }
            let data = try encoder.encode(items)
            try data.write(to: url, options: .atomic)
        } catch {
            print("[SharedDataStore] Failed to save items for list \(listId): \(error.localizedDescription)")
        }
    }
    
    func loadItems(for listId: UUID) async -> [Item]? {
        guard let url = itemsFileURL(for: listId),
              FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }
        
        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode([Item].self, from: data)
        } catch {
            print("[SharedDataStore] Failed to load items for list \(listId): \(error.localizedDescription)")
            return nil
        }
    }
    
    func clearItems(for listId: UUID) async {
        guard let url = itemsFileURL(for: listId) else { return }
        
        do {
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
        } catch {
            print("[SharedDataStore] Failed to clear items for list \(listId): \(error.localizedDescription)")
        }
    }
    
    // MARK: - Clear All
    
    func clearAll() async {
        if let listsURL = listsFileURL {
            try? FileManager.default.removeItem(at: listsURL)
        }
        
        if let itemsDir = itemsDirectoryURL {
            try? FileManager.default.removeItem(at: itemsDir)
        }
    }
}

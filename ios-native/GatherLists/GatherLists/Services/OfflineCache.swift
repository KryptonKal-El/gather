import Foundation

struct CachedEntry<T: Codable>: Codable {
    let data: T
    let cachedAt: Date
}

actor OfflineCache {
    static let shared = OfflineCache()
    
    private let fileManager = FileManager.default
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    
    private var cacheDirectory: URL {
        fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OfflineCache", isDirectory: true)
    }
    
    private init() {
        let cacheDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OfflineCache", isDirectory: true)
        try? fileManager.createDirectory(at: cacheDir, withIntermediateDirectories: true)
    }
    
    func save<T: Codable>(_ data: T, forKey key: String) {
        let entry = CachedEntry(data: data, cachedAt: Date())
        guard let jsonData = try? encoder.encode(entry) else { return }
        let url = cacheDirectory.appendingPathComponent("\(key).json")
        try? jsonData.write(to: url)
    }
    
    func load<T: Decodable>(forKey key: String) -> CachedEntry<T>? {
        let url = cacheDirectory.appendingPathComponent("\(key).json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder.decode(CachedEntry<T>.self, from: data)
    }
    
    func remove(forKey key: String) {
        let url = cacheDirectory.appendingPathComponent("\(key).json")
        try? fileManager.removeItem(at: url)
    }
    
    func clearAll() {
        guard let files = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) else { return }
        for file in files {
            try? fileManager.removeItem(at: file)
        }
    }
}

import Foundation

/// Settings for image search provider preferences.
struct ImageSearchSettings: Codable, Hashable {
    var walmart: Bool
    var spoonacular: Bool
    var openfoodfacts: Bool
    var serpapi: Bool
    
    static let defaultSettings = ImageSearchSettings(
        walmart: true,
        spoonacular: false,
        openfoodfacts: false,
        serpapi: false
    )
}

/// A user profile, mapped to the `profiles` Supabase table.
struct Profile: Codable, Identifiable, Hashable {
    let id: UUID
    var avatarUrl: String?
    var displayName: String?
    var imageSearchSettings: ImageSearchSettings
    
    enum CodingKeys: String, CodingKey {
        case id
        case avatarUrl = "avatar_url"
        case displayName = "display_name"
        case imageSearchSettings = "image_search_settings"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        imageSearchSettings = try container.decodeIfPresent(ImageSearchSettings.self, forKey: .imageSearchSettings)
            ?? ImageSearchSettings.defaultSettings
    }
}

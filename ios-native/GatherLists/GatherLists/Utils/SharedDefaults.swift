import Foundation

/// Utility for reading/writing to the App Group shared UserDefaults container.
/// Used for sharing auth tokens and simple data between the main app and extensions.
struct SharedDefaults {
    static let suiteName = "group.com.gatherlists"
    
    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }
    
    // MARK: - Auth Token Keys
    
    private static let accessTokenKey = "auth_access_token"
    private static let refreshTokenKey = "auth_refresh_token"
    private static let userIdKey = "auth_user_id"
    
    // MARK: - Auth Token Methods
    
    static func saveAuthSession(accessToken: String, refreshToken: String, userId: String) {
        defaults?.set(accessToken, forKey: accessTokenKey)
        defaults?.set(refreshToken, forKey: refreshTokenKey)
        defaults?.set(userId, forKey: userIdKey)
    }
    
    static func getAccessToken() -> String? {
        defaults?.string(forKey: accessTokenKey)
    }
    
    static func getRefreshToken() -> String? {
        defaults?.string(forKey: refreshTokenKey)
    }
    
    static func getUserId() -> String? {
        defaults?.string(forKey: userIdKey)
    }
    
    static func clearAuthSession() {
        defaults?.removeObject(forKey: accessTokenKey)
        defaults?.removeObject(forKey: refreshTokenKey)
        defaults?.removeObject(forKey: userIdKey)
    }
    
    // MARK: - Generic Accessors
    
    static func set<T>(_ value: T, forKey key: String) {
        defaults?.set(value, forKey: key)
    }
    
    static func string(forKey key: String) -> String? {
        defaults?.string(forKey: key)
    }
    
    static func data(forKey key: String) -> Data? {
        defaults?.data(forKey: key)
    }
    
    static func setData(_ data: Data, forKey key: String) {
        defaults?.set(data, forKey: key)
    }
    
    static func remove(forKey key: String) {
        defaults?.removeObject(forKey: key)
    }
}

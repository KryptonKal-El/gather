import SwiftUI

/// Manages the app's appearance setting (system, light, dark), persisted to UserDefaults.
@Observable
@MainActor
final class AppearanceManager {
    static let shared = AppearanceManager()
    
    enum AppearanceSetting: String, CaseIterable {
        case system
        case light
        case dark
        
        var displayName: String {
            switch self {
            case .system: return "System"
            case .light: return "Light"
            case .dark: return "Dark"
            }
        }
        
        var colorScheme: ColorScheme? {
            switch self {
            case .system: return nil
            case .light: return .light
            case .dark: return .dark
            }
        }
    }
    
    var setting: AppearanceSetting {
        didSet {
            UserDefaults.standard.set(setting.rawValue, forKey: "appearance-setting")
        }
    }
    
    private init() {
        let raw = UserDefaults.standard.string(forKey: "appearance-setting") ?? "system"
        setting = AppearanceSetting(rawValue: raw) ?? .system
    }
}

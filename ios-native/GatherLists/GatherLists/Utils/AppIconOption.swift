import UIKit

/// The app icons a user can pick in Settings.
///
/// `.standard` is the primary `AppIcon`, which follows the season the app ships
/// with (see `scripts/generate-icons.js`). The others are alternate icon sets
/// listed in the `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` build setting.
enum AppIconOption: String, CaseIterable, Identifiable {
    case standard
    case classic
    case holiday

    var id: String { rawValue }

    /// The alternate icon name passed to `setAlternateIconName`; `nil` for the primary icon.
    var iconName: String? {
        switch self {
        case .standard: nil
        case .classic: "AppIconClassic"
        case .holiday: "AppIconHoliday"
        }
    }

    /// Image set holding the picker preview for this icon.
    var previewImageName: String {
        switch self {
        case .standard: "AppIconPreviewDefault"
        case .classic: "AppIconPreviewClassic"
        case .holiday: "AppIconPreviewHoliday"
        }
    }

    var displayName: String {
        switch self {
        case .standard: "Default"
        case .classic: "Classic"
        case .holiday: "Holiday"
        }
    }

    var subtitle: String {
        switch self {
        case .standard: "Changes with the season"
        case .classic: "The original Gather Lists icon"
        case .holiday: "Santa hat and snow, all year round"
        }
    }

    /// The icon currently on the Home Screen.
    @MainActor
    static var current: AppIconOption {
        let name = UIApplication.shared.alternateIconName
        return allCases.first { $0.iconName == name } ?? .standard
    }
}

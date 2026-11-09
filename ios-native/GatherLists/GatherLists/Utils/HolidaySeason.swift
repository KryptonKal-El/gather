import Foundation

/// Decides when the holiday snowfall plays on launch.
///
/// The window is defined by month and day only, so it recurs every year with no
/// release needed. Snowfall plays at most once per calendar day so it stays a
/// treat rather than something that greets every foreground.
enum HolidaySeason {
    /// First day (inclusive) of the holiday window, as (month, day).
    static let start = (month: 12, day: 1)
    /// Last day (inclusive) of the holiday window, as (month, day).
    static let end = (month: 12, day: 26)

    private static let lastShownKey = "holidaySnowfallLastShownDay"
    /// Launch argument / defaults key that forces snowfall on, for testing outside the window.
    private static let forceKey = "forceSnowfall"

    /// Whether `date` falls inside the yearly holiday window.
    static func isActive(on date: Date = .now, calendar: Calendar = .current) -> Bool {
        let parts = calendar.dateComponents([.month, .day], from: date)
        guard let month = parts.month, let day = parts.day else { return false }
        let value = month * 100 + day
        return value >= start.month * 100 + start.day && value <= end.month * 100 + end.day
    }

    /// Whether snowfall should play now: inside the window and not yet shown today.
    /// Records the day as shown when it returns `true`.
    static func consumeSnowfall(
        on date: Date = .now,
        calendar: Calendar = .current,
        defaults: UserDefaults = .standard
    ) -> Bool {
        if defaults.bool(forKey: forceKey) { return true }
        guard isActive(on: date, calendar: calendar) else { return false }

        let today = dayStamp(for: date, calendar: calendar)
        guard defaults.string(forKey: lastShownKey) != today else { return false }
        defaults.set(today, forKey: lastShownKey)
        return true
    }

    private static func dayStamp(for date: Date, calendar: Calendar) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return "\(parts.year ?? 0)-\(parts.month ?? 0)-\(parts.day ?? 0)"
    }
}

import Foundation

/// Computes recurrence dates for recurring items.
enum RecurrenceEngine {
    /// Valid recurrence types.
    private static let validTypes = ["daily", "weekly", "biweekly", "monthly", "yearly", "custom"]
    
    /// Valid custom frequencies.
    private static let validFrequencies = ["day", "week", "month", "year"]
    
    /// Returns the next due date given a recurrence rule and starting date.
    /// - Parameters:
    ///   - rule: The recurrence rule (or nil).
    ///   - date: The starting date to compute from.
    /// - Returns: The next occurrence date, or nil if rule is invalid.
    static func getNextOccurrence(rule: RecurrenceRule?, from date: Date) -> Date? {
        guard let rule = rule else { return nil }
        guard validTypes.contains(rule.type) else { return nil }
        
        let calendar = Calendar.current
        var result: Date?
        
        switch rule.type {
        case "daily":
            result = calendar.date(byAdding: .day, value: 1, to: date)
            
        case "weekly":
            result = calendar.date(byAdding: .day, value: 7, to: date)
            
        case "biweekly":
            result = calendar.date(byAdding: .day, value: 14, to: date)
            
        case "monthly":
            result = addMonths(to: date, months: 1, calendar: calendar)
            
        case "yearly":
            result = addYears(to: date, years: 1, calendar: calendar)
            
        case "custom":
            result = getCustomOccurrence(from: date, rule: rule, calendar: calendar)
            
        default:
            return nil
        }
        
        guard let nextDate = result else { return nil }
        return normalizeToNoon(nextDate, calendar: calendar)
    }
    
    // MARK: - Private Helpers
    
    /// Adds months to a date, handling month-end edge cases (Jan 31 → Feb 28).
    private static func addMonths(to date: Date, months: Int, calendar: Calendar) -> Date? {
        let originalDay = calendar.component(.day, from: date)
        
        guard let result = calendar.date(byAdding: .month, value: months, to: date) else {
            return nil
        }
        
        let resultDay = calendar.component(.day, from: result)
        
        // If day overflowed, go back to last day of target month
        if resultDay != originalDay && resultDay < originalDay {
            // Day is now less (wrapped), which is expected for short months
            return result
        } else if resultDay != originalDay {
            // Day wrapped to next month, need to go back to last day
            return calendar.date(byAdding: .day, value: -resultDay, to: result)
        }
        
        return result
    }
    
    /// Adds years to a date, handling leap year edge cases (Feb 29 → Feb 28).
    private static func addYears(to date: Date, years: Int, calendar: Calendar) -> Date? {
        let originalDay = calendar.component(.day, from: date)
        
        guard let result = calendar.date(byAdding: .year, value: years, to: date) else {
            return nil
        }
        
        let resultDay = calendar.component(.day, from: result)
        
        // Handle Feb 29 → Feb 28 in non-leap years
        if resultDay != originalDay && resultDay < originalDay {
            return result
        } else if resultDay != originalDay {
            return calendar.date(byAdding: .day, value: -resultDay, to: result)
        }
        
        return result
    }
    
    /// Normalizes a date to noon to avoid timezone issues.
    private static func normalizeToNoon(_ date: Date, calendar: Calendar) -> Date {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        var noonComponents = components
        noonComponents.hour = 12
        noonComponents.minute = 0
        noonComponents.second = 0
        return calendar.date(from: noonComponents) ?? date
    }
    
    /// Computes the next occurrence for custom recurrence rules.
    private static func getCustomOccurrence(from date: Date, rule: RecurrenceRule, calendar: Calendar) -> Date? {
        guard let interval = rule.interval, interval >= 1 else { return nil }
        guard let frequency = rule.frequency, validFrequencies.contains(frequency) else { return nil }
        
        switch frequency {
        case "day":
            return calendar.date(byAdding: .day, value: interval, to: date)
            
        case "week":
            // If daysOfWeek is specified, use special weekly logic
            if let daysOfWeek = rule.daysOfWeek, !daysOfWeek.isEmpty {
                let validDays = daysOfWeek.filter { $0 >= 0 && $0 <= 6 }
                if !validDays.isEmpty {
                    return getNextCustomWeeklyOccurrence(from: date, interval: interval, daysOfWeek: validDays, calendar: calendar)
                }
            }
            // Otherwise just add N weeks
            return calendar.date(byAdding: .day, value: interval * 7, to: date)
            
        case "month":
            return addMonths(to: date, months: interval, calendar: calendar)
            
        case "year":
            return addYears(to: date, years: interval, calendar: calendar)
            
        default:
            return nil
        }
    }
    
    /// Gets the next occurrence for custom weekly rules with daysOfWeek.
    /// - Parameters:
    ///   - date: The starting date.
    ///   - interval: Week interval (e.g., 2 for every 2 weeks).
    ///   - daysOfWeek: Array of valid weekdays (0=Sun..6=Sat).
    ///   - calendar: Calendar to use for date math.
    /// - Returns: The next matching date.
    private static func getNextCustomWeeklyOccurrence(from date: Date, interval: Int, daysOfWeek: [Int], calendar: Calendar) -> Date? {
        let sortedDays = daysOfWeek.sorted()
        
        // Swift Calendar uses 1=Sun..7=Sat, convert to 0-indexed
        let currentWeekday = calendar.component(.weekday, from: date) - 1
        
        // Calculate the start of the current week (Sunday)
        guard let startOfWeek = calendar.date(byAdding: .day, value: -currentWeekday, to: date) else {
            return nil
        }
        
        // Search up to interval * 7 + 7 days to find the next match
        let maxDays = interval * 7 + 7
        
        guard var candidate = calendar.date(byAdding: .day, value: 1, to: date) else {
            return nil
        }
        
        for _ in 0..<maxDays {
            let candidateWeekday = calendar.component(.weekday, from: candidate) - 1
            
            // Calculate how many days from week start
            let daysDiff = calendar.dateComponents([.day], from: startOfWeek, to: candidate).day ?? 0
            let weekNumber = daysDiff / 7
            
            // Check if this week is valid based on interval
            let isValidWeek = weekNumber % interval == 0
            
            if isValidWeek && sortedDays.contains(candidateWeekday) {
                return candidate
            }
            
            guard let next = calendar.date(byAdding: .day, value: 1, to: candidate) else {
                break
            }
            candidate = next
        }
        
        // Fallback
        return calendar.date(byAdding: .day, value: interval * 7, to: date)
    }
}

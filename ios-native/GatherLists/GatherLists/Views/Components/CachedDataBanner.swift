import SwiftUI

struct CachedDataBanner: View {
    let cachedAt: Date?
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.caption2)
            Text("Showing cached data \u{00B7} Last updated \(relativeTime)")
                .font(.caption)
        }
        .foregroundStyle(.orange.opacity(0.9))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color.yellow.opacity(0.15))
    }
    
    private var relativeTime: String {
        guard let cachedAt else { return "unknown" }
        let interval = Date().timeIntervalSince(cachedAt)
        
        if interval < 60 { return "just now" }
        if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        }
        if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        }
        if interval < 172800 { return "yesterday" }
        let days = Int(interval / 86400)
        return "\(days)d ago"
    }
}

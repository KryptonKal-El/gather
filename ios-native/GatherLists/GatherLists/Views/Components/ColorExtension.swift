import SwiftUI

extension Color {
    /// The app's primary brand color, used for tints and accents.
    static let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)

    /// Initialize a Color from a hex string (e.g., "#1565c0" or "1565c0").
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        r = Double((int >> 16) & 0xFF) / 255
        g = Double((int >> 8) & 0xFF) / 255
        b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

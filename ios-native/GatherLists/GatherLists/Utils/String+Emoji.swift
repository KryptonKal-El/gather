import Foundation

extension String {
    var containsVisualEmoji: Bool {
        self.range(of: "\\p{Extended_Pictographic}", options: .regularExpression) != nil
    }
}

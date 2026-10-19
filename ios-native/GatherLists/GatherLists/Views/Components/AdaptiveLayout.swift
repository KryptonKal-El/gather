import SwiftUI

/// Widest a scrolling column of rows or text should get before it becomes hard to read.
private let READABLE_CONTENT_WIDTH: CGFloat = 720

/// Insets scroll content on wide (iPad) layouts so rows stay a readable width
/// instead of stretching edge to edge. Compact widths are left untouched.
private struct ReadableContentMargins: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var containerWidth: CGFloat = 0

    func body(content: Content) -> some View {
        let inset = max(0, (containerWidth - READABLE_CONTENT_WIDTH) / 2)
        content
            .contentMargins(.horizontal, horizontalSizeClass == .regular ? inset : 0, for: .scrollContent)
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.width
            } action: { width in
                containerWidth = width
            }
    }
}

/// Lets a custom chooser sheet shrink to its content on iPad, where height detents are ignored.
private struct FittedSheetSizing: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.presentationSizing(.form.fitted(horizontal: false, vertical: true))
        } else {
            content
        }
    }
}

extension View {
    /// Keeps scrolling content at a readable width on iPad while still scrolling edge to edge.
    func readableContentWidth() -> some View {
        modifier(ReadableContentMargins())
    }

    /// Sizes a short chooser sheet to its content on iPad; no effect on iPhone.
    func fittedSheetSizing() -> some View {
        modifier(FittedSheetSizing())
    }
}

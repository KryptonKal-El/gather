import SwiftUI

/// Wraps content so it can be pinched to zoom, dragged while zoomed, and double-tapped to toggle zoom.
/// The zoomed content is clipped to the container's unzoomed bounds.
struct ZoomableContainer<Content: View>: View {
    private let maxScale: CGFloat
    private let doubleTapScale: CGFloat
    private let content: Content

    @State private var scale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var size: CGSize = .zero
    @State private var pinchStart: (scale: CGFloat, offset: CGSize)?
    @State private var dragStartOffset: CGSize?

    init(
        maxScale: CGFloat = 5,
        doubleTapScale: CGFloat = 2.5,
        @ViewBuilder content: () -> Content
    ) {
        self.maxScale = maxScale
        self.doubleTapScale = doubleTapScale
        self.content = content()
    }

    var body: some View {
        content
            .scaleEffect(scale)
            .offset(offset)
            .onGeometryChange(for: CGSize.self) { proxy in
                proxy.size
            } action: { newSize in
                size = newSize
            }
            .contentShape(Rectangle())
            .clipped()
            .gesture(dragGesture, including: scale > 1 ? .all : .subviews)
            .simultaneousGesture(magnifyGesture)
            .onTapGesture(count: 2, coordinateSpace: .local) { location in
                withAnimation(.snappy) {
                    if scale > 1 {
                        scale = 1
                        offset = .zero
                    } else {
                        zoom(to: doubleTapScale, from: (1, .zero), around: location)
                    }
                }
            }
    }

    private var magnifyGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let start = pinchStart ?? (scale, offset)
                pinchStart = start
                zoom(to: start.scale * value.magnification, from: start, around: value.startLocation)
            }
            .onEnded { _ in
                pinchStart = nil
                if scale <= 1 {
                    withAnimation(.snappy) { offset = .zero }
                }
            }
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                let start = dragStartOffset ?? offset
                dragStartOffset = start
                offset = clamped(
                    CGSize(
                        width: start.width + value.translation.width,
                        height: start.height + value.translation.height
                    ),
                    at: scale
                )
            }
            .onEnded { _ in
                dragStartOffset = nil
            }
    }

    /// Scales to `target` while keeping the content under `location` stationary.
    private func zoom(to target: CGFloat, from start: (scale: CGFloat, offset: CGSize), around location: CGPoint) {
        let newScale = min(max(target, 1), maxScale)
        let anchor = CGSize(width: location.x - size.width / 2, height: location.y - size.height / 2)
        let ratio = newScale / start.scale
        scale = newScale
        offset = clamped(
            CGSize(
                width: anchor.width - (anchor.width - start.offset.width) * ratio,
                height: anchor.height - (anchor.height - start.offset.height) * ratio
            ),
            at: newScale
        )
    }

    private func clamped(_ proposed: CGSize, at scale: CGFloat) -> CGSize {
        let maxX = size.width * (scale - 1) / 2
        let maxY = size.height * (scale - 1) / 2
        return CGSize(
            width: min(max(proposed.width, -maxX), maxX),
            height: min(max(proposed.height, -maxY), maxY)
        )
    }
}

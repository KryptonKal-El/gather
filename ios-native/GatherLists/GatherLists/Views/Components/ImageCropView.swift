import SwiftUI
import UIKit

/// A full-screen crop step shown after a photo is taken, chosen from the library, or pasted,
/// before the item image is uploaded. The image is shown fitted; a crop rectangle can be moved
/// and resized by its corners. Defaults to a square (to match the grid thumbnails) and can be
/// switched to free-form.
struct ImageCropView: View {
    let image: UIImage
    let onCrop: (UIImage) -> Void
    let onCancel: () -> Void

    private enum AspectMode: Hashable {
        case square
        case freeform
    }

    private enum Corner {
        case topLeft, topRight, bottomLeft, bottomRight
    }

    /// Smallest crop side in points, so a crop box can't collapse.
    private static let minSide: CGFloat = 60
    /// Touch target radius for the corner handles.
    private static let handleHitRadius: CGFloat = 30

    @State private var aspectMode: AspectMode = .square
    /// Crop rectangle in the container's coordinate space; set once the layout is known.
    @State private var cropRect: CGRect = .zero
    /// The displayed (fitted) image rectangle in container space.
    @State private var imageRect: CGRect = .zero
    /// Snapshot of `cropRect` captured at the start of a drag gesture.
    @State private var dragStartRect: CGRect?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()

                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(width: geo.size.width, height: geo.size.height)

                if cropRect != .zero {
                    cropOverlay
                }
            }
            .contentShape(Rectangle())
            .onAppear { layout(in: geo.size) }
        }
        .safeAreaInset(edge: .top) { topBar }
        .safeAreaInset(edge: .bottom) { bottomBar }
        .background(Color.black.ignoresSafeArea())
        .statusBarHidden()
    }

    // MARK: - Overlay

    private var cropOverlay: some View {
        ZStack {
            // Dim everything outside the crop rectangle.
            DimOutside(crop: cropRect)
                .fill(Color.black.opacity(0.55), style: FillStyle(eoFill: true))
                .allowsHitTesting(false)

            // Crop frame with a rule-of-thirds grid.
            Rectangle()
                .path(in: cropRect)
                .stroke(Color.white, lineWidth: 1.5)
            GridLines(rect: cropRect)
                .stroke(Color.white.opacity(0.4), lineWidth: 0.5)
                .allowsHitTesting(false)

            // Move the whole crop box by dragging inside it.
            Color.clear
                .frame(width: cropRect.width, height: cropRect.height)
                .contentShape(Rectangle())
                .position(x: cropRect.midX, y: cropRect.midY)
                .gesture(moveGesture)

            cornerHandle(.topLeft)
            cornerHandle(.topRight)
            cornerHandle(.bottomLeft)
            cornerHandle(.bottomRight)
        }
    }

    private func cornerHandle(_ corner: Corner) -> some View {
        let point = cornerPoint(corner, in: cropRect)
        return Circle()
            .fill(Color.white)
            .frame(width: 16, height: 16)
            .overlay(Circle().stroke(Color.black.opacity(0.25), lineWidth: 1))
            .frame(width: Self.handleHitRadius, height: Self.handleHitRadius)
            .contentShape(Circle())
            .position(point)
            .gesture(resizeGesture(corner))
    }

    // MARK: - Bars

    private var topBar: some View {
        HStack {
            Button("Cancel", action: onCancel)
                .foregroundStyle(.white)
            Spacer()
            Picker("Aspect", selection: $aspectMode) {
                Text("Square").tag(AspectMode.square)
                Text("Freeform").tag(AspectMode.freeform)
            }
            .pickerStyle(.segmented)
            .fixedSize()
            .onChange(of: aspectMode) { _, mode in
                if mode == .square { squareUp() }
            }
            Spacer()
            Button("Use Photo") { crop() }
                .fontWeight(.semibold)
                .foregroundStyle(.white)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.black.opacity(0.85))
    }

    private var bottomBar: some View {
        Text(aspectMode == .square ? "Drag to reposition · pull a corner to resize"
                                   : "Drag corners freely to set any shape")
            .font(.quicksand(.caption))
            .foregroundStyle(.white.opacity(0.7))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(.black.opacity(0.85))
    }

    // MARK: - Gestures

    private var moveGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                let start = dragStartRect ?? cropRect
                if dragStartRect == nil { dragStartRect = start }
                var moved = start.offsetBy(dx: value.translation.width, dy: value.translation.height)
                // Keep the box fully inside the image.
                moved.origin.x = min(max(moved.minX, imageRect.minX), imageRect.maxX - moved.width)
                moved.origin.y = min(max(moved.minY, imageRect.minY), imageRect.maxY - moved.height)
                cropRect = moved
            }
            .onEnded { _ in dragStartRect = nil }
    }

    private func resizeGesture(_ corner: Corner) -> some Gesture {
        DragGesture()
            .onChanged { value in
                let start = dragStartRect ?? cropRect
                if dragStartRect == nil { dragStartRect = start }
                cropRect = aspectMode == .square
                    ? squareResized(start, corner: corner, translation: value.translation)
                    : freeResized(start, corner: corner, translation: value.translation)
            }
            .onEnded { _ in dragStartRect = nil }
    }

    /// Free-form resize: the dragged corner follows the finger, the opposite corner stays put.
    private func freeResized(_ start: CGRect, corner: Corner, translation: CGSize) -> CGRect {
        var minX = start.minX, minY = start.minY, maxX = start.maxX, maxY = start.maxY
        switch corner {
        case .topLeft: minX += translation.width; minY += translation.height
        case .topRight: maxX += translation.width; minY += translation.height
        case .bottomLeft: minX += translation.width; maxY += translation.height
        case .bottomRight: maxX += translation.width; maxY += translation.height
        }
        // Clamp to the image and keep at least the minimum side on each axis.
        minX = min(max(minX, imageRect.minX), maxX - Self.minSide)
        maxX = max(min(maxX, imageRect.maxX), minX + Self.minSide)
        minY = min(max(minY, imageRect.minY), maxY - Self.minSide)
        maxY = max(min(maxY, imageRect.maxY), minY + Self.minSide)
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
    }

    /// Square resize: the opposite corner is the anchor; the side follows the finger but is clamped
    /// so the square stays within the image.
    private func squareResized(_ start: CGRect, corner: Corner, translation: CGSize) -> CGRect {
        let anchor = cornerPoint(opposite(corner), in: start)
        let desiredW = abs((cornerPoint(corner, in: start).x + translation.width) - anchor.x)
        let desiredH = abs((cornerPoint(corner, in: start).y + translation.height) - anchor.y)
        var side = max(max(desiredW, desiredH), Self.minSide)
        // Limit the side so the square anchored at `anchor` stays inside the image.
        let maxLeft = anchor.x - imageRect.minX
        let maxRight = imageRect.maxX - anchor.x
        let maxUp = anchor.y - imageRect.minY
        let maxDown = imageRect.maxY - anchor.y
        switch corner {
        case .topLeft: side = min(side, maxLeft, maxUp)
        case .topRight: side = min(side, maxRight, maxUp)
        case .bottomLeft: side = min(side, maxLeft, maxDown)
        case .bottomRight: side = min(side, maxRight, maxDown)
        }
        side = max(side, Self.minSide)
        let x = corner == .topLeft || corner == .bottomLeft ? anchor.x - side : anchor.x
        let y = corner == .topLeft || corner == .topRight ? anchor.y - side : anchor.y
        return CGRect(x: x, y: y, width: side, height: side)
    }

    // MARK: - Layout helpers

    private func layout(in container: CGSize) {
        let size = image.size
        guard size.width > 0, size.height > 0 else { return }
        let scale = min(container.width / size.width, container.height / size.height)
        let displayW = size.width * scale
        let displayH = size.height * scale
        let origin = CGPoint(x: (container.width - displayW) / 2, y: (container.height - displayH) / 2)
        imageRect = CGRect(origin: origin, size: CGSize(width: displayW, height: displayH))
        // Start with the largest centered square inside the image.
        let side = min(displayW, displayH)
        cropRect = CGRect(
            x: imageRect.midX - side / 2,
            y: imageRect.midY - side / 2,
            width: side,
            height: side
        )
    }

    /// Shrinks the current crop box to a centered square that fits inside the image.
    private func squareUp() {
        guard cropRect != .zero else { return }
        let side = max(min(cropRect.width, cropRect.height), Self.minSide)
        var squared = CGRect(x: cropRect.midX - side / 2, y: cropRect.midY - side / 2, width: side, height: side)
        squared.origin.x = min(max(squared.minX, imageRect.minX), imageRect.maxX - side)
        squared.origin.y = min(max(squared.minY, imageRect.minY), imageRect.maxY - side)
        cropRect = squared
    }

    private func cornerPoint(_ corner: Corner, in rect: CGRect) -> CGPoint {
        switch corner {
        case .topLeft: return CGPoint(x: rect.minX, y: rect.minY)
        case .topRight: return CGPoint(x: rect.maxX, y: rect.minY)
        case .bottomLeft: return CGPoint(x: rect.minX, y: rect.maxY)
        case .bottomRight: return CGPoint(x: rect.maxX, y: rect.maxY)
        }
    }

    private func opposite(_ corner: Corner) -> Corner {
        switch corner {
        case .topLeft: return .bottomRight
        case .topRight: return .bottomLeft
        case .bottomLeft: return .topRight
        case .bottomRight: return .topLeft
        }
    }

    // MARK: - Cropping

    private func crop() {
        guard imageRect.width > 0, let result = croppedImage() else {
            // Fall back to the untouched image rather than blocking the user.
            onCrop(image)
            return
        }
        onCrop(result)
    }

    private func croppedImage() -> UIImage? {
        let normalized = image.normalizedUp()
        guard let cg = normalized.cgImage else { return nil }
        let pxW = CGFloat(cg.width)
        let pxH = CGFloat(cg.height)
        // Map the crop rectangle from container space into image-pixel space.
        let fx = pxW / imageRect.width
        let fy = pxH / imageRect.height
        var pixelRect = CGRect(
            x: (cropRect.minX - imageRect.minX) * fx,
            y: (cropRect.minY - imageRect.minY) * fy,
            width: cropRect.width * fx,
            height: cropRect.height * fy
        ).integral
        pixelRect = pixelRect.intersection(CGRect(x: 0, y: 0, width: pxW, height: pxH))
        guard !pixelRect.isEmpty, let cropped = cg.cropping(to: pixelRect) else { return nil }
        return UIImage(cgImage: cropped, scale: normalized.scale, orientation: .up)
    }
}

/// A fill shape that covers everything in its bounds except `crop` (even-odd fill),
/// producing the darkened border around the crop box.
private struct DimOutside: Shape {
    let crop: CGRect

    func path(in rect: CGRect) -> Path {
        var path = Path(rect)
        path.addRect(crop)
        return path
    }
}

/// Rule-of-thirds guide lines inside the crop rectangle.
private struct GridLines: Shape {
    let rect: CGRect

    func path(in _: CGRect) -> Path {
        var path = Path()
        for i in 1...2 {
            let x = rect.minX + rect.width * CGFloat(i) / 3
            path.move(to: CGPoint(x: x, y: rect.minY))
            path.addLine(to: CGPoint(x: x, y: rect.maxY))
            let y = rect.minY + rect.height * CGFloat(i) / 3
            path.move(to: CGPoint(x: rect.minX, y: y))
            path.addLine(to: CGPoint(x: rect.maxX, y: y))
        }
        return path
    }
}

private extension UIImage {
    /// Returns a copy drawn with `.up` orientation so pixel-space cropping maps directly to what
    /// the user sees. Returns `self` when already upright.
    func normalizedUp() -> UIImage {
        guard imageOrientation != .up else { return self }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = scale
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

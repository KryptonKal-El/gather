import SwiftUI

/// A gentle holiday snowfall overlay.
///
/// Snowflakes drift down with a soft side-to-side sway, mixed with a few red,
/// gold and green sparkles. It plays for a few seconds, fades out, then calls
/// `onFinish`. Non-interactive, and renders nothing under Reduce Motion.
struct SnowfallView: View {
    /// Total length of the effect, including the fade-out, in seconds.
    let duration: Double
    /// Called once the effect has fully faded out.
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    // Built up front: a Canvas inside TimelineView keeps drawing with the
    // values it first captured, so flakes assigned later in `.task` never appear.
    private let flakes: [Snowflake]
    private let startDate = Date.now

    private static let fadeDuration = 1.4

    /// Creates a snowfall of `count` flakes lasting `duration` seconds.
    init(duration: Double = 7, count: Int = 90, onFinish: @escaping () -> Void = {}) {
        self.duration = duration
        self.onFinish = onFinish
        self.flakes = (0..<count).map { _ in Snowflake() }
    }

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                guard !reduceMotion else { return }
                let elapsed = timeline.date.timeIntervalSince(startDate)
                context.opacity = max(0, min(1, (duration - elapsed) / Self.fadeDuration))
                draw(in: &context, size: size, elapsed: elapsed)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .ignoresSafeArea()
        .task {
            if !reduceMotion {
                try? await Task.sleep(for: .seconds(duration))
            }
            onFinish()
        }
    }

    private func draw(in context: inout GraphicsContext, size: CGSize, elapsed: Double) {
        var snowflake = context.resolve(Image(systemName: "snowflake"))
        snowflake.shading = .color(snowColor)
        let sparkles = Snowflake.sparkleColors.map { color -> GraphicsContext.ResolvedImage in
            var image = context.resolve(Image(systemName: "sparkle"))
            image.shading = .color(color)
            return image
        }

        for flake in flakes {
            let progress = (elapsed - flake.delay) / flake.fallDuration
            guard progress > 0, progress < 1 else { continue }

            let x = flake.x * size.width + sin(elapsed * flake.swaySpeed + flake.phase) * flake.swayAmount
            let y = -20 + progress * (size.height + 40)
            let rect = CGRect(x: x - flake.size / 2, y: y - flake.size / 2, width: flake.size, height: flake.size)

            var layer = context
            layer.opacity = flake.opacity
            switch flake.kind {
            case .dot:
                layer.fill(Path(ellipseIn: rect), with: .color(snowColor))
            case .crystal:
                layer.translateBy(x: x, y: y)
                layer.rotate(by: .degrees(elapsed * flake.spin))
                layer.draw(snowflake, in: rect.offsetBy(dx: -x, dy: -y))
            case .sparkle(let index):
                layer.draw(sparkles[index], in: rect)
            }
        }
    }

    /// White snow vanishes on light backgrounds, so light mode uses a soft icy blue.
    private var snowColor: Color {
        colorScheme == .dark ? .white : Color(red: 0.6, green: 0.75, blue: 0.9)
    }
}

/// Randomized parameters for a single flake.
private struct Snowflake {
    enum Kind {
        case dot
        case crystal
        case sparkle(Int)
    }

    static let sparkleColors: [Color] = [
        Color(red: 0.84, green: 0.2, blue: 0.22),
        Color(red: 0.9, green: 0.7, blue: 0.2),
        .brandGreen,
    ]

    let kind: Kind
    let x: Double = .random(in: 0...1)
    let size: CGFloat
    let opacity: Double
    let delay: Double = .random(in: 0...2.5)
    let fallDuration: Double = .random(in: 4...6.5)
    let swayAmount: Double = .random(in: 8...26)
    let swaySpeed: Double = .random(in: 0.8...1.8)
    let phase: Double = .random(in: 0...(2 * .pi))
    let spin: Double = .random(in: -40...40)

    init() {
        switch Double.random(in: 0...1) {
        case ..<0.55:
            kind = .dot
            size = .random(in: 3...7)
            opacity = .random(in: 0.5...0.9)
        case ..<0.9:
            kind = .crystal
            size = .random(in: 10...18)
            opacity = .random(in: 0.7...1)
        default:
            kind = .sparkle(Int.random(in: 0..<Self.sparkleColors.count))
            size = .random(in: 9...14)
            opacity = .random(in: 0.8...1)
        }
    }
}

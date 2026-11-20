import SwiftUI

/// A gentle holiday snowfall overlay.
///
/// Snowflakes drift down with a soft side-to-side sway, mixed with a few red,
/// gold and green sparkles, while Santa's sleigh and reindeer fly across to a
/// sleigh-bells jingle. It plays for a few seconds, fades out, then calls
/// `onFinish`. Non-interactive, and renders nothing under Reduce Motion.
struct SnowfallView: View {
    /// Total length of the effect, including the fade-out, in seconds.
    let duration: Double
    /// Called once the effect has fully faded out.
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    // Seeded with real values (not filled in later from `.task`): a Canvas inside
    // TimelineView keeps the values it first captured. As @State they also survive
    // the parent re-creating this view mid-effect, which would otherwise restart it.
    @State private var flakes: [Snowflake]
    @State private var startDate = Date.now
    @State private var bells = SleighBellsPlayer()

    private static let fadeDuration = 1.4

    /// Creates a snowfall of `count` flakes lasting `duration` seconds.
    init(duration: Double = 7, count: Int = 90, onFinish: @escaping () -> Void = {}) {
        self.duration = duration
        self.onFinish = onFinish
        _flakes = State(initialValue: (0..<count).map { _ in Snowflake() })
    }

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                guard !reduceMotion else { return }
                let elapsed = timeline.date.timeIntervalSince(startDate)
                context.opacity = max(0, min(1, (duration - elapsed) / Self.fadeDuration))
                draw(in: &context, size: size, elapsed: elapsed)
                SantaSleighTeam.draw(in: &context, size: size, elapsed: elapsed)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .ignoresSafeArea()
        .task {
            if !reduceMotion {
                bells.play()
                try? await Task.sleep(for: .seconds(duration))
            }
            onFinish()
        }
        .onDisappear { bells.stop() }
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

/// Santa's sleigh pulled by four galloping reindeer (Rudolph leading), flying
/// left to right across the upper part of the screen.
private enum SantaSleighTeam {
    static let start = 0.6
    static let crossDuration = 5.0

    private static let sleighSize = CGSize(width: 78, height: 50)
    private static let reindeerSize = CGSize(width: 48, height: 38)
    private static let reindeerCount = 4
    private static let firstReindeerX: CGFloat = 74
    private static let reindeerSpacing: CGFloat = 40
    private static let teamWidth = firstReindeerX + CGFloat(reindeerCount - 1) * reindeerSpacing + reindeerSize.width

    static func draw(in context: inout GraphicsContext, size: CGSize, elapsed: Double) {
        let progress = (elapsed - start) / crossDuration
        guard progress > 0, progress < 1 else { return }

        let sleigh = context.resolve(Image("SantaSleigh"))
        let reindeer = context.resolve(Image("Reindeer"))

        // The team climbs gently as it crosses, with a slight upward tilt to match.
        let x = -teamWidth + progress * (size.width + teamWidth + 20)
        let y = size.height * 0.3 + 30 - progress * 60
        var team = context
        team.translateBy(x: x, y: y)
        team.rotate(by: .radians(-0.08))

        let sleighBob = sin(elapsed * 5) * 1.2
        let hand = CGPoint(x: sleighSize.width * 0.585, y: sleighSize.height * 0.31 + sleighBob)
        let reindeerRects = (0..<reindeerCount).map { index in
            let gallop = sin(elapsed * 10 + Double(index) * 1.1) * 2.5
            return CGRect(
                x: firstReindeerX + CGFloat(index) * reindeerSpacing,
                y: -10 - CGFloat(index) * 4 + gallop,
                width: reindeerSize.width,
                height: reindeerSize.height
            )
        }

        var reins = Path()
        reins.move(to: hand)
        for rect in reindeerRects {
            reins.addLine(to: CGPoint(x: rect.minX + rect.width * 0.62, y: rect.minY + rect.height * 0.55))
        }
        team.stroke(reins, with: .color(Color(red: 0.36, green: 0.23, blue: 0.12)), lineWidth: 1)
        team.draw(sleigh, in: CGRect(origin: CGPoint(x: 0, y: sleighBob), size: sleighSize))
        for rect in reindeerRects {
            team.draw(reindeer, in: rect)
        }

        if let lead = reindeerRects.last {
            let nose = CGPoint(x: lead.minX + lead.width * 0.9, y: lead.minY + lead.height * 0.29)
            let red = Color(red: 0.88, green: 0.22, blue: 0.24)
            team.fill(Path(ellipseIn: CGRect(x: nose.x - 5, y: nose.y - 5, width: 10, height: 10)), with: .color(red.opacity(0.3)))
            team.fill(Path(ellipseIn: CGRect(x: nose.x - 2.4, y: nose.y - 2.4, width: 4.8, height: 4.8)), with: .color(red))
        }
    }
}

import SwiftUI

/// A lightweight, self-contained confetti celebration overlay.
///
/// Pure SwiftUI (no SpriteKit), so it's cheap to drop onto any screen as an
/// overlay. Colorful pieces fall from the top with random color, size, shape,
/// drift and spin, play for a few seconds, then the whole overlay fades out.
/// It is non-interactive (`allowsHitTesting(false)`) so it never blocks the UI
/// beneath it, and it respects Reduce Motion by rendering nothing.
struct ConfettiView: View {
    /// How long pieces keep falling before the overlay fades out, in seconds.
    var duration: Double = 3.5
    /// Number of confetti pieces.
    var count: Int = 70

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var pieces: [ConfettiPiece] = []
    @State private var falling = false
    @State private var opacity: Double = 1

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ForEach(pieces) { piece in
                    ConfettiPieceView(
                        piece: piece,
                        falling: falling,
                        size: geo.size
                    )
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .opacity(opacity)
        .allowsHitTesting(false)
        .ignoresSafeArea()
        .onAppear {
            guard !reduceMotion else { return }
            pieces = (0..<count).map { _ in ConfettiPiece() }
            falling = true
            // Let the pieces fall, then fade the whole layer out gracefully.
            withAnimation(.easeOut(duration: 0.8).delay(duration)) {
                opacity = 0
            }
        }
    }
}

/// Immutable randomized parameters for a single confetti piece.
private struct ConfettiPiece: Identifiable {
    let id = UUID()
    let xStart: Double = .random(in: 0.0...1.0)
    let drift: CGFloat = .random(in: -50...50)
    let color: Color = ConfettiPiece.palette.randomElement() ?? .green
    let width: CGFloat = .random(in: 6...11)
    let heightRatio: CGFloat = .random(in: 0.5...1.4)
    let delay: Double = .random(in: 0...0.8)
    let fallDuration: Double = .random(in: 2.2...3.4)
    let spins: Double = .random(in: -4...4)
    let shape: Int = Int.random(in: 0...2)

    static let palette: [Color] = [
        .red, .orange, .yellow, .green, .blue, .purple, .pink, .mint, .brandGreen,
    ]
}

/// Renders and animates one confetti piece from above the screen to below it.
private struct ConfettiPieceView: View {
    let piece: ConfettiPiece
    let falling: Bool
    let size: CGSize

    var body: some View {
        shape
            .frame(width: piece.width, height: piece.width * piece.heightRatio)
            .rotationEffect(.degrees(falling ? piece.spins * 360 : 0))
            .position(
                x: piece.xStart * size.width + (falling ? piece.drift : 0),
                y: falling ? size.height + 40 : -40
            )
            .animation(
                .easeIn(duration: piece.fallDuration).delay(piece.delay),
                value: falling
            )
    }

    @ViewBuilder
    private var shape: some View {
        switch piece.shape {
        case 0: Rectangle().fill(piece.color)
        case 1: Circle().fill(piece.color)
        default: Capsule().fill(piece.color)
        }
    }
}

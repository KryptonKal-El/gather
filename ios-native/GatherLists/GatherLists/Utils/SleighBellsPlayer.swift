import AVFoundation

/// Plays the sleigh-bells jingle that accompanies the holiday snowfall.
///
/// Uses the `.ambient` audio session category, so it stays silent when the
/// Ring/Silent switch is on and mixes with (rather than stops) any music playing.
@MainActor
final class SleighBellsPlayer {
    private var player: AVAudioPlayer?

    /// Starts the jingle. Failures are logged and otherwise ignored; the effect is decorative.
    func play() {
        guard let url = Bundle.main.url(forResource: "sleigh-bells", withExtension: "m4a", subdirectory: "Sounds") else {
            print("SleighBellsPlayer: sleigh-bells.m4a missing from bundle")
            return
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, options: .mixWithOthers)
            try AVAudioSession.sharedInstance().setActive(true)
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = 0.7
            player.play()
            self.player = player
        } catch {
            print("SleighBellsPlayer: couldn't play sleigh bells: \(error)")
        }
    }

    /// Stops the jingle if it is still playing.
    func stop() {
        player?.stop()
        player = nil
    }
}

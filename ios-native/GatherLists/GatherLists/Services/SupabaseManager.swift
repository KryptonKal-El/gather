import Foundation
import Realtime
import Supabase
import UIKit
import WidgetKit

/// Singleton manager that initializes and provides access to the Supabase client.
@MainActor
final class SupabaseManager {
    static let shared = SupabaseManager()
    
    let client: SupabaseClient
    let supabaseURL: URL
    let anonKey: String
    
    nonisolated(unsafe) private var authSyncTask: Task<Void, Never>?
    
    private init() {
        guard let path = Bundle.main.path(forResource: "Secrets", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path),
              let urlString = dict["SUPABASE_URL"] as? String,
              let anonKey = dict["SUPABASE_ANON_KEY"] as? String,
              let url = URL(string: urlString) else {
            fatalError("Missing or invalid Secrets.plist — copy Secrets.plist.example to Secrets.plist and fill in your Supabase credentials")
        }
        
        supabaseURL = url
        self.anonKey = anonKey
        client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
        
        // Store Supabase config in shared container for widget access
        SharedDefaults.saveSupabaseConfig(url: urlString, anonKey: anonKey)
        
        startAuthSessionSync()
    }

    /// Bearer token for direct edge function calls: the signed-in user's access
    /// token, so the function can attribute the call to them, or the anon key
    /// when signed out.
    func edgeFunctionToken() async -> String {
        (try? await client.auth.session.accessToken) ?? anonKey
    }
    
    /// Listens to auth state changes and syncs tokens to the shared App Group container.
    private func startAuthSessionSync() {
        authSyncTask = Task {
            for await (event, session) in client.auth.authStateChanges {
                switch event {
                case .signedIn, .tokenRefreshed, .initialSession:
                    if let session {
                        SharedDefaults.saveAuthSession(
                            accessToken: session.accessToken,
                            refreshToken: session.refreshToken,
                            userId: session.user.id.uuidString
                        )
                    }
                case .signedOut:
                    SharedDefaults.clearAuthSession()
                    Task { await SharedDataStore.shared.clearAll() }
                    WidgetCenter.shared.reloadAllTimelines()
                default:
                    break
                }
            }
        }
    }
}

/// Owns the realtime channels for one screen: subscribes with retry, refetches after any gap in
/// the connection, and tears everything down when the owning object goes away.
///
/// Realtime never replays changes made while the socket was down, so `start(onCatchUp:)` runs the
/// catch-up closure whenever a channel rejoins and whenever the app returns to the foreground.
/// Closures passed in must capture their owner weakly, or the owner can never be released.
@MainActor
final class RealtimeSubscriptions {
    private static let subscribeRetryDelay: Duration = .seconds(5)

    private let label: String
    /// The client hands back the same channel for a repeated topic, so two live owners sharing a
    /// topic would have one's teardown silence the other.
    private let suffix = UUID().uuidString
    private var channels: [RealtimeChannelV2] = []
    private var tasks: [Task<Void, Never>] = []

    /// Whether `start(onCatchUp:)` has already run.
    private(set) var isStarted = false

    /// - Parameter label: Prefix for log lines, usually the owning type's name.
    init(label: String) {
        self.label = label
    }

    /// Creates a channel private to this owner. Register its changes with `on(_:perform:)`
    /// before calling `start(onCatchUp:)`.
    func channel(_ name: String) -> RealtimeChannelV2 {
        let channel = SupabaseManager.shared.client.realtimeV2.channel("\(name)-\(suffix)")
        channels.append(channel)
        return channel
    }

    /// Runs `action` for every change delivered on `changes`.
    func on(_ changes: AsyncStream<AnyAction>, perform action: @escaping @MainActor () async -> Void) {
        tasks.append(Task {
            for await _ in changes {
                await action()
            }
        })
    }

    /// Subscribes every channel, retrying until each joins, and begins catch-up refetches.
    func start(onCatchUp: @escaping @MainActor () async -> Void) {
        guard !isStarted else { return }
        isStarted = true

        let label = label
        for channel in channels {
            tasks.append(Task {
                while !Task.isCancelled {
                    do {
                        try await channel.subscribeWithError()
                        return
                    } catch {
                        print("[\(label)] Realtime subscription failed, retrying: \(error.localizedDescription)")
                        try? await Task.sleep(for: Self.subscribeRetryDelay)
                    }
                }
            })
        }

        if let channel = channels.first {
            tasks.append(Task {
                var hasSubscribed = false
                for await status in channel.statusChange where status == .subscribed {
                    if hasSubscribed {
                        await onCatchUp()
                    }
                    hasSubscribed = true
                }
            })
        }

        tasks.append(Task {
            let notifications = NotificationCenter.default.notifications(
                named: UIApplication.willEnterForegroundNotification
            )
            for await _ in notifications {
                await onCatchUp()
            }
        })
    }

    /// Cancels all work and removes the channels. Safe to call more than once.
    func stop() {
        Self.tearDown(tasks: tasks, channels: channels)
        tasks = []
        channels = []
        isStarted = false
    }

    deinit {
        Self.tearDown(tasks: tasks, channels: channels)
    }

    private nonisolated static func tearDown(tasks: [Task<Void, Never>], channels: [RealtimeChannelV2]) {
        tasks.forEach { $0.cancel() }
        guard !channels.isEmpty else { return }
        Task { @MainActor in
            let realtime = SupabaseManager.shared.client.realtimeV2
            for channel in channels {
                await realtime.removeChannel(channel)
            }
        }
    }
}

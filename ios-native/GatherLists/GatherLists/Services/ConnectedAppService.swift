import Foundation
import Supabase

/// Lists and revokes the apps connected to the user's account via Supabase
/// Auth's OAuth grants. supabase-swift has no grants API, so this calls the
/// same REST endpoints supabase-js uses, authenticated with the user's session.
struct ConnectedAppService {
    enum ServiceError: LocalizedError {
        case badResponse(status: Int)

        var errorDescription: String? {
            switch self {
            case .badResponse(let status): "The server returned an error (\(status))."
            }
        }
    }

    @MainActor private static var grantsURL: URL {
        SupabaseManager.shared.supabaseURL.appendingPathComponent("auth/v1/user/oauth/grants")
    }

    /// Fetches the user's connected apps, newest first.
    static func fetchConnectedApps() async throws -> [ConnectedApp] {
        let request = try await authorizedRequest(url: await grantsURL, method: "GET")
        let (data, response) = try await URLSession.shared.data(for: request)
        try check(response)
        let grants = try JSONDecoder().decode([OAuthGrantDTO].self, from: data)
        return grants
            .map { grant in
                ConnectedApp(
                    clientId: grant.client.id,
                    name: grant.client.name?.isEmpty == false ? grant.client.name! : "Unnamed app",
                    scopes: grant.scopes ?? [],
                    grantedAt: parseDate(grant.grantedAt) ?? .distantPast
                )
            }
            .sorted { $0.grantedAt > $1.grantedAt }
    }

    /// Revokes an app's access. Supabase ends its sessions and invalidates its
    /// refresh tokens, so the app must ask for consent again to reconnect.
    static func disconnect(clientId: String) async throws {
        var components = URLComponents(url: await grantsURL, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "client_id", value: clientId)]
        let request = try await authorizedRequest(url: components.url!, method: "DELETE")
        let (_, response) = try await URLSession.shared.data(for: request)
        try check(response)
    }

    private static func authorizedRequest(url: URL, method: String) async throws -> URLRequest {
        let manager = await SupabaseManager.shared
        let session = try await manager.client.auth.session
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(manager.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        return request
    }

    private static func check(_ response: URLResponse) throws {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw ServiceError.badResponse(status: status) }
    }

    private static func parseDate(_ value: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

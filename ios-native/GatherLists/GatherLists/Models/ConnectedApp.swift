import Foundation

/// An app the user has connected to their account through Gather's OAuth
/// server (e.g. Claude via the MCP server), mapped from a Supabase Auth OAuth grant.
struct ConnectedApp: Identifiable, Hashable {
    let clientId: String
    let name: String
    let scopes: [String]
    let grantedAt: Date

    var id: String { clientId }
}

/// Wire shape of `GET /auth/v1/user/oauth/grants`.
struct OAuthGrantDTO: Decodable {
    struct Client: Decodable {
        let id: String
        let name: String?
    }

    let client: Client
    let scopes: [String]?
    let grantedAt: String

    enum CodingKeys: String, CodingKey {
        case client
        case scopes
        case grantedAt = "granted_at"
    }
}

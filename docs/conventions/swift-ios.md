# Swift / iOS Conventions

Applies to `ios-native/GatherLists/`.

## ViewModels

```swift
@Observable @MainActor final class ListDetailViewModel {
    // MARK: - Properties
    var items: [Item] = []
    var isLoading = false
    var error: Error?

    // MARK: - Private State
    @ObservationIgnored private var runtime = RuntimeState()
}

private final class RuntimeState {
    var itemsChannel: RealtimeChannelV2?
    var itemsTask: Task<Void, Never>?
    // … other subscription Task handles and channel references
}
```

- `@Observable @MainActor final class` for every ViewModel.
- A private inner `RuntimeState` class (marked `@ObservationIgnored`) holds subscription `Task` handles and realtime channels, keeping mutable subscription state from triggering observation updates.

## Services

```swift
struct StoreService {
    static func fetchStores(for userId: String) async throws -> [Store] { … }
}
```

- Services are `struct` with `static` methods — no instance state.
- Private DTOs (structs with `CodingKeys`) are defined inside the service file, not exported.

## Offline-First

1. Load from `OfflineCache` before issuing a Supabase fetch.
2. Update the cache after a successful fetch.
3. Surface the cached value immediately so the UI is never blank while the network call is in flight.

## Concurrent Fetches

Use `async let` for parallel Supabase calls instead of sequential `await`:

```swift
async let lists = ListService.fetchLists(for: userId)
async let stores = StoreService.fetchStores(for: userId)
let (resolvedLists, resolvedStores) = try await (lists, stores)
```

## Section Dividers

Use `MARK: -` to divide code into named sections:

```swift
// MARK: - Public Methods
// MARK: - Private Helpers
// MARK: - Errors
```

## Doc Comments

Use `/// ` (triple-slash) for documentation comments on every public method:

```swift
/// Fetches all stores for the given user, updating the offline cache.
/// - Parameter userId: The authenticated user's ID.
func loadStores(userId: String) async { … }
```

## Typed Error Enums

Define errors as a typed `enum` conforming to `Error` and `LocalizedError` in a `MARK: - Errors` section inside the service or ViewModel file:

```swift
// MARK: - Errors
enum StoreServiceError: Error, LocalizedError {
    case fetchFailed(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .fetchFailed(let err): return "Failed to fetch stores: \(err.localizedDescription)"
        }
    }
}
```

## Widget Sync

After mutating data, trigger a widget sync so home-screen widgets stay up to date.

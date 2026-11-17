# iOS list detail: pull-to-refresh did nothing, collaborator changes went missing

File: `ios-native/GatherLists/GatherLists/ViewModels/ListDetailViewModel.swift`

## Pull-to-refresh cancelled its own fetch

`refresh()` called `loadData()`, which set `isLoading = true`. `ListDetailView` swaps the
`List` for the loading state whenever `isLoading` is true, so the list that owned the
`.refreshable` task was torn down mid-refresh. SwiftUI cancelled the task, the in-flight
fetches threw, and the stale items stayed on screen.

**Rule:** a refresh of data that is already on screen must never flip the flag that replaces
the scroll view. `isLoading` is for the first load only (`loadData(showsLoading:)`). `refresh()`
also runs its work in its own `Task` so a re-render cannot cancel it.

## Realtime does not replay missed events

Supabase Realtime only delivers changes while the socket is up. supabase-swift reconnects and
rejoins channels on foreground by itself (`handleAppLifecycle`), but anything a collaborator
did while the phone was locked, backgrounded, or offline is never sent. Nothing refetched, so
the list stayed stale until the app was killed.

**Rule:** every realtime-backed screen needs a catch-up refetch on (a) channel re-join
(`channel.statusChange` reaching `.subscribed` a second time) and (b)
`UIApplication.willEnterForegroundNotification`.

## Use `RealtimeSubscriptions` for every realtime screen

`RealtimeSubscriptions` (bottom of `Services/SupabaseManager.swift`, kept there because the
project has no synced folders and a new file needs pbxproj edits) does all of this. Lists,
list detail, stores, recipes, meal plan and the preferences manager all use it:

```swift
let channel = realtime.channel("list-items-\(listId)")
realtime.on(channel.postgresChange(AnyAction.self, schema: "public", table: "items")) { [weak self] in
    await self?.refetchItems()
}
realtime.start { [weak self] in await self?.refresh() }   // catch-up closure
```

What it handles, and why each matters:

- **Subscribe retry.** `subscribeWithError()` gives up after the library's retry limit; the
  old code then `return`ed, leaving the screen with no realtime for its whole life.
- **Weak owners.** The old tasks captured `self` strongly, so view models never
  deinitialised and every list ever opened kept refetching on each `items` change. Closures
  passed to the helper must use `[weak self]`.
- **Per-owner topics.** `realtimeV2.channel(name)` returns the **same** channel object for a
  repeated topic (two `RecipeViewModel`s exist at once: Recipes tab and Plan tab). One
  owner's teardown would silence the other, so the helper suffixes every topic and removes
  its channels with `removeChannel` when the owner is released.
- **Register before `start`.** Channels created after `start(onCatchUp:)` are not subscribed.

No row filters on non-PK columns anywhere on iOS now (replica identity is still default on
every table, checked 2026-11-17) - see `supabase-realtime-replica-identity.md`. The only
filter left is `user_preferences.user_id`, which is that table's primary key.

Lists overview item counts need no `items` subscription: a DB trigger keeps
`lists.item_count` current, so every item add/remove arrives as a `lists` UPDATE (verified
live on the simulator, 2026-11-17). That only works with the row filter off.

`ListDetailView.subscribeToPreferences()` holds its helper in `@State` and calls `stop()` in
`onDisappear`; a view struct has no deinit, so nothing else would release it.

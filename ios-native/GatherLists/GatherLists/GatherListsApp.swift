import SwiftUI

@main
struct GatherListsApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .task {
                    // Smoke test: verify Supabase client is initialized
                    _ = SupabaseManager.shared.client
                    print("[GatherLists] Supabase client initialized successfully")
                }
        }
    }
}

struct ContentView: View {
    var body: some View {
        VStack {
            Text("Hello, Gather Lists!")
                .font(.title)
        }
        .padding()
    }
}

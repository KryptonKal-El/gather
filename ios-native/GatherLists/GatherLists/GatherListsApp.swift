import SwiftUI

@main
struct GatherListsApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
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

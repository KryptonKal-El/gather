import SwiftUI

@main
struct GatherListsApp: App {
    @State private var authViewModel = AuthViewModel()
    
    var body: some Scene {
        WindowGroup {
            Group {
                if authViewModel.isLoading {
                    ProgressView("Loading...")
                } else if authViewModel.isAuthenticated {
                    MainTabView()
                        .environment(authViewModel)
                } else {
                    LoginPlaceholderView()
                        .environment(authViewModel)
                }
            }
        }
    }
}

struct MainTabView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Authenticated! Welcome.")
                .font(.title)
            
            Button("Sign Out") {
                Task {
                    await authViewModel.signOut()
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

struct LoginPlaceholderView: View {
    var body: some View {
        VStack {
            Text("Login View")
                .font(.title)
        }
        .padding()
    }
}

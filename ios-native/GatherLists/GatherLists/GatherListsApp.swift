import SwiftUI

@main
struct GatherListsApp: App {
    @State private var authViewModel = AuthViewModel()
    @State private var networkMonitor = NetworkMonitor()
    private var appearanceManager = AppearanceManager.shared
    
    var body: some Scene {
        WindowGroup {
            Group {
                if authViewModel.isLoading {
                    ProgressView("Loading...")
                } else if authViewModel.isAuthenticated {
                    MainTabView()
                        .environment(authViewModel)
                } else {
                    LoginView()
                        .environment(authViewModel)
                }
            }
            .environment(networkMonitor)
            .environment(appearanceManager)
            .preferredColorScheme(appearanceManager.setting.colorScheme)
        }
    }
}

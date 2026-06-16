import SwiftUI

struct MainTabView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(NetworkMonitor.self) private var networkMonitor
    @Environment(NotificationService.self) private var notificationService
    @Environment(ToastController.self) private var toastController
    // Persist the selected tab so a relaunch returns to the same section.
    @AppStorage("gather.selectedTab") private var selectedTab = 0
    
    
    var body: some View {
        VStack(spacing: 0) {
            if !networkMonitor.isConnected {
                HStack {
                    Image(systemName: "wifi.slash")
                    Text("No Internet Connection")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.orange)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            
            TabView(selection: $selectedTab) {
                ListBrowserView()
                    .environment(authViewModel)
                    .tabItem {
                        Label("Lists", systemImage: "list.bullet")
                    }
                    .tag(0)
                
                CollectionBrowserView()
                    .environment(authViewModel)
                    .tabItem {
                        Label("Recipes", systemImage: "book")
                    }
                    .tag(1)
                
                SettingsView()
                    .environment(authViewModel)
                    .tabItem {
                        Label("Settings", systemImage: "gearshape")
                    }
                    .tag(2)
            }
            .tint(Color.brandGreen)
        }
        .animation(.easeInOut, value: networkMonitor.isConnected)
        .safeAreaInset(edge: .bottom) {
            if let message = toastController.message {
                ToastBanner(message: message, variant: toastController.variant)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .animation(.easeInOut(duration: 0.22), value: toastController.message != nil)
        .onChange(of: notificationService.pendingListId) { _, listId in
            if listId != nil {
                selectedTab = 0
            }
        }
    }
}


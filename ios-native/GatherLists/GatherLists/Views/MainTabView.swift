import SwiftUI

struct MainTabView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(NetworkMonitor.self) private var networkMonitor
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
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
            
            TabView {
                ListBrowserView()
                    .environment(authViewModel)
                    .tabItem {
                        Label("Lists", systemImage: "list.bullet")
                    }
                
                CollectionBrowserView()
                    .environment(authViewModel)
                    .tabItem {
                        Label("Recipes", systemImage: "book")
                    }
                
                StoreBrowserView()
                    .environment(authViewModel)
                    .tabItem {
                        Label("Stores", systemImage: "storefront")
                    }
                
                SettingsView()
                    .environment(authViewModel)
                    .tabItem {
                        Label("Settings", systemImage: "gearshape")
                    }
            }
            .tint(brandGreen)
        }
        .animation(.easeInOut, value: networkMonitor.isConnected)
    }
}



import SwiftUI

struct MainTabView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    var body: some View {
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
}



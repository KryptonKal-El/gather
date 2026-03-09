import SwiftUI

struct MainTabView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    var body: some View {
        TabView {
            ListsPlaceholderView()
                .tabItem {
                    Label("Lists", systemImage: "list.bullet")
                }
            
            RecipesPlaceholderView()
                .tabItem {
                    Label("Recipes", systemImage: "book")
                }
            
            StoresPlaceholderView()
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

struct ListsPlaceholderView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Image(systemName: "list.bullet")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("Lists — Coming Soon")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Lists")
        }
    }
}

struct RecipesPlaceholderView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Image(systemName: "book")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("Recipes — Coming Soon")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Recipes")
        }
    }
}

struct StoresPlaceholderView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Image(systemName: "storefront")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("Stores — Coming Soon")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Stores")
        }
    }
}

import SwiftUI
import UIKit
import UserNotifications
import WidgetKit

class AppDelegate: NSObject, UIApplicationDelegate {
    var notificationService: NotificationService?
    
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in
            await notificationService?.handleDeviceToken(deviceToken)
        }
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        notificationService?.handleRegistrationError(error)
    }
}

@main
struct GatherListsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var authViewModel = AuthViewModel()
    @State private var networkMonitor = NetworkMonitor()
    @State private var notificationService = NotificationService()
    @State private var toastController = ToastController()
    @Environment(\.scenePhase) private var scenePhase
    private var appearanceManager = AppearanceManager.shared

    init() {
        Self.applyBrandTypography()
    }

    /// Navigation and tab bars draw their text through UIKit appearance proxies,
    /// which SwiftUI's `.font` environment does not reach.
    private static func applyBrandTypography() {
        let navAppearance = UINavigationBar.appearance()
        navAppearance.largeTitleTextAttributes = [.font: UIFont.quicksand(size: 34, weight: .bold)]
        navAppearance.titleTextAttributes = [.font: UIFont.quicksand(size: 17, weight: .semibold)]

        let barButtonAttributes: [NSAttributedString.Key: Any] = [.font: UIFont.quicksand(size: 17, weight: .medium)]
        let barButtonAppearance = UIBarButtonItem.appearance()
        barButtonAppearance.setTitleTextAttributes(barButtonAttributes, for: .normal)
        barButtonAppearance.setTitleTextAttributes(barButtonAttributes, for: .highlighted)

        let tabItemAppearance = UITabBarItem.appearance()
        tabItemAppearance.setTitleTextAttributes([.font: UIFont.quicksand(size: 10, weight: .medium)], for: .normal)
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if authViewModel.isLoading {
                    ProgressView("Loading...")
                } else if authViewModel.isAuthenticated {
                    MainTabView()
                        .environment(authViewModel)
                        .task {
                            await notificationService.refreshTokenIfNeeded()
                            await updateUserTimezone()
                        }
                } else {
                    LoginView()
                        .environment(authViewModel)
                }
            }
            .environment(networkMonitor)
            .environment(appearanceManager)
            .environment(notificationService)
            .environment(toastController)
            .environment(\.font, .quicksand(.body))
            .preferredColorScheme(appearanceManager.setting.colorScheme)
            .onAppear {
                appDelegate.notificationService = notificationService
                authViewModel.notificationService = notificationService
                UNUserNotificationCenter.current().delegate = notificationService
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    notificationService.clearBadge()
                }
            }
            .onOpenURL { url in
                handleDeepLink(url)
            }
        }
    }
    
    /// Routes deep link URLs to the appropriate handler.
    private func handleDeepLink(_ url: URL) {
        let scheme = url.scheme?.lowercased() ?? ""
        
        // Handle gatherlists:// widget deep links
        if scheme == "gatherlists" {
            handleWidgetDeepLink(url)
            return
        }
        
        // Handle gather:// auth deep links (OAuth callbacks, email confirmation)
        if scheme == "gather" {
            let urlString = url.absoluteString
            let isAuthCallback = urlString.contains("auth/callback") || urlString.contains("#access_token")
            
            if isAuthCallback {
                Task {
                    await authViewModel.handleDeepLink(url: url)
                }
            } else {
                // Could be a gather:// widget-style link too
                handleWidgetDeepLink(url)
            }
        }
    }
    
    /// Handles widget deep links (e.g., gatherlists://list/{listId}).
    private func handleWidgetDeepLink(_ url: URL) {
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let components = path.split(separator: "/")

        // Handle gatherlists://recipe/{recipeId} (tapping the cook Live Activity)
        if url.host == "recipe" || (components.count >= 1 && components[0] == "recipe") {
            let recipeIdString: String
            if url.host == "recipe" {
                recipeIdString = path
            } else if components.count >= 2 {
                recipeIdString = String(components[1])
            } else {
                return
            }
            if let recipeId = UUID(uuidString: recipeIdString) {
                notificationService.pendingRecipeId = recipeId
            }
            return
        }

        // Handle gatherlists://list/{listId}
        if url.host == "list" || (components.count >= 1 && components[0] == "list") {
            let listIdString: String
            if url.host == "list" {
                listIdString = path
            } else if components.count >= 2 {
                listIdString = String(components[1])
            } else {
                return
            }
            
            if let listId = UUID(uuidString: listIdString) {
                notificationService.pendingListId = listId
            }
        }
    }
    
    private func updateUserTimezone() async {
        guard let userId = authViewModel.currentUser?.id else { return }
        do {
            try await ProfileService.updateTimezone(userId: userId)
        } catch {
            print("Failed to update timezone: \(error)")
        }
    }
}

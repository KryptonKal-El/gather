import SwiftUI
import UIKit
import UserNotifications

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
    @Environment(\.scenePhase) private var scenePhase
    private var appearanceManager = AppearanceManager.shared
    
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
                        }
                } else {
                    LoginView()
                        .environment(authViewModel)
                }
            }
            .environment(networkMonitor)
            .environment(appearanceManager)
            .environment(notificationService)
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
                Task {
                    await authViewModel.handleDeepLink(url: url)
                }
            }
        }
    }
}

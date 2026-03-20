import Foundation
import UserNotifications
import UIKit
import Supabase

@Observable
@MainActor
final class NotificationService: NSObject {
    var permissionGranted = false
    var deviceToken: String?
    
    /// List ID from a tapped notification, consumed by ListBrowserView for deep linking.
    var pendingListId: UUID?
    
    private var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Request notification permission from the user.
    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            permissionGranted = granted
            if granted {
                UIApplication.shared.registerForRemoteNotifications()
            }
            return granted
        } catch {
            print("[NotificationService] Permission request failed: \(error.localizedDescription)")
            return false
        }
    }
    
    /// Check current permission status.
    func checkPermissionStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        permissionGranted = settings.authorizationStatus == .authorized
    }
    
    /// Handle device token from APNs registration. Upserts to device_tokens table.
    func handleDeviceToken(_ tokenData: Data) async {
        let tokenString = tokenData.map { String(format: "%02x", $0) }.joined()
        deviceToken = tokenString
        
        guard let userId = try? await client.auth.session.user.id else {
            print("[NotificationService] No authenticated user, skipping token upsert")
            return
        }
        
        do {
            let upsertData = DeviceTokenUpsert(userId: userId, token: tokenString)
            try await client
                .from("device_tokens")
                .upsert(upsertData, onConflict: "user_id,token")
                .execute()
            print("[NotificationService] Device token upserted successfully")
        } catch {
            print("[NotificationService] Failed to upsert device token: \(error.localizedDescription)")
        }
    }
    
    /// Handle APNs registration failure.
    func handleRegistrationError(_ error: Error) {
        print("[NotificationService] APNs registration failed: \(error.localizedDescription)")
    }
    
    /// Refresh token on app launch if permission was previously granted.
    func refreshTokenIfNeeded() async {
        await checkPermissionStatus()
        if permissionGranted {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
    
    /// Clean up device tokens on sign-out.
    func cleanupOnSignOut() async {
        guard let userId = try? await client.auth.session.user.id else { return }
        
        do {
            try await client
                .from("device_tokens")
                .delete()
                .eq("user_id", value: userId.uuidString)
                .execute()
            deviceToken = nil
            print("[NotificationService] Device tokens cleaned up on sign-out")
        } catch {
            print("[NotificationService] Failed to cleanup device tokens: \(error.localizedDescription)")
        }
    }
    
    /// Clear badge count when app becomes active.
    func clearBadge() {
        UNUserNotificationCenter.current().setBadgeCount(0) { _ in }
    }
    
    // MARK: - DTO
    
    private struct DeviceTokenUpsert: Encodable {
        let userId: UUID
        let token: String
        let platform: String = "ios"
        
        enum CodingKeys: String, CodingKey {
            case userId = "user_id"
            case token
            case platform
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationService: UNUserNotificationCenterDelegate {
    /// Display notifications as banners when app is in foreground.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }
    
    /// Handle notification tap — extract listId for deep linking.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let listIdString = userInfo["listId"] as? String,
           let listId = UUID(uuidString: listIdString) {
            Task { @MainActor in
                self.pendingListId = listId
            }
        }
        completionHandler()
    }
}

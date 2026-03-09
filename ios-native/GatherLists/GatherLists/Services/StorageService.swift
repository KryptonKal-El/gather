import Foundation
import Supabase
import Storage

/// Service layer wrapping Supabase Storage operations for file uploads.
struct StorageService {
    private static var client: SupabaseClient { SupabaseManager.shared.client }
    
    /// Uploads a recipe image to the `recipe-images` bucket.
    /// - Parameters:
    ///   - userId: The user's UUID (used as the folder path).
    ///   - recipeId: The recipe's UUID (used as the filename).
    ///   - imageData: The raw image data to upload.
    ///   - fileExtension: The file extension (e.g., "jpeg", "png", "webp").
    /// - Returns: The public URL string for the uploaded image.
    static func uploadRecipeImage(
        userId: UUID,
        recipeId: UUID,
        imageData: Data,
        fileExtension: String
    ) async throws -> String {
        let path = "\(userId.uuidString)/\(recipeId.uuidString).\(fileExtension)"
        let contentType = mimeType(for: fileExtension)
        
        let options = FileOptions(
            contentType: contentType,
            upsert: true
        )
        
        _ = try await client.storage
            .from("recipe-images")
            .upload(path, data: imageData, options: options)
        
        return getPublicUrl(bucket: "recipe-images", path: path)
    }
    
    /// Returns the public URL for a file in a storage bucket.
    /// - Parameters:
    ///   - bucket: The storage bucket name.
    ///   - path: The file path within the bucket.
    /// - Returns: The public URL string.
    static func getPublicUrl(bucket: String, path: String) -> String {
        let url = try? client.storage
            .from(bucket)
            .getPublicURL(path: path)
        return url?.absoluteString ?? ""
    }
    
    /// Uploads a profile avatar to the `profile-images` bucket.
    /// Compresses to 256px JPEG at 0.8 quality before upload.
    /// After upload, updates the avatar_url on the profiles table.
    /// - Parameters:
    ///   - userId: The user's UUID.
    ///   - imageData: The raw image data to upload.
    /// - Returns: The public URL string for the uploaded avatar.
    static func uploadProfileImage(userId: UUID, imageData: Data) async throws -> String {
        guard let compressed = ImageCompressor.compress(imageData: imageData, maxDimension: 256, quality: 0.8) else {
            throw StorageServiceError.uploadFailed("Failed to compress profile image")
        }
        
        let path = "\(userId.uuidString)/profile.jpg"
        let options = FileOptions(
            contentType: "image/jpeg",
            upsert: true
        )
        
        _ = try await client.storage
            .from("profile-images")
            .upload(path, data: compressed, options: options)
        
        let publicUrl = getPublicUrl(bucket: "profile-images", path: path)
        
        try await ProfileService.updateAvatarUrl(userId: userId, url: publicUrl)
        
        return publicUrl
    }
    
    /// Derives the MIME type from a file extension.
    private static func mimeType(for fileExtension: String) -> String {
        switch fileExtension.lowercased() {
        case "jpeg", "jpg":
            return "image/jpeg"
        case "png":
            return "image/png"
        case "webp":
            return "image/webp"
        default:
            return "application/octet-stream"
        }
    }
}

// MARK: - Errors

enum StorageServiceError: Error, LocalizedError {
    case uploadFailed(String)
    case invalidUrl
    
    var errorDescription: String? {
        switch self {
        case .uploadFailed(let reason):
            return "Failed to upload file: \(reason)"
        case .invalidUrl:
            return "Failed to construct public URL for file"
        }
    }
}

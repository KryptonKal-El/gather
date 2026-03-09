import UIKit

/// Utility for compressing images before upload.
struct ImageCompressor {
    /// Compresses image data by resizing (if needed) and JPEG-encoding.
    ///
    /// - Parameters:
    ///   - imageData: The raw image data to compress.
    ///   - maxDimension: Maximum width or height. Images larger than this are resized maintaining aspect ratio.
    ///   - quality: JPEG compression quality (0.0 to 1.0).
    /// - Returns: Compressed JPEG data, or nil if the input cannot be decoded as an image.
    static func compress(imageData: Data, maxDimension: CGFloat = 1200, quality: CGFloat = 0.8) -> Data? {
        guard let image = UIImage(data: imageData) else { return nil }
        
        let size = image.size
        var targetSize = size
        
        if size.width > maxDimension || size.height > maxDimension {
            let scale = maxDimension / max(size.width, size.height)
            targetSize = CGSize(width: size.width * scale, height: size.height * scale)
        }
        
        if targetSize != size {
            let renderer = UIGraphicsImageRenderer(size: targetSize)
            let resized = renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: targetSize))
            }
            return resized.jpegData(compressionQuality: quality)
        }
        
        return image.jpegData(compressionQuality: quality)
    }
}

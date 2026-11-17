// Encodes a folder of PNG frames into an H.264 .mov. Usage: swift encode.swift <frames-dir> <output.mov> [fps]
import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

let arguments = CommandLine.arguments
guard arguments.count >= 3 else {
    fatalError("Usage: swift encode.swift <frames-dir> <output.mov> [fps]")
}
let framesURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
let fps = arguments.count > 3 ? Int32(arguments[3]) ?? 30 : 30

let frames = try FileManager.default.contentsOfDirectory(at: framesURL, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard let first = frames.first,
      let firstSource = CGImageSourceCreateWithURL(first as CFURL, nil),
      let firstImage = CGImageSourceCreateImageAtIndex(firstSource, 0, nil) else {
    fatalError("No PNG frames in \(framesURL.path)")
}
let width = firstImage.width
let height = firstImage.height

try? FileManager.default.removeItem(at: outputURL)
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
    ],
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 24_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoMaxKeyFrameIntervalKey: fps,
    ],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
])
writer.add(input)
guard writer.startWriting() else {
    fatalError("Could not start writing: \(String(describing: writer.error))")
}
writer.startSession(atSourceTime: .zero)

let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
for (index, frameURL) in frames.enumerated() {
    guard let source = CGImageSourceCreateWithURL(frameURL as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let pool = adaptor.pixelBufferPool else {
        fatalError("Could not read \(frameURL.lastPathComponent)")
    }
    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
    guard let buffer else { fatalError("Could not allocate a pixel buffer") }

    CVPixelBufferLockBaseAddress(buffer, [])
    let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    )
    context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(buffer, [])

    while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.01)
    }
    let time = CMTime(value: CMTimeValue(index), timescale: fps)
    guard adaptor.append(buffer, withPresentationTime: time) else {
        fatalError("Could not append frame \(index): \(String(describing: writer.error))")
    }
}

input.markAsFinished()
writer.endSession(atSourceTime: CMTime(value: CMTimeValue(frames.count), timescale: fps))
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
finished.wait()
guard writer.status == .completed else {
    fatalError("Encoding failed: \(String(describing: writer.error))")
}
print("Wrote \(frames.count) frames at \(width)x\(height), \(fps) fps to \(outputURL.path)")

import CoreGraphics
import Foundation

/// Ink that follows the luminance of whatever is behind a transparent panel.
/// Pure mapping: wallpaper sampling stays in BlinkApp so this stays AppKit-free.
///
/// Mid-gray ink is banned — on mixed wallpaper it is the unreadable case —
/// so each luma sample snaps to light or dark.
public enum BackdropInk: Sendable {
    public static let lightInk = "rgb(255, 252, 247)"
    public static let darkInk = "rgb(18, 16, 12)"

    /// Map a 0...1 luma to high-contrast ink. Threshold sits at 0.5.
    public static func cssColor(forLuma luma: Double) -> String {
        luma >= 0.5 ? darkInk : lightInk
    }

    /// `lumaTopToBottom` is one sample per vertical slice, top of the panel first.
    public static func cssGradient(lumaTopToBottom: [Double]) -> String {
        guard !lumaTopToBottom.isEmpty else { return "linear-gradient(\(lightInk), \(lightInk))" }
        if lumaTopToBottom.count == 1 {
            let color = cssColor(forLuma: lumaTopToBottom[0])
            return "linear-gradient(\(color), \(color))"
        }
        let n = Double(lumaTopToBottom.count)
        var parts: [String] = []
        parts.reserveCapacity(lumaTopToBottom.count)
        for (index, luma) in lumaTopToBottom.enumerated() {
            let start = Double(index) / n * 100
            let end = Double(index + 1) / n * 100
            let color = cssColor(forLuma: luma)
            parts.append("\(color) \(start)% \(end)%")
        }
        return "linear-gradient(to bottom, \(parts.joined(separator: ", ")))"
    }

    /// Aspect-fill mapping of a panel rect onto a wallpaper image, both in the
    /// same point space, Cocoa origin (bottom-left).
    public static func imageCrop(
        panel: CGRect,
        screen: CGRect,
        imageSize: CGSize
    ) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0, screen.width > 0, screen.height > 0 else {
            return .zero
        }
        let scale = max(screen.width / imageSize.width, screen.height / imageSize.height)
        let drawn = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        let origin = CGPoint(
            x: screen.minX + (screen.width - drawn.width) / 2,
            y: screen.minY + (screen.height - drawn.height) / 2
        )
        return CGRect(
            x: (panel.minX - origin.x) / scale,
            y: (panel.minY - origin.y) / scale,
            width: panel.width / scale,
            height: panel.height / scale
        )
    }
}

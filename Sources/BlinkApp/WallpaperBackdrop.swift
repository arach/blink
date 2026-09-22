import AppKit
import BlinkCore

/// Samples the desktop picture behind a panel — not the live screen, so this
/// never asks for Screen Recording permission. Other windows in front of the
/// wallpaper are ignored; the wallpaper is what a floating note usually sits on.
@MainActor
enum WallpaperBackdrop {
    private static var cachedURL: URL?
    private static var cachedImage: NSImage?

    static func inkFill(behind window: NSWindow) -> String? {
        guard let luma = verticalLuma(behind: window), !luma.isEmpty else { return nil }
        return BackdropInk.cssGradient(lumaTopToBottom: luma)
    }

    static func verticalLuma(behind window: NSWindow, samples: Int = 24) -> [Double]? {
        guard let screen = window.screen ?? NSScreen.main else { return nil }
        guard let image = wallpaperImage(for: screen) else { return nil }
        let crop = BackdropInk.imageCrop(
            panel: window.frame,
            screen: screen.frame,
            imageSize: image.size
        )
        let bounds = CGRect(origin: .zero, size: image.size)
        let src = crop.intersection(bounds)
        guard src.width > 1, src.height > 1 else { return nil }

        let rows = max(samples, 2)
        let cols = 8
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: cols,
            pixelsHigh: rows,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else { return nil }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        NSGraphicsContext.current?.imageInterpolation = .low
        image.draw(
            in: NSRect(x: 0, y: 0, width: cols, height: rows),
            from: src,
            operation: .copy,
            fraction: 1,
            respectFlipped: true,
            hints: nil
        )
        NSGraphicsContext.restoreGraphicsState()

        var luma: [Double] = []
        luma.reserveCapacity(rows)
        // Bitmap row zero is the top row, matching CSS gradient order.
        for row in 0..<rows {
            let y = row
            var sum = 0.0
            var count = 0.0
            for col in 0..<cols {
                guard let color = rep.colorAt(x: col, y: y) else { continue }
                var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
                (color.usingColorSpace(.deviceRGB) ?? color).getRed(&r, green: &g, blue: &b, alpha: &a)
                sum += 0.2126 * Double(r) + 0.7152 * Double(g) + 0.0722 * Double(b)
                count += 1
            }
            luma.append(count > 0 ? sum / count : 0.5)
        }
        return luma
    }

    private static func wallpaperImage(for screen: NSScreen) -> NSImage? {
        guard let url = NSWorkspace.shared.desktopImageURL(for: screen) else { return nil }
        if cachedURL == url, let cachedImage { return cachedImage }
        let image = NSImage(contentsOf: url)
        cachedURL = url
        cachedImage = image
        return image
    }
}

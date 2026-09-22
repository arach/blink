import CoreGraphics
import Testing
@testable import BlinkCore

@Suite("Backdrop ink")
struct BackdropInkTests {
    @Test("Dark wallpaper gets light ink, light wallpaper gets dark ink")
    func lumaSnapsAwayFromMidGray() {
        #expect(BackdropInk.cssColor(forLuma: 0.1) == BackdropInk.lightInk)
        #expect(BackdropInk.cssColor(forLuma: 0.49) == BackdropInk.lightInk)
        #expect(BackdropInk.cssColor(forLuma: 0.5) == BackdropInk.darkInk)
        #expect(BackdropInk.cssColor(forLuma: 0.9) == BackdropInk.darkInk)
    }

    @Test("A vertical strip becomes a CSS linear-gradient, top to bottom")
    func gradientIsTopToBottom() {
        let css = BackdropInk.cssGradient(lumaTopToBottom: [0.8, 0.2])
        #expect(css.hasPrefix("linear-gradient(to bottom, \(BackdropInk.darkInk) 0.0% 50.0%"))
        #expect(css.contains("\(BackdropInk.lightInk) 50.0% 100.0%"))
    }

    @Test("Empty and single samples remain valid CSS images")
    func uniformSamplesAreImages() {
        #expect(BackdropInk.cssGradient(lumaTopToBottom: []).hasPrefix("linear-gradient("))
        #expect(BackdropInk.cssGradient(lumaTopToBottom: [0.8]) == "linear-gradient(\(BackdropInk.darkInk), \(BackdropInk.darkInk))")
    }

    @Test("Aspect-fill crop is identity when the image matches the screen")
    func cropIdentity() {
        let screen = CGRect(x: 0, y: 0, width: 1000, height: 500)
        let panel = CGRect(x: 100, y: 50, width: 200, height: 100)
        let crop = BackdropInk.imageCrop(panel: panel, screen: screen, imageSize: screen.size)
        #expect(crop.origin.x == 100)
        #expect(crop.origin.y == 50)
        #expect(crop.width == 200)
        #expect(crop.height == 100)
    }
}

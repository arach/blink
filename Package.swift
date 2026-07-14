// swift-tools-version: 6.0
import PackageDescription

// Hudson is consumed from the sibling checkout by default (same convention as
// Scout). Set BLINK_HUDSON_SOURCE=git to resolve it from GitHub instead.
let hudsonSource = Context.environment["BLINK_HUDSON_SOURCE"] ?? "path"
let hudsonDependency: Package.Dependency = hudsonSource == "git"
    ? .package(url: "git@github.com:arach/hudson.git", branch: "main")
    : .package(path: "../hudson")

let package = Package(
    name: "Blink",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "BlinkApp", targets: ["BlinkApp"]),
        .library(name: "BlinkCore", targets: ["BlinkCore"]),
    ],
    dependencies: [
        hudsonDependency
    ],
    targets: [
        .executableTarget(
            name: "BlinkApp",
            dependencies: [
                "BlinkCore",
                .product(name: "HudsonUI", package: "hudson"),
                .product(name: "HudsonShell", package: "hudson"),
                .product(name: "HudsonObservability", package: "hudson"),
            ],
            path: "Sources/BlinkApp"
        ),
        .target(
            name: "BlinkCore",
            path: "Sources/BlinkCore"
        ),
        .testTarget(
            name: "BlinkCoreTests",
            dependencies: ["BlinkCore"],
            path: "Tests/BlinkCoreTests"
        ),
    ]
)

import Foundation
import Testing
@testable import BlinkCore

@Suite("Source references")
struct SourceReferenceTests {
    @Test("Portable locator parses and canonicalizes line and revision anchors")
    func locatorRoundTrip() throws {
        let reference = try #require(
            SourceReference(locator: "blink/Sources/BlinkCore/Note.swift#L12-L28@76fc2d1")
        )
        #expect(reference.root == "blink")
        #expect(reference.path == "Sources/BlinkCore/Note.swift")
        #expect(reference.lines?.start == 12)
        #expect(reference.lines?.end == 28)
        #expect(reference.revision == "76fc2d1")
        #expect(reference.locator == "blink/Sources/BlinkCore/Note.swift#L12-28@76fc2d1")
    }

    @Test("Unsafe and malformed portable paths are rejected", arguments: [
        "blink/../Secrets.txt",
        "blink//Sources/File.swift",
        "/absolute/File.swift",
        "blink/File.swift#L0",
        "blink/File.swift#L9-2",
        "blink/File.swift#L1-1001",
        "blink/File.swift#L12-foo",
        "blink/File.swift#L12-",
        "blink/File.swift#L1L2",
        "blink/File.swift@",
        "blink/Line\nBreak.swift",
    ])
    func rejectsUnsafeLocator(locator: String) {
        #expect(SourceReference(locator: locator) == nil)
    }

    @Test("Source casts deduplicate and cap portable work")
    func boundedCompanionCast() throws {
        let first = try #require(SourceReference(locator: "blink/One.swift"))
        let second = try #require(SourceReference(locator: "blink/Two.swift"))
        let third = try #require(SourceReference(locator: "blink/Three.swift"))
        let fourth = try #require(SourceReference(locator: "blink/Four.swift"))
        let cast = NoteCompanions(sources: [first, first, second, third, fourth])

        #expect(cast.sources == [first, second, third])
    }

    @Test("Named-root resolution reads a small UTF-8 source file")
    func resolvesSource() throws {
        let root = makeDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appendingPathComponent("Sources/Feature.swift")
        try FileManager.default.createDirectory(
            at: file.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try "import Foundation\nstruct Feature {}\n".write(to: file, atomically: true, encoding: .utf8)

        let resolver = SourceFileResolver(roots: ["blink": root])
        let reference = try #require(SourceReference(locator: "blink/Sources/Feature.swift#L2"))
        let document = try resolver.resolve(reference)

        #expect(document.displayName == "Feature.swift")
        #expect(document.displayPath == "blink/Sources/Feature.swift")
        #expect(document.language == "swift")
        #expect(document.lines?.start == 2)
        #expect(document.text.contains("struct Feature"))
    }

    @Test("A symlink cannot escape an approved source root")
    func rejectsSymlinkEscape() throws {
        let root = makeDirectory()
        let outside = makeDirectory()
        defer {
            try? FileManager.default.removeItem(at: root)
            try? FileManager.default.removeItem(at: outside)
        }
        let secret = outside.appendingPathComponent("Secret.swift")
        try "let secret = true\n".write(to: secret, atomically: true, encoding: .utf8)
        try FileManager.default.createSymbolicLink(
            at: root.appendingPathComponent("Secret.swift"), withDestinationURL: secret
        )

        let resolver = SourceFileResolver(roots: ["blink": root])
        let reference = try #require(SourceReference(locator: "blink/Secret.swift"))
        #expect(throws: SourceFileError.outsideRoot) {
            _ = try resolver.resolve(reference)
        }
    }

    @Test("Preview size is bounded")
    func rejectsLargeFile() throws {
        let root = makeDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appendingPathComponent("Large.swift")
        try Data(repeating: 65, count: 64).write(to: file)
        let resolver = SourceFileResolver(roots: ["blink": root], maxByteSize: 32)
        let reference = try #require(SourceReference(locator: "blink/Large.swift"))

        #expect(throws: SourceFileError.tooLarge(maxBytes: 32)) {
            _ = try resolver.resolve(reference)
        }
    }

    private func makeDirectory() -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("BlinkSourceTests-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
}

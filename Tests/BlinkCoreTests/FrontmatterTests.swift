import Testing
import Foundation
@testable import BlinkCore

@Suite("Frontmatter codec")
struct FrontmatterTests {
    private func sampleNote(content: String, tags: [String] = [], pinned: Bool = false) -> Note {
        // Use a date that survives fractional-second ISO8601 round-tripping.
        let date = Date(timeIntervalSince1970: 1_700_000_000.123)
        return Note(
            id: "my-note",
            content: content,
            createdAt: date,
            updatedAt: date,
            tags: tags,
            pinned: pinned
        )
    }

    @Test("Round-trip preserves content byte-exact")
    func roundTrip() throws {
        let note = sampleNote(content: "# Hello\n\nBody with trailing newline\n", tags: ["a", "b"], pinned: true)
        let encoded = Frontmatter.encode(note)
        let decoded = try Frontmatter.decode(encoded)
        #expect(decoded.content == note.content)
        #expect(decoded.id == note.id)
        #expect(decoded.tags == note.tags)
        #expect(decoded.pinned == note.pinned)
        #expect(decoded.createdAt == note.createdAt)
        #expect(decoded.updatedAt == note.updatedAt)
    }

    @Test("Round-trip preserves multiple trailing newlines")
    func trailingNewlines() throws {
        let note = sampleNote(content: "one line\n\n\n")
        let decoded = try Frontmatter.decode(Frontmatter.encode(note))
        #expect(decoded.content == "one line\n\n\n")
    }

    @Test("Empty content round-trips to empty")
    func emptyContent() throws {
        let note = sampleNote(content: "")
        let encoded = Frontmatter.encode(note)
        let decoded = try Frontmatter.decode(encoded)
        #expect(decoded.content == "")
    }

    @Test("Content with no trailing newline is preserved exactly")
    func noTrailingNewline() throws {
        let note = sampleNote(content: "no trailing newline")
        let decoded = try Frontmatter.decode(Frontmatter.encode(note))
        #expect(decoded.content == "no trailing newline")
    }

    @Test("Exactly one newline separates header from content")
    func singleLeadingNewlineRule() throws {
        let note = sampleNote(content: "\nleading blank line kept")
        let encoded = Frontmatter.encode(note)
        // The closing --- is followed by exactly one newline (the separator),
        // then the content which itself begins with a newline.
        #expect(encoded.hasSuffix("---\n\nleading blank line kept"))
        let decoded = try Frontmatter.decode(encoded)
        #expect(decoded.content == "\nleading blank line kept")
    }

    @Test("Missing frontmatter throws")
    func missingFrontmatter() {
        #expect(throws: FrontmatterError.missingFrontmatter) {
            _ = try Frontmatter.decode("just some markdown\nno frontmatter")
        }
    }

    @Test("Unterminated frontmatter throws")
    func unterminated() {
        #expect(throws: FrontmatterError.self) {
            _ = try Frontmatter.decode("---\nid: x\nno closing delimiter")
        }
    }

    @Test("Unknown keys are preserved verbatim, in order")
    func unknownKeys() throws {
        let raw = """
        ---
        id: keeper
        created: 2023-11-14T22:13:20.123Z
        updated: 2023-11-14T22:13:20.123Z
        color: blue
        position: 42
        ---
        body
        """
        let decoded = try Frontmatter.decode(raw)
        #expect(decoded.id == "keeper")
        #expect(decoded.content == "body")
        #expect(decoded.extraFrontmatter == ["color: blue", "position: 42"])
    }

    @Test("Unknown keys survive a decode → encode round-trip")
    func unknownKeysRoundTrip() throws {
        let raw = """
        ---
        id: keeper
        created: 2023-11-14T22:13:20.123Z
        updated: 2023-11-14T22:13:20.123Z
        source: agent://claude
        x-review: pending
        ---
        body
        """
        let decoded = try Frontmatter.decode(raw)
        let reEncoded = Frontmatter.encode(decoded)
        #expect(reEncoded.contains("source: agent://claude"))
        #expect(reEncoded.contains("x-review: pending"))
        // And they survive a second trip identically.
        let again = try Frontmatter.decode(reEncoded)
        #expect(again.extraFrontmatter == decoded.extraFrontmatter)
        #expect(again.content == "body")
    }

    @Test("Unknown nested blocks are preserved line-for-line")
    func nestedUnknownBlock() throws {
        let raw = """
        ---
        id: keeper
        created: 2023-11-14T22:13:20.123Z
        updated: 2023-11-14T22:13:20.123Z
        x-meta:
          device: phone
          app: shortcuts
        ---
        body
        """
        let decoded = try Frontmatter.decode(raw)
        #expect(decoded.extraFrontmatter == ["x-meta:", "  device: phone", "  app: shortcuts"])
        let again = try Frontmatter.decode(Frontmatter.encode(decoded))
        #expect(again.extraFrontmatter == decoded.extraFrontmatter)
    }

    @Test("Extra lines are emitted after Blink's fields, before the closing delimiter")
    func extraLinesPosition() {
        let note = sampleNote(content: "c")
        var withExtra = note
        withExtra.extraFrontmatter = ["origin: import"]
        let lines = Frontmatter.encode(withExtra).split(separator: "\n").map(String.init)
        #expect(lines[5].hasPrefix("pinned: "))
        #expect(lines[6] == "origin: import")
        #expect(lines[7] == "---")
    }

    @Test("extraFrontmatterValue reads foreign scalar keys")
    func extraValueLookup() throws {
        let raw = """
        ---
        id: keeper
        created: 2023-11-14T22:13:20.123Z
        updated: 2023-11-14T22:13:20.123Z
        sheet: dotted
        x-meta:
          sheet: nested-should-not-match
        ---
        body
        """
        let note = try Frontmatter.decode(raw)
        #expect(note.extraFrontmatterValue(for: "sheet") == "dotted")
        #expect(note.extraFrontmatterValue(for: "missing") == nil)
        #expect(note.extraFrontmatterValue(for: "x-meta") == nil)
    }

    @Test("Indented lines never shadow Blink's own keys")
    func indentedKnownKeyIsNotOurs() throws {
        let raw = """
        ---
        id: keeper
        created: 2023-11-14T22:13:20.123Z
        updated: 2023-11-14T22:13:20.123Z
        x-block:
          pinned: true
        ---
        body
        """
        let decoded = try Frontmatter.decode(raw)
        #expect(decoded.pinned == false)
        #expect(decoded.extraFrontmatter == ["x-block:", "  pinned: true"])
    }

    @Test("Missing tags and pinned default to [] and false")
    func defaults() throws {
        let raw = """
        ---
        id: minimal
        created: 2023-11-14T22:13:20.123Z
        updated: 2023-11-14T22:13:20.123Z
        ---
        content
        """
        let decoded = try Frontmatter.decode(raw)
        #expect(decoded.tags == [])
        #expect(decoded.pinned == false)
    }

    @Test("Empty tags encode as [] and decode back to empty")
    func emptyTagsEncoding() throws {
        let note = sampleNote(content: "x", tags: [])
        let encoded = Frontmatter.encode(note)
        #expect(encoded.contains("tags: []"))
        #expect(encoded.contains("pinned: false"))
        let decoded = try Frontmatter.decode(encoded)
        #expect(decoded.tags == [])
    }

    @Test("Deterministic field order in encoded output")
    func fieldOrder() {
        let encoded = Frontmatter.encode(sampleNote(content: "c", tags: ["t"], pinned: true))
        let lines = encoded.split(separator: "\n").map(String.init)
        #expect(lines[0] == "---")
        #expect(lines[1].hasPrefix("id: "))
        #expect(lines[2].hasPrefix("created: "))
        #expect(lines[3].hasPrefix("updated: "))
        #expect(lines[4].hasPrefix("tags: "))
        #expect(lines[5].hasPrefix("pinned: "))
        #expect(lines[6] == "---")
    }
}

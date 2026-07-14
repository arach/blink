import Foundation

/// Errors thrown by the frontmatter codec.
public enum FrontmatterError: Error, Equatable, Sendable {
    /// The file did not begin with a `---` frontmatter block.
    case missingFrontmatter
    /// The opening `---` was never closed by a second `---`.
    case unterminatedFrontmatter
    /// A required date field was missing or unparseable.
    case invalidDate(field: String)
    /// A required field (`id`) was missing.
    case missingField(String)
}

/// A minimal, purpose-built frontmatter codec for Blink notes.
///
/// This is *not* a general YAML parser. It handles exactly this schema:
/// ```
/// ---
/// id: <slug>
/// created: <ISO8601 with fractional seconds>
/// updated: <ISO8601 with fractional seconds>
/// tags: [a, b]
/// pinned: true
/// ---
/// <content>
/// ```
///
/// Behavior choices (all covered by tests):
/// - `encode` always emits `id`, `created`, `updated`, and always emits `tags`
///   and `pinned` (even when empty/false) for a stable, deterministic file. Decode
///   tolerates their absence and defaults to `[]` / `false`.
/// - Exactly one newline separates the closing `---` from the content, and that
///   newline is not part of the content. `decode` strips exactly one leading
///   newline after the closing delimiter; `encode` writes exactly one. Round-trips
///   are therefore byte-exact for the content, including any trailing newlines.
public enum Frontmatter {
    // A fresh formatter per call: ISO8601DateFormatter is not Sendable, so it
    // cannot be a shared static under strict concurrency.
    private static func makeFormatter() -> ISO8601DateFormatter {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }

    // MARK: - Encode

    public static func encode(_ note: Note) -> String {
        let dateFormatter = makeFormatter()
        var lines: [String] = ["---"]
        lines.append("id: \(note.id)")
        lines.append("created: \(dateFormatter.string(from: note.createdAt))")
        lines.append("updated: \(dateFormatter.string(from: note.updatedAt))")
        lines.append("tags: [\(note.tags.joined(separator: ", "))]")
        lines.append("pinned: \(note.pinned)")
        lines.append("---")

        // Join header, then exactly one newline, then content verbatim.
        return lines.joined(separator: "\n") + "\n" + note.content
    }

    // MARK: - Decode

    public static func decode(_ fileContents: String) throws -> Note {
        guard fileContents.hasPrefix("---\n") || fileContents == "---" || fileContents.hasPrefix("---\r\n") else {
            throw FrontmatterError.missingFrontmatter
        }

        // Work on lines but keep enough structure to recover exact content.
        // Split into the frontmatter body and the remainder after the closing "---".
        let afterOpen = String(fileContents.dropFirst("---".count))
        // Drop the newline that follows the opening delimiter.
        let afterOpenTrimmed = dropLeadingNewline(afterOpen)

        // Find the closing delimiter: a line that is exactly "---".
        guard let close = findClosingDelimiter(in: afterOpenTrimmed) else {
            throw FrontmatterError.unterminatedFrontmatter
        }

        let header = String(afterOpenTrimmed[afterOpenTrimmed.startIndex..<close.delimiterStart])
        var content = String(afterOpenTrimmed[close.contentStart...])
        // Strip exactly one leading newline between the closing "---" and content.
        content = dropLeadingNewline(content)

        // Parse header lines.
        var id: String?
        var createdRaw: String?
        var updatedRaw: String?
        var tags: [String] = []
        var pinned = false

        for rawLine in header.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = String(rawLine)
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = String(line[line.startIndex..<colon]).trimmingCharacters(in: .whitespaces)
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            switch key {
            case "id":
                id = value
            case "created":
                createdRaw = value
            case "updated":
                updatedRaw = value
            case "tags":
                tags = parseTags(value)
            case "pinned":
                pinned = (value.lowercased() == "true")
            default:
                break // unknown keys ignored
            }
        }

        guard let id, !id.isEmpty else {
            throw FrontmatterError.missingField("id")
        }
        guard let createdRaw, let createdAt = parseDate(createdRaw) else {
            throw FrontmatterError.invalidDate(field: "created")
        }
        guard let updatedRaw, let updatedAt = parseDate(updatedRaw) else {
            throw FrontmatterError.invalidDate(field: "updated")
        }

        return Note(
            id: id,
            content: content,
            createdAt: createdAt,
            updatedAt: updatedAt,
            tags: tags,
            pinned: pinned
        )
    }

    // MARK: - Helpers

    private static func parseDate(_ raw: String) -> Date? {
        if let d = makeFormatter().date(from: raw) { return d }
        // Tolerate timestamps without fractional seconds.
        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: raw)
    }

    private static func parseTags(_ raw: String) -> [String] {
        var s = raw
        if s.hasPrefix("[") { s.removeFirst() }
        if s.hasSuffix("]") { s.removeLast() }
        return s
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    /// Remove a single leading `\n` (or `\r\n`) if present.
    private static func dropLeadingNewline(_ s: String) -> String {
        if s.hasPrefix("\r\n") { return String(s.dropFirst(2)) }
        if s.hasPrefix("\n") { return String(s.dropFirst()) }
        return s
    }

    private struct ClosingDelimiter {
        /// Index in the source string where the delimiter line begins.
        let delimiterStart: String.Index
        /// Index just past the closing "---" line's delimiter text.
        let contentStart: String.Index
    }

    /// Scan `body` (frontmatter header + content, with the opening delimiter/newline
    /// already removed) for a line consisting exactly of "---".
    private static func findClosingDelimiter(in body: String) -> ClosingDelimiter? {
        var lineStart = body.startIndex
        while true {
            let lineEnd = body[lineStart...].firstIndex(of: "\n") ?? body.endIndex
            var line = body[lineStart..<lineEnd]
            if line.hasSuffix("\r") { line = line.dropLast() }
            if line == "---" {
                // contentStart is right after the "---" delimiter text (before any
                // trailing newline), so the caller strips exactly one newline.
                return ClosingDelimiter(delimiterStart: lineStart, contentStart: lineEnd)
            }
            if lineEnd == body.endIndex { return nil }
            lineStart = body.index(after: lineEnd)
        }
    }
}

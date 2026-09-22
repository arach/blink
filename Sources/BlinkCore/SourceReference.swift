import Foundation

/// A portable pointer to a source file under one of Blink's device-local named
/// roots. The root name and relative path travel with a note; the absolute root
/// URL is resolved from `config.json` on each device.
///
/// Canonical form:
///
///     blink/Sources/BlinkCore/Note.swift#L12-28@76fc2d1
///
/// Both the line anchor and revision are optional. A revision is provenance,
/// not a request for Blink to check out or mutate a repository.
public struct SourceReference: Hashable, Sendable, Codable {
    public struct LineRange: Hashable, Sendable, Codable {
        public static let maximumSpan = 1_000

        public let start: Int
        public let end: Int

        public init?(start: Int, end: Int? = nil) {
            let resolvedEnd = end ?? start
            guard start > 0,
                  resolvedEnd >= start,
                  resolvedEnd - start < Self.maximumSpan
            else { return nil }
            self.start = start
            self.end = resolvedEnd
        }

        private enum CodingKeys: String, CodingKey { case start, end }

        public init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let start = try container.decode(Int.self, forKey: .start)
            let end = try container.decode(Int.self, forKey: .end)
            guard let bounded = Self(start: start, end: end) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .end,
                    in: container,
                    debugDescription: "Source line ranges may span at most \(Self.maximumSpan) lines."
                )
            }
            self = bounded
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(start, forKey: .start)
            try container.encode(end, forKey: .end)
        }
    }

    public let root: String
    public let path: String
    public let lines: LineRange?
    public let revision: String?

    public init?(
        root: String,
        path: String,
        lines: LineRange? = nil,
        revision: String? = nil
    ) {
        guard Self.isValidRoot(root), Self.isValidRelativePath(path) else { return nil }
        if let revision, !Self.isValidRevision(revision) { return nil }
        self.root = root
        self.path = path
        self.lines = lines
        self.revision = revision
    }

    public init?(locator: String) {
        let raw = locator.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }

        let revisionSplit = raw.split(separator: "@", maxSplits: 1, omittingEmptySubsequences: false)
        let beforeRevision = String(revisionSplit[0])
        let revision = revisionSplit.count == 2 ? String(revisionSplit[1]) : nil
        guard revisionSplit.count == 1 || (revision != nil && !revision!.isEmpty) else { return nil }

        let anchorSplit = beforeRevision.components(separatedBy: "#L")
        guard anchorSplit.count <= 2 else { return nil }
        let portablePath = anchorSplit[0]

        guard let slash = portablePath.firstIndex(of: "/") else { return nil }
        let root = String(portablePath[..<slash])
        let path = String(portablePath[portablePath.index(after: slash)...])

        let lines: LineRange?
        if anchorSplit.count == 2 {
            let bounds = anchorSplit[1].split(
                separator: "-",
                maxSplits: 1,
                omittingEmptySubsequences: false
            )
            guard let startRaw = bounds.first,
                  let start = Self.decimal(startRaw)
            else { return nil }
            let end: Int?
            if bounds.count == 2 {
                let endRaw = bounds[1].hasPrefix("L") ? bounds[1].dropFirst() : bounds[1]
                guard let parsedEnd = Self.decimal(endRaw) else { return nil }
                end = parsedEnd
            } else {
                end = nil
            }
            guard
                  let parsed = LineRange(
                    start: start,
                    end: end
                  )
            else { return nil }
            lines = parsed
        } else {
            lines = nil
        }

        self.init(root: root, path: path, lines: lines, revision: revision)
    }

    public var locator: String {
        var value = "\(root)/\(path)"
        if let lines {
            value += lines.start == lines.end
                ? "#L\(lines.start)"
                : "#L\(lines.start)-\(lines.end)"
        }
        if let revision { value += "@\(revision)" }
        return value
    }

    private static func isValidRoot(_ value: String) -> Bool {
        guard !value.isEmpty else { return false }
        return value.unicodeScalars.allSatisfy {
            CharacterSet.alphanumerics.contains($0) || $0 == "-" || $0 == "_" || $0 == "."
        }
    }

    private static func isValidRelativePath(_ value: String) -> Bool {
        guard !value.isEmpty, !value.hasPrefix("/"), !value.contains("\\"),
              !value.contains("#"), !value.contains("@"),
              value.unicodeScalars.allSatisfy({
                  !CharacterSet.controlCharacters.contains($0)
              })
        else { return false }
        let components = value.split(separator: "/", omittingEmptySubsequences: false)
        return !components.contains { $0.isEmpty || $0 == "." || $0 == ".." }
    }

    private static func isValidRevision(_ value: String) -> Bool {
        guard !value.isEmpty else { return false }
        return value.unicodeScalars.allSatisfy {
            CharacterSet.alphanumerics.contains($0)
                || $0 == "-" || $0 == "_" || $0 == "." || $0 == "/"
        }
    }

    private static func decimal<S: StringProtocol>(_ value: S) -> Int? {
        guard !value.isEmpty,
              value.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 })
        else { return nil }
        return Int(value)
    }
}

/// A note-declared cast of source companions. Exact frames and visibility are
/// intentionally absent: those remain device-local desktop state.
public struct NoteCompanions: Equatable, Sendable, Codable {
    public static let maximumSources = 3

    public var layout: String?
    public private(set) var sources: [SourceReference]
    /// Unknown companion fields and invalid source-list entries are retained as
    /// raw YAML lines so Blink never turns partial understanding into metadata
    /// loss. They are deliberately separate because list entries must remain
    /// beneath `sources:` when the known portion is canonicalized.
    public private(set) var extraLines: [String]
    public private(set) var extraSourceLines: [String]

    public init(layout: String? = nil, sources: [SourceReference] = []) {
        self.layout = layout
        var seen = Set<SourceReference>()
        var bounded: [SourceReference] = []
        for source in sources where seen.insert(source).inserted {
            bounded.append(source)
            if bounded.count == Self.maximumSources { break }
        }
        self.sources = bounded
        extraLines = []
        extraSourceLines = []
    }

    public var isEmpty: Bool {
        layout == nil && sources.isEmpty && extraLines.isEmpty && extraSourceLines.isEmpty
    }

    @discardableResult
    mutating func append(_ source: SourceReference) -> Bool {
        guard sources.count < Self.maximumSources, !sources.contains(source) else { return false }
        sources.append(source)
        return true
    }

    mutating func preserveExtraLine(_ line: String) { extraLines.append(line) }
    mutating func preserveExtraSourceLine(_ line: String) { extraSourceLines.append(line) }

    private enum CodingKeys: String, CodingKey {
        case layout, sources, extraLines, extraSourceLines
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            layout: try container.decodeIfPresent(String.self, forKey: .layout),
            sources: try container.decodeIfPresent([SourceReference].self, forKey: .sources) ?? []
        )
        extraLines = try container.decodeIfPresent([String].self, forKey: .extraLines) ?? []
        extraSourceLines = try container.decodeIfPresent(
            [String].self, forKey: .extraSourceLines
        ) ?? []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(layout, forKey: .layout)
        try container.encode(sources, forKey: .sources)
        try container.encode(extraLines, forKey: .extraLines)
        try container.encode(extraSourceLines, forKey: .extraSourceLines)
    }
}

import Foundation

public enum SourceFileError: Error, Equatable, Sendable, LocalizedError {
    case unknownRoot(String)
    case outsideRoot
    case missingFile(String)
    case notRegularFile
    case tooLarge(maxBytes: Int)
    case notUTF8
    case unsupportedFile(String)

    public var errorDescription: String? {
        switch self {
        case .unknownRoot(let root): "Locate the “\(root)” source root to show this file."
        case .outsideRoot: "The source resolves outside its approved root."
        case .missingFile(let path): "Source file not found: \(path)"
        case .notRegularFile: "Only regular files can be previewed."
        case .tooLarge(let maxBytes): "This file is larger than the \(maxBytes / 1_000_000) MB preview limit."
        case .notUTF8: "This file is binary or not UTF-8 text."
        case .unsupportedFile(let name): "\(name) does not look like a source file."
        }
    }
}

public struct SourceDocument: Sendable, Equatable {
    public let identity: String
    public let url: URL
    public let displayName: String
    public let displayPath: String
    public let language: String
    public let text: String
    public let lines: SourceReference.LineRange?
    public let revision: String?
    public let modifiedAt: Date?

    public init(
        identity: String,
        url: URL,
        displayName: String,
        displayPath: String,
        language: String,
        text: String,
        lines: SourceReference.LineRange? = nil,
        revision: String? = nil,
        modifiedAt: Date? = nil
    ) {
        self.identity = identity
        self.url = url
        self.displayName = displayName
        self.displayPath = displayPath
        self.language = language
        self.text = text
        self.lines = lines
        self.revision = revision
        self.modifiedAt = modifiedAt
    }
}

/// Resolves note-portable references without allowing them to escape an
/// explicitly approved local root. Symlinks are resolved before containment is
/// checked, so a symlink inside a workspace cannot smuggle reads outside it.
public struct SourceFileResolver: Sendable {
    public static let defaultMaxByteSize = 2_000_000

    private let roots: [String: URL]
    public let maxByteSize: Int

    public init(roots: [String: URL], maxByteSize: Int = defaultMaxByteSize) {
        self.roots = roots
        self.maxByteSize = max(1, maxByteSize)
    }

    public func resolve(_ reference: SourceReference) throws -> SourceDocument {
        guard let configuredRoot = roots[reference.root] else {
            throw SourceFileError.unknownRoot(reference.root)
        }
        let root = configuredRoot.standardizedFileURL.resolvingSymlinksInPath()
        let candidate = root
            .appendingPathComponent(reference.path)
            .standardizedFileURL
            .resolvingSymlinksInPath()
        guard Self.contains(candidate, in: root) else { throw SourceFileError.outsideRoot }
        return try load(
            candidate,
            identity: reference.locator,
            displayPath: "\(reference.root)/\(reference.path)",
            lines: reference.lines,
            revision: reference.revision
        )
    }

    /// Resolve a file the user explicitly chose in `NSOpenPanel`. It is not
    /// portable and does not become note metadata; the picker is the authority.
    public func resolvePickedFile(_ url: URL) throws -> SourceDocument {
        let candidate = url.standardizedFileURL.resolvingSymlinksInPath()
        return try load(
            candidate,
            identity: "file:\(candidate.path)",
            displayPath: candidate.deletingLastPathComponent().path,
            lines: nil,
            revision: nil
        )
    }

    private func load(
        _ url: URL,
        identity: String,
        displayPath: String,
        lines: SourceReference.LineRange?,
        revision: String?
    ) throws -> SourceDocument {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw SourceFileError.missingFile(url.path)
        }
        let values = try url.resourceValues(forKeys: [
            .isRegularFileKey, .fileSizeKey, .contentModificationDateKey,
        ])
        guard values.isRegularFile == true else { throw SourceFileError.notRegularFile }
        if let size = values.fileSize, size > maxByteSize {
            throw SourceFileError.tooLarge(maxBytes: maxByteSize)
        }

        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let probeSize = maxByteSize == .max ? Int.max : maxByteSize + 1
        let data = try handle.read(upToCount: probeSize) ?? Data()
        guard data.count <= maxByteSize else {
            throw SourceFileError.tooLarge(maxBytes: maxByteSize)
        }
        guard let text = String(data: data, encoding: .utf8), !text.contains("\0") else {
            throw SourceFileError.notUTF8
        }
        guard let language = Self.language(for: url, text: text) else {
            throw SourceFileError.unsupportedFile(url.lastPathComponent)
        }

        return SourceDocument(
            identity: identity,
            url: url,
            displayName: url.lastPathComponent,
            displayPath: displayPath,
            language: language,
            text: text,
            lines: lines,
            revision: revision,
            modifiedAt: values.contentModificationDate
        )
    }

    private static func contains(_ candidate: URL, in root: URL) -> Bool {
        let rootPath = root.path.hasSuffix("/") ? root.path : root.path + "/"
        return candidate.path == root.path || candidate.path.hasPrefix(rootPath)
    }

    /// Broad on purpose: Blink is a reading surface, so common source, data,
    /// config, build, prose, and patch formats all qualify. Unknown extensions
    /// still get an honest plain-text viewer when their content looks like code.
    public static func language(for url: URL, text: String) -> String? {
        let name = url.lastPathComponent.lowercased()
        let ext = url.pathExtension.lowercased()
        let names: [String: String] = [
            "dockerfile": "dockerfile", "makefile": "makefile", "gemfile": "ruby",
            "podfile": "ruby", "rakefile": "ruby", "cmakelists.txt": "cmake",
            ".gitignore": "shell", ".gitattributes": "plaintext", ".env": "shell",
        ]
        if let language = names[name] { return language }

        let extensions: [String: String] = [
            "swift": "swift", "m": "objective-c", "mm": "objective-cpp",
            "h": "cpp", "hpp": "cpp", "c": "c", "cc": "cpp", "cpp": "cpp",
            "cs": "csharp", "java": "java", "kt": "kotlin", "kts": "kotlin",
            "js": "javascript", "jsx": "jsx", "mjs": "javascript", "cjs": "javascript",
            "ts": "typescript", "tsx": "tsx", "vue": "vue", "svelte": "svelte",
            "py": "python", "pyi": "python", "rb": "ruby", "php": "php",
            "rs": "rust", "go": "go", "scala": "scala", "lua": "lua", "r": "r",
            "sh": "shell", "bash": "shell", "zsh": "shell", "fish": "shell",
            "ps1": "powershell", "sql": "sql", "graphql": "graphql", "gql": "graphql",
            "html": "html", "htm": "html", "css": "css", "scss": "scss", "sass": "sass",
            "less": "less", "xml": "xml", "svg": "xml",
            "json": "json", "jsonc": "json", "yaml": "yaml", "yml": "yaml",
            "toml": "toml", "ini": "properties", "cfg": "properties", "conf": "properties",
            "plist": "xml", "proto": "protobuf", "gradle": "groovy",
            "md": "markdown", "mdx": "markdown", "markdown": "markdown",
            "txt": "plaintext", "diff": "diff", "patch": "diff", "log": "plaintext",
        ]
        if let language = extensions[ext] { return language }
        if ext.isEmpty, text.hasPrefix("#!") { return "shell" }
        return looksLikeCode(text) ? "plaintext" : nil
    }

    private static func looksLikeCode(_ text: String) -> Bool {
        let sample = String(text.prefix(16_384))
        guard !sample.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        let signals = [
            "import ", "export ", "func ", "function ", "struct ", "class ",
            "enum ", "protocol ", "const ", "let ", "var ", "def ", "return ",
            "#include", "package ", "SELECT ", "FROM ", "<?xml", "{\n", "};",
        ]
        if signals.contains(where: sample.contains) { return true }
        let punctuation = sample.reduce(into: 0) { count, character in
            if "{}[]();=<>".contains(character) { count += 1 }
        }
        return punctuation >= 6 && sample.contains("\n")
    }
}

import SwiftUI

struct MarkdownDocumentView: View {
    let markdown: String
    let noteTitle: String

    private var blocks: [MarkdownBlock] {
        MarkdownBlock.parse(markdown, omittingRepeatedTitle: noteTitle)
    }

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 16) {
            ForEach(blocks) { block in
                blockView(block)
            }
        }
        .foregroundStyle(BlinkMobileTheme.ink)
        .textSelection(.enabled)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func blockView(_ block: MarkdownBlock) -> some View {
        switch block.kind {
        case .heading(let level, let text):
            Text(inlineMarkdown(text))
                .font(headingFont(level))
                .foregroundStyle(BlinkMobileTheme.ink)
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let text):
            Text(inlineMarkdown(text))
                .font(.body)
        case .listItem(let marker, let text):
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(marker)
                    .font(.body.monospaced())
                    .foregroundStyle(BlinkMobileTheme.signal)
                    .frame(minWidth: 18, alignment: .trailing)
                Text(inlineMarkdown(text))
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .combine)
        case .code(let text):
            ScrollView(.horizontal) {
                Text(text)
                    .font(.body.monospaced())
                    .padding()
            }
            .background(BlinkMobileTheme.surface)
            .overlay {
                Rectangle()
                    .stroke(BlinkMobileTheme.hairline, lineWidth: 1)
            }
            .accessibilityLabel("Code block")
            .accessibilityValue(text)
        }
    }

    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: .system(.title2, design: .serif, weight: .semibold)
        case 2: .system(.title3, design: .serif, weight: .semibold)
        default: .headline
        }
    }

    private func inlineMarkdown(_ text: String) -> AttributedString {
        (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
    }
}

private struct MarkdownBlock: Identifiable {
    enum Kind {
        case heading(level: Int, text: String)
        case paragraph(String)
        case listItem(marker: String, text: String)
        case code(String)
    }

    var id: Int
    var kind: Kind

    static func parse(_ markdown: String, omittingRepeatedTitle title: String) -> [MarkdownBlock] {
        let lines = markdown.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        var code: [String]?

        func append(_ kind: Kind) {
            blocks.append(MarkdownBlock(id: blocks.count, kind: kind))
        }

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            append(.paragraph(paragraph.joined(separator: " ")))
            paragraph.removeAll()
        }

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("```") {
                if let codeLines = code {
                    append(.code(codeLines.joined(separator: "\n")))
                    code = nil
                } else {
                    flushParagraph()
                    code = []
                }
                continue
            }
            if code != nil {
                code?.append(line)
                continue
            }
            if trimmed.isEmpty {
                flushParagraph()
                continue
            }
            if let heading = heading(in: trimmed) {
                flushParagraph()
                append(.heading(level: heading.level, text: heading.text))
                continue
            }
            if let item = listItem(in: trimmed) {
                flushParagraph()
                append(.listItem(marker: item.marker, text: item.text))
                continue
            }
            paragraph.append(trimmed)
        }

        flushParagraph()
        if let code { append(.code(code.joined(separator: "\n"))) }

        if let first = blocks.first,
           case .heading(_, let headingTitle) = first.kind,
           headingTitle.caseInsensitiveCompare(title) == .orderedSame {
            blocks.removeFirst()
            for index in blocks.indices { blocks[index].id = index }
        }
        return blocks
    }

    private static func heading(in line: String) -> (level: Int, text: String)? {
        let level = line.prefix(while: { $0 == "#" }).count
        guard (1...6).contains(level) else { return nil }
        let boundary = line.index(line.startIndex, offsetBy: level)
        guard boundary < line.endIndex, line[boundary].isWhitespace else { return nil }
        return (level, line[boundary...].trimmingCharacters(in: .whitespaces))
    }

    private static func listItem(in line: String) -> (marker: String, text: String)? {
        for marker in ["-", "*", "+"] where line.hasPrefix(marker + " ") {
            return ("•", String(line.dropFirst(2)))
        }
        let digits = line.prefix(while: { $0.isNumber })
        guard !digits.isEmpty else { return nil }
        let boundary = line.index(line.startIndex, offsetBy: digits.count)
        guard boundary < line.endIndex, line[boundary] == "." || line[boundary] == ")" else {
            return nil
        }
        let afterMarker = line.index(after: boundary)
        guard afterMarker < line.endIndex, line[afterMarker].isWhitespace else { return nil }
        return ("\(digits).", line[afterMarker...].trimmingCharacters(in: .whitespaces))
    }
}

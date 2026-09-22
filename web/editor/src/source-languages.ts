import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import {
  c,
  cpp,
  csharp,
  java,
  kotlin,
  objectiveC,
  objectiveCpp,
  scala,
} from "@codemirror/legacy-modes/mode/clike";
import {
  javascript,
  json,
  typescript,
} from "@codemirror/legacy-modes/mode/javascript";
import { python } from "@codemirror/legacy-modes/mode/python";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { go } from "@codemirror/legacy-modes/mode/go";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { standardSQL } from "@codemirror/legacy-modes/mode/sql";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { css, less, sCSS } from "@codemirror/legacy-modes/mode/css";
import { html, xml } from "@codemirror/legacy-modes/mode/xml";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { r } from "@codemirror/legacy-modes/mode/r";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";

const stream = (parser: Parameters<typeof StreamLanguage.define>[0]): Extension =>
  StreamLanguage.define(parser);

/** Honest language routing. Unknown formats remain selectable plain text. */
export function sourceLanguage(name: string): Extension {
  switch (name.toLowerCase()) {
    case "markdown": return markdown({ base: markdownLanguage });
    case "swift": return stream(swift);
    case "c": return stream(c);
    case "cpp": return stream(cpp);
    case "csharp": return stream(csharp);
    case "java": return stream(java);
    case "kotlin": return stream(kotlin);
    case "objective-c": return stream(objectiveC);
    case "objective-cpp": return stream(objectiveCpp);
    case "scala": return stream(scala);
    case "javascript":
    case "jsx": return stream(javascript);
    case "typescript":
    case "tsx": return stream(typescript);
    case "json": return stream(json);
    case "python": return stream(python);
    case "ruby": return stream(ruby);
    case "rust": return stream(rust);
    case "go": return stream(go);
    case "shell":
    case "makefile": return stream(shell);
    case "powershell": return stream(powerShell);
    case "sql": return stream(standardSQL);
    case "yaml": return stream(yaml);
    case "toml": return stream(toml);
    case "css": return stream(css);
    case "scss":
    case "sass": return stream(sCSS);
    case "less": return stream(less);
    case "html": return stream(html);
    case "xml": return stream(xml);
    case "diff": return stream(diff);
    case "dockerfile": return stream(dockerFile);
    case "lua": return stream(lua);
    case "r": return stream(r);
    case "properties": return stream(properties);
    case "protobuf": return stream(protobuf);
    case "groovy": return stream(groovy);
    case "cmake": return stream(cmake);
    default: return [];
  }
}

import { Notice, Plugin, setIcon } from "obsidian";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";

/**
 * Matches, in priority order:
 *   1. A markdown link:  [text](url "optional title")  -> capture group 1 = url part
 *   2. A bare URL:       https://example.com           -> capture group 2 = url
 *
 * The markdown-link alternative comes first so a URL that is already inside a
 * markdown link is consumed as part of that match and not also matched as a
 * bare URL.
 */
const LINK_RE =
  /\[[^\]]*\]\(([^)]+)\)|(https?:\/\/[^\s<>()[\]]+)/g;

/** Pull the actual URL out of a regex match, dropping any `"title"` and `<>`. */
function urlFromMatch(match: RegExpExecArray): string {
  const raw = (match[1] ?? match[2] ?? "").trim();
  // For `[text](url "title")` the title (after a space) is not part of the URL.
  const url = raw.split(/\s+/)[0];
  return url.replace(/^<|>$/g, "");
}

/** Build a small clickable copy icon that writes `value` to the clipboard. */
function createCopyButton(value: string): HTMLElement {
  const btn = activeDocument.createElement("span");
  btn.className = "copy-link-button";
  btn.setAttribute("role", "button");
  btn.setAttribute("aria-label", "Copy link");
  setIcon(btn, "copy");

  const copy = (evt: MouseEvent) => {
    // Stop the click from moving the editor cursor or following the link.
    evt.preventDefault();
    evt.stopPropagation();
    navigator.clipboard.writeText(value).then(
      () => {
        setIcon(btn, "check");
        btn.addClass("copy-link-button--copied");
        new Notice("Link copied");
        window.setTimeout(() => {
          setIcon(btn, "copy");
          btn.removeClass("copy-link-button--copied");
        }, 1200);
      },
      () => new Notice("Could not copy link")
    );
  };

  // Use mousedown so we win the race against the editor's own click handling.
  btn.addEventListener("mousedown", copy);
  return btn;
}

/* ------------------------------------------------------------------ */
/* Editing / Live Preview (CodeMirror 6 editor extension)             */
/* ------------------------------------------------------------------ */

class CopyButtonWidget extends WidgetType {
  constructor(readonly value: string) {
    super();
  }

  eq(other: CopyButtonWidget): boolean {
    return other.value === this.value;
  }

  toDOM(): HTMLElement {
    return createCopyButton(this.value);
  }

  ignoreEvent(): boolean {
    // Let the widget receive its own mouse events.
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    LINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = LINK_RE.exec(text)) !== null) {
      const url = urlFromMatch(match);
      if (!url) continue;
      const end = from + match.index + match[0].length;
      builder.add(
        end,
        end,
        Decoration.widget({
          widget: new CopyButtonWidget(url),
          side: 1,
        })
      );
    }
  }

  return builder.finish();
}

const copyLinkEditorExtension = ViewPlugin.fromClass(
  class implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  }
);

/* ------------------------------------------------------------------ */
/* Plugin                                                              */
/* ------------------------------------------------------------------ */

export default class CopyLinkPlugin extends Plugin {
  async onload() {
    // Editing / Live Preview.
    this.registerEditorExtension(copyLinkEditorExtension);

    // Reading view: add a button after every external link.
    this.registerMarkdownPostProcessor((el) => {
      const anchors = el.querySelectorAll<HTMLAnchorElement>("a.external-link");
      anchors.forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (!href) return;
        // Avoid adding a second button if this element is reprocessed.
        if (anchor.nextElementSibling?.classList.contains("copy-link-button")) {
          return;
        }
        const btn = createCopyButton(href);
        anchor.after(btn);
      });
    });
  }
}

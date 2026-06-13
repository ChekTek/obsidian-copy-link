import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  setIcon,
  Setting,
} from "obsidian";
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
 *   1. An embedded wikilink: ![[image.png]]             -> capture group 1 = image path
 *   2. A wikilink:          [[Note|Alias]]              -> capture group 2 = full wikilink
 *   3. A markdown image:    ![alt](url "title")         -> capture group 3 = url part
 *   4. A markdown link:     [text](url "title")         -> capture group 4 = url part
 *   5. A bare URL:          https://example.com         -> capture group 5 = url
 *
 * More specific link syntaxes come first so the URL/wikilink contents are
 * consumed as part of that match and not also matched by a later alternative.
 */
const LINK_RE =
  /!\[\[([^\]]+)\]\]|(\[\[[^\]]+\]\])|!\[[^\]]*\]\(([^)]+)\)|\[[^\]]*\]\(([^)]+)\)|(https?:\/\/[^\s<>()[\]]+)/g;

type VisibilityHotkey = "always" | "ctrl" | "meta" | "alt" | "shift";

interface CopyLinkSettings {
  visibilityHotkey: VisibilityHotkey;
}

const DEFAULT_SETTINGS: CopyLinkSettings = {
  visibilityHotkey: "always",
};

const IMAGE_BUTTON_MARGIN_PX = 8;
const HOTKEY_ENABLED_CLASS = "copy-link-button-hotkey-enabled";
const HOTKEY_ACTIVE_CLASS = "copy-link-button-hotkey-active";
const PREVIEW_IMAGE_BUTTON_CLASS = "copy-link-preview-image-button";

function isVisibilityHotkey(value: string): value is VisibilityHotkey {
  switch (value) {
    case "always":
    case "ctrl":
    case "meta":
    case "alt":
    case "shift":
      return true;
    default:
      return false;
  }
}

/** Pull the copy value out of a regex match, dropping any `"title"` and `<>`. */
function valueFromMatch(match: RegExpExecArray): string {
  if (match[1]) return embeddedImageTarget(match[1]);
  if (match[2]) return match[2].trim();

  const raw = (match[3] ?? match[4] ?? match[5] ?? "").trim();
  return markdownDestination(raw);
}

/** Build a small clickable copy icon that writes `value` to the clipboard. */
function createCopyButton(value: string, label = "Copy link"): HTMLElement {
  const btn = activeDocument.createElement("span");
  btn.className = "copy-link-button";
  btn.setAttribute("role", "button");
  btn.setAttribute("aria-label", label);
  setIcon(btn, "copy");

  const copy = (evt: MouseEvent) => {
    // Stop the click from moving the editor cursor or following the link.
    evt.preventDefault();
    evt.stopPropagation();
    navigator.clipboard.writeText(value).then(
      () => {
        setIcon(btn, "check");
        btn.addClass("copy-link-button--copied");
        new Notice("Copied");
        window.setTimeout(() => {
          setIcon(btn, "copy");
          btn.removeClass("copy-link-button--copied");
        }, 1200);
      },
      () => new Notice("Could not copy")
    );
  };

  // Use mousedown so we win the race against the editor's own click handling.
  btn.addEventListener("mousedown", copy);
  return btn;
}

function embeddedImageTarget(target: string): string {
  return target.split("|")[0].trim();
}

function markdownDestination(raw: string): string {
  // For `[text](url "title")` the title (after a space) is not part of the URL.
  const url = raw.trim().split(/\s+/)[0];
  return url.replace(/^<|>$/g, "");
}

function basenameWithoutExtension(path: string): string {
  const withoutSubpath = path.split("#")[0].split("^")[0];
  const basename = withoutSubpath.split("/").pop() ?? withoutSubpath;
  return basename.replace(/\.[^/.]+$/, "");
}

function wikilinkFromAnchor(anchor: HTMLAnchorElement): string {
  const target =
    anchor.getAttribute("data-href") ?? anchor.getAttribute("href") ?? "";
  const display = anchor.textContent?.trim() ?? "";

  if (!target) return "";
  if (
    display &&
    display !== target &&
    display !== basenameWithoutExtension(target)
  ) {
    return `[[${target}|${display}]]`;
  }

  return `[[${target}]]`;
}

function fileNameFromAppUrl(src: string): string {
  const url = new URL(src);
  const filename = url.pathname.split("/").pop();
  return filename ? decodeURIComponent(filename) : "";
}

function renderedImageCopyValue(img: HTMLImageElement): string {
  const embed = img.closest(".image-embed, .media-embed");
  const internalSource =
    embed instanceof HTMLElement ? embed.getAttribute("src") : null;
  const alt = img.getAttribute("alt");
  const src = img.getAttribute("src");

  if (internalSource) return embeddedImageTarget(internalSource);
  if (src?.startsWith("app://")) return fileNameFromAppUrl(src);
  return src ?? alt ?? "";
}

function hasDirectImageButton(container: HTMLElement): boolean {
  return Array.from(container.children).some((child) =>
    child.classList.contains("copy-link-image-button")
  );
}

function addFloatingImageButton(img: HTMLImageElement): void {
  const value = renderedImageCopyValue(img);
  if (!value) return;

  const btn = createCopyButton(value, "Copy image link");
  btn.addClass("copy-link-image-button");

  const embed = img.closest(".image-embed, .media-embed");
  if (embed instanceof HTMLElement) {
    if (hasDirectImageButton(embed)) return;
    embed.addClass("copy-link-image-container");
    embed.appendChild(btn);
    return;
  }

  if (img.parentElement?.classList.contains("copy-link-image-container")) {
    if (!hasDirectImageButton(img.parentElement)) img.after(btn);
    return;
  }

  const wrapper = img.ownerDocument.createElement("span");
  wrapper.addClass("copy-link-image-container");
  const parent = img.parentNode;
  if (!parent) return;
  parent.insertBefore(wrapper, img);
  wrapper.appendChild(img);
  wrapper.appendChild(btn);
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
      const value = valueFromMatch(match);
      if (!value) continue;
      const end = from + match.index + match[0].length;
      builder.add(
        end,
        end,
        Decoration.widget({
          widget: new CopyButtonWidget(value),
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
  settings!: CopyLinkSettings;
  private previewImageButton: HTMLElement | null = null;
  private previewImageTarget: HTMLImageElement | null = null;
  private previewImageValue = "";
  private previewImageHideTimer: number | null = null;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CopyLinkSettingTab(this.app, this));
    this.applyVisibilityHotkey();

    this.registerDomEvent(window, "keydown", (evt) =>
      this.updateHotkeyState(evt)
    );
    this.registerDomEvent(window, "keyup", (evt) =>
      this.updateHotkeyState(evt)
    );
    this.registerDomEvent(window, "blur", () => this.clearHotkeyState());
    this.registerDomEvent(activeDocument, "mouseover", (evt) =>
      this.handlePreviewImageMouseOver(evt)
    );
    this.registerDomEvent(activeDocument, "mouseout", (evt) =>
      this.handlePreviewImageMouseOut(evt)
    );
    this.registerDomEvent(
      activeDocument,
      "scroll",
      () => this.removePreviewImageButton(),
      true
    );
    this.registerDomEvent(window, "scroll", () => this.removePreviewImageButton());
    this.registerDomEvent(window, "resize", () => this.removePreviewImageButton());
    this.register(() => {
      activeDocument.body.removeClass(HOTKEY_ENABLED_CLASS);
      activeDocument.body.removeClass(HOTKEY_ACTIVE_CLASS);
      this.removePreviewImageButton();
    });

    // Editing / Live Preview.
    this.registerEditorExtension(copyLinkEditorExtension);

    // Reading view and rendered Live Preview: add buttons after links and over images.
    this.registerMarkdownPostProcessor((el) => {
      const anchors =
        el.querySelectorAll<HTMLAnchorElement>("a.external-link, a.internal-link");
      anchors.forEach((anchor) => {
        const value = anchor.classList.contains("internal-link")
          ? wikilinkFromAnchor(anchor)
          : anchor.getAttribute("href");
        if (!value) return;
        // Avoid adding a second button if this element is reprocessed.
        if (anchor.nextElementSibling?.classList.contains("copy-link-button")) {
          return;
        }
        const btn = createCopyButton(value);
        anchor.after(btn);
      });

      const images = el.querySelectorAll<HTMLImageElement>("img");
      images.forEach(addFloatingImageButton);
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyVisibilityHotkey();
  }

  applyVisibilityHotkey() {
    const enabled = this.settings.visibilityHotkey !== "always";
    activeDocument.body.classList.toggle(HOTKEY_ENABLED_CLASS, enabled);
    if (!enabled) this.clearHotkeyState();
  }

  updateHotkeyState(evt: KeyboardEvent) {
    if (this.settings.visibilityHotkey === "always") return;
    activeDocument.body.classList.toggle(
      HOTKEY_ACTIVE_CLASS,
      this.isHotkeyPressed(evt)
    );
  }

  clearHotkeyState() {
    activeDocument.body.removeClass(HOTKEY_ACTIVE_CLASS);
  }

  isHotkeyPressed(evt: KeyboardEvent): boolean {
    switch (this.settings.visibilityHotkey) {
      case "ctrl":
        return evt.ctrlKey;
      case "meta":
        return evt.metaKey;
      case "alt":
        return evt.altKey;
      case "shift":
        return evt.shiftKey;
      case "always":
        return true;
    }
  }

  handlePreviewImageMouseOver(evt: MouseEvent) {
    const img = this.previewImageFromEvent(evt);
    if (!img) return;
    this.showPreviewImageButton(img);
  }

  handlePreviewImageMouseOut(evt: MouseEvent) {
    if (!this.previewImageTarget) return;

    const relatedTarget = evt.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      (relatedTarget === this.previewImageTarget ||
        this.previewImageButton?.contains(relatedTarget) ||
        this.previewImageTarget.contains(relatedTarget))
    ) {
      return;
    }

    this.schedulePreviewImageButtonRemoval();
  }

  previewImageFromEvent(evt: MouseEvent): HTMLImageElement | null {
    if (!(evt.target instanceof Element)) return null;

    const img = evt.target.closest("img");
    if (!(img instanceof HTMLImageElement)) return null;
    if (!img.closest(".markdown-source-view")) return null;
    if (img.closest(".copy-link-image-container")) return null;

    return img;
  }

  showPreviewImageButton(img: HTMLImageElement) {
    const value = renderedImageCopyValue(img);
    if (!value) return;

    this.clearPreviewImageHideTimer();

    if (
      this.previewImageButton &&
      this.previewImageTarget === img &&
      this.previewImageValue === value
    ) {
      this.positionPreviewImageButton(img);
      return;
    }

    this.removePreviewImageButton();

    const btn = createCopyButton(value, "Copy image link");
    btn.addClass("copy-link-image-button");
    btn.addClass(PREVIEW_IMAGE_BUTTON_CLASS);
    btn.addEventListener("mouseover", () => this.clearPreviewImageHideTimer());
    btn.addEventListener("mouseout", (evt) => {
      if (
        evt.relatedTarget instanceof Node &&
        this.previewImageTarget?.contains(evt.relatedTarget)
      ) {
        return;
      }
      this.schedulePreviewImageButtonRemoval();
    });

    img.ownerDocument.body.appendChild(btn);
    this.previewImageButton = btn;
    this.previewImageTarget = img;
    this.previewImageValue = value;
    this.positionPreviewImageButton(img);
  }

  positionPreviewImageButton(img: HTMLImageElement) {
    if (!this.previewImageButton) return;

    const rect = img.getBoundingClientRect();
    this.previewImageButton.style.left = `${rect.left + IMAGE_BUTTON_MARGIN_PX}px`;
    this.previewImageButton.style.top = `${rect.top + IMAGE_BUTTON_MARGIN_PX}px`;
  }

  schedulePreviewImageButtonRemoval() {
    this.clearPreviewImageHideTimer();
    this.previewImageHideTimer = window.setTimeout(
      () => this.removePreviewImageButton(),
      150
    );
  }

  clearPreviewImageHideTimer() {
    if (this.previewImageHideTimer === null) return;
    window.clearTimeout(this.previewImageHideTimer);
    this.previewImageHideTimer = null;
  }

  removePreviewImageButton() {
    this.clearPreviewImageHideTimer();
    this.previewImageButton?.remove();
    this.previewImageButton = null;
    this.previewImageTarget = null;
    this.previewImageValue = "";
  }
}

class CopyLinkSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CopyLinkPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Copy button visibility")
      .setDesc(
        "Keep copy buttons always visible, or only show them while a modifier key is held."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("always", "Always visible")
          .addOption("ctrl", "Hold Ctrl")
          .addOption("meta", "Hold Cmd")
          .addOption("alt", "Hold Alt")
          .addOption("shift", "Hold Shift")
          .setValue(this.plugin.settings.visibilityHotkey)
          .onChange(async (value) => {
            if (!isVisibilityHotkey(value)) return;
            this.plugin.settings.visibilityHotkey = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

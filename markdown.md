# Markdown Editor

> Filename: `markdown`

A live markdown editor with preview, file upload, and export to Markdown or HTML.

## Build Instructions

**IMPORTANT**: Follow these steps exactly:

1. **Use the template**: Start with `tool.html` as your base
2. **File locations**:
   - Source files in `src/`
   - Build outputs to `dist/`
3. **Output location**: The final `index.html` MUST be in `dist/index.html` - this is the ONLY location for index.html
4. **No root index.html**: Do NOT create an index.html in the project root
5. **Update README.md**: Replace the existing README.md with the content from the "README Content" section below
6. **Icon**: Use `markdown.svg` for the header icon and favicon

## Description

A two-pane markdown editor for writing, viewing, and converting markdown documents. Type or paste markdown on the left and see the rendered result update live on the right. Upload existing `.md` files to edit them, save your work to local browser storage, and export back out as Markdown or HTML when you're done.

## Features

- **Split editor + preview**: Source markdown on the left, live rendered preview on the right
- **Live preview**: Preview updates as you type (debounced)
- **View modes**: Toggle between split view, editor-only, and preview-only (rendered as a whole document)
- **File upload**: Drag-and-drop or file picker to load `.md` / `.markdown` / `.txt` files into the editor
- **Save to local storage**: Save the current document to browser localStorage with a chosen name
- **Document list**: Sidebar/dropdown of saved documents with load, rename, and delete actions
- **Auto-save**: The current working document is auto-saved to localStorage on every change (debounced)
- **Export Markdown**: Download the current editor contents as a `.md` file
- **Export HTML**: Download the rendered preview as a complete, standalone `.html` file with embedded CSS (bonus feature)
- **Copy to clipboard**: Copy raw markdown or rendered HTML with one click
- **GitHub-flavored markdown**: Tables, fenced code blocks, task lists, strikethrough, autolinks
- **Syntax-safe rendering**: All rendered HTML is sanitized to prevent XSS from pasted/uploaded content
- **Synchronized scrolling**: When in split view, scrolling the editor scrolls the preview proportionally
- **Word and character count**: Subtle counter in the footer
- **Dark/Light theme**: Toggle theme; preference persists in localStorage
- **Keyboard shortcuts**: Common formatting (bold, italic, link, code) and view toggles

## User Interface

### Layout

- **Header bar** (top):
  - Tool icon and title on the left
  - Document name (editable inline) in the center
  - Action buttons on the right: Upload, Save, Export ▾ (Markdown / HTML), Copy ▾ (Markdown / HTML), Documents ▾, Theme toggle, View toggle
- **Main area**: Two-pane split view (50/50 by default, draggable divider)
  - **Left pane**: Plain `<textarea>` for markdown source with monospace font and line numbers (optional)
  - **Right pane**: Rendered HTML preview with markdown styling
- **View toggle**: Cycles through three modes
  1. Split (editor + preview)
  2. Editor only
  3. Preview only (renders the markdown as a whole document, full width)
- **Footer bar** (bottom): word count, character count, save status indicator ("Saved" / "Saving…")
- **Documents panel** (slide-out from the right or dropdown): List of saved documents with name, last-modified date, and load/rename/delete actions

### Controls and inputs

- **Upload button**: Opens file picker for `.md`, `.markdown`, `.txt`. Also supports drag-and-drop anywhere on the editor pane.
- **Save button**: Saves current document to localStorage. If unnamed, prompts for a name.
- **Export dropdown**: "Export as Markdown (.md)" and "Export as HTML (.html)"
- **Copy dropdown**: "Copy Markdown" and "Copy HTML"
- **Documents dropdown**: Lists saved docs; clicking a doc loads it (with unsaved-changes warning if needed)
- **Theme toggle**: Sun/moon icon switches dark/light
- **Editable document name**: Click on the title in the header to rename

### Preview-only mode

When the user toggles to preview-only, the preview should render full-width with comfortable reading margins (max-width ~720px, centered) — essentially "view it just rendered out as a whole" like a published article.

## Technical Requirements

### Dependencies

```json
{
  "dependencies": {
    "marked": "^12.0.0",
    "dompurify": "^3.1.0"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

- **marked**: Pure JavaScript markdown parser. No external calls at runtime. Configure with GFM enabled.
- **dompurify**: Pure JavaScript HTML sanitizer. No external calls at runtime. Used to sanitize the HTML produced by `marked` before injecting it into the preview pane.
- **vite**: Build tool only (dev/build time). Bundles everything to a single static `dist/`.

All dependencies are pure JS with no runtime fetches. The bundler inlines them into local assets — no CDN references at runtime.

### Build

```bash
npm install
npm run build
```

Source lives in `src/` (entry `src/index.html`, `src/main.js`, `src/styles.css`). Vite outputs to `../dist`.

### Output

```
dist/
├── index.html
└── assets/
    ├── index-{hash}.js
    └── index-{hash}.css
```

Everything bundled locally. No CDN links. Works offline once loaded.

## Storage

- **localStorage**:
  - `markdown-docs` — JSON array of saved documents: `[{ id, name, content, created, modified }]`
  - `markdown-current-id` — id of the document currently being edited (so reopening the tab restores it)
  - `markdown-current-draft` — the live, unsaved content of the current editor (auto-saved on every change so nothing is lost on refresh)
  - `markdown-theme` — `"light"` or `"dark"`
  - `markdown-view-mode` — `"split"` | `"editor"` | `"preview"`
  - `markdown-split-ratio` — number between 0 and 1 for the divider position

Warn the user if a save fails because localStorage is full and suggest exporting to a file.

## Icon Colors

The icon background uses a gradient. These colors are used for:
- The icon background gradient in the tool header
- The favicon background gradient
- The tool card on the main wbtl.app site

| Property | Value |
|----------|-------|
| Gradient Start | #475569 |
| Gradient End | #334155 |

(Slate gradient — evokes the classic markdown logo's neutral, document-centric aesthetic.)

## README Content

**Replace the existing README.md with this content:**

```markdown
# Markdown Editor

A live markdown editor with preview, file upload, and export to Markdown or HTML.

https://markdown.wbtl.app

## Development

### Setup
```bash
npm install
```

### Build
```bash
npm run build
```

## Output

Production files are in the `dist/` folder:
- `dist/index.html` - Main application
- `dist/assets/` - Bundled JS and CSS

## Deploy

Copy the contents of `dist/` to any static hosting service.
```

## Technical Notes

### Rendering markdown safely

```javascript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,           // GitHub-flavored markdown
  breaks: false,       // single newline ≠ <br> (standard CommonMark behavior)
  headerIds: true,
  mangle: false,
});

function renderMarkdown(src) {
  const rawHtml = marked.parse(src);
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}
```

Always pass the rendered HTML through DOMPurify before assigning to `previewEl.innerHTML`. Uploaded `.md` files can contain raw HTML — sanitization is mandatory.

### Live preview with debounce

```javascript
function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const updatePreview = debounce(() => {
  preview.innerHTML = renderMarkdown(editor.value);
}, 100);

const autoSaveDraft = debounce(() => {
  localStorage.setItem('markdown-current-draft', editor.value);
}, 500);

editor.addEventListener('input', () => {
  updatePreview();
  autoSaveDraft();
  updateCounts();
});
```

### File upload

```javascript
async function loadFile(file) {
  if (!file) return;
  const text = await file.text();
  editor.value = text;
  documentName = file.name.replace(/\.(md|markdown|txt)$/i, '');
  updatePreview();
  autoSaveDraft();
}

uploadInput.addEventListener('change', e => loadFile(e.target.files[0]));

// Drag-and-drop
['dragover', 'dragenter'].forEach(ev =>
  document.addEventListener(ev, e => { e.preventDefault(); document.body.classList.add('dragging'); })
);
['dragleave', 'drop'].forEach(ev =>
  document.addEventListener(ev, e => { e.preventDefault(); document.body.classList.remove('dragging'); })
);
document.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});
```

### Export Markdown

```javascript
function exportMarkdown() {
  const blob = new Blob([editor.value], { type: 'text/markdown' });
  triggerDownload(blob, `${documentName || 'document'}.md`);
}
```

### Export HTML (standalone)

The HTML export should produce a complete, self-contained document with embedded CSS so it looks the same as the in-app preview when opened anywhere:

```javascript
function exportHtml() {
  const body = renderMarkdown(editor.value);
  const title = documentName || 'Document';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1f2937; }
  h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; line-height: 1.25; }
  pre { background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { background: #f3f4f6; padding: 0.15em 0.35em; border-radius: 3px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #d1d5db; margin: 0; padding-left: 1rem; color: #4b5563; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 0.4em 0.7em; }
  img { max-width: 100%; }
  hr { border: 0; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>
${body}
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  triggerDownload(blob, `${documentName || 'document'}.html`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
```

### Document storage

```javascript
const DOCS_KEY = 'markdown-docs';

function loadDocs() {
  try { return JSON.parse(localStorage.getItem(DOCS_KEY)) || []; }
  catch { return []; }
}

function saveDocs(docs) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
}

function saveCurrent(name, content) {
  const docs = loadDocs();
  const now = new Date().toISOString();
  let doc = docs.find(d => d.name === name);
  if (doc) {
    doc.content = content;
    doc.modified = now;
  } else {
    doc = { id: crypto.randomUUID(), name, content, created: now, modified: now };
    docs.push(doc);
  }
  saveDocs(docs);
  return doc;
}
```

### Synchronized scrolling

```javascript
let syncing = false;
function syncScroll(from, to) {
  if (syncing) return;
  syncing = true;
  const ratio = from.scrollTop / (from.scrollHeight - from.clientHeight || 1);
  to.scrollTop = ratio * (to.scrollHeight - to.clientHeight);
  requestAnimationFrame(() => { syncing = false; });
}
editor.addEventListener('scroll', () => syncScroll(editor, preview));
preview.addEventListener('scroll', () => syncScroll(preview, editor));
```

### Keyboard shortcuts

- `Ctrl/Cmd + S` — Save current document (also shows "Saved" indicator)
- `Ctrl/Cmd + B` — Wrap selection in `**bold**`
- `Ctrl/Cmd + I` — Wrap selection in `*italic*`
- `Ctrl/Cmd + K` — Wrap selection as link `[text](url)`
- `Ctrl/Cmd + E` — Toggle view mode (split → editor → preview → split)
- `Ctrl/Cmd + O` — Open file picker
- `Ctrl/Cmd + Shift + E` — Export as Markdown
- `Ctrl/Cmd + Shift + H` — Export as HTML

Always call `e.preventDefault()` on these so the browser's defaults don't interfere.

### Preview styling

The preview pane should use sensible defaults for headings, lists, code blocks, tables, and blockquotes that match common markdown rendering (similar to GitHub's style but lighter). The same CSS rules used for the in-app preview should be embedded in the HTML export so the output looks consistent.

## Notes

- All processing is local — markdown is parsed and rendered in the browser
- No external API calls
- No CDN references — `marked` and `dompurify` are bundled
- Works offline
- Sanitize all rendered HTML through DOMPurify; markdown can include arbitrary HTML
- Warn before loading a different document if there are unsaved changes
- Handle large documents gracefully — debounce preview updates and avoid re-rendering on every keystroke

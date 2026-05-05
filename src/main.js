import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ----- Constants -----
const STORAGE = {
  DOCS: 'markdown-docs',
  CURRENT_ID: 'markdown-current-id',
  DRAFT: 'markdown-current-draft',
  DRAFT_NAME: 'markdown-current-name',
  THEME: 'wbtl-theme',
  VIEW: 'markdown-view-mode',
  SPLIT: 'markdown-split-ratio',
};

const DEFAULT_DOC = `# Welcome to the Markdown Editor

Type or paste **markdown** on the left and see the rendered preview on the right.

## Features

- Live preview with GitHub-flavored markdown
- Drag-and-drop file upload (\`.md\`, \`.markdown\`, \`.txt\`)
- Save documents to local storage
- Export as Markdown or HTML

## Try it out

> Edit this text to see the preview update.

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

| Shortcut | Action |
|----------|--------|
| \`Ctrl/Cmd + S\` | Save |
| \`Ctrl/Cmd + B\` | Bold |
| \`Ctrl/Cmd + I\` | Italic |
| \`Ctrl/Cmd + E\` | Cycle view |

- [x] Write some markdown
- [ ] Export to HTML
- [ ] Share with the world
`;

// ----- Marked configuration -----
marked.setOptions({
  gfm: true,
  breaks: false,
});

function renderMarkdown(src) {
  const rawHtml = marked.parse(src || '');
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}

// ----- Utilities -----
function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const opts = sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' };
  return d.toLocaleString(undefined, opts);
}

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'd_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ----- DOM refs -----
const $ = (id) => document.getElementById(id);
const editor = $('editor');
const preview = $('preview');
const workspace = $('workspace');
const editorPane = $('editorPane');
const previewPane = $('previewPane');
const divider = $('divider');
const docNameInput = $('docName');
const wordCountEl = $('wordCount');
const charCountEl = $('charCount');
const saveStatusEl = $('saveStatus');
const fileInput = $('fileInput');
const docsPanel = $('docsPanel');
const docsBackdrop = $('docsBackdrop');
const docsList = $('docsList');
const dropOverlay = $('dropOverlay');
const toast = $('toast');
const themeToggle = $('themeToggle');
const viewBtn = $('viewBtn');
const viewIcon = $('viewIcon');

// ----- State -----
let currentId = localStorage.getItem(STORAGE.CURRENT_ID) || null;
let viewMode = localStorage.getItem(STORAGE.VIEW) || 'split';
let splitRatio = parseFloat(localStorage.getItem(STORAGE.SPLIT)) || 0.5;
let dirty = false;

// ----- Toast -----
let toastTimer;
function showToast(msg, ms = 1800) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

// ----- Save status -----
function setSaveStatus(text, kind = '') {
  saveStatusEl.textContent = text;
  saveStatusEl.className = 'save-status' + (kind ? ' ' + kind : '');
}

// ----- Theme -----
function applyStoredTheme() {
  const stored = localStorage.getItem(STORAGE.THEME);
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let next;
  if (!current) {
    next = system === 'dark' ? 'light' : 'dark';
  } else if (current === system) {
    next = current === 'dark' ? 'light' : 'dark';
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem(STORAGE.THEME);
    return;
  }
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE.THEME, next);
}

applyStoredTheme();
themeToggle.addEventListener('click', toggleTheme);
themeToggle.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTheme(); }
});

// ----- Document storage -----
function loadDocs() {
  try {
    const raw = localStorage.getItem(STORAGE.DOCS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistDocs(docs) {
  try {
    localStorage.setItem(STORAGE.DOCS, JSON.stringify(docs));
    return true;
  } catch (err) {
    showToast('Storage full — export to a file to keep your work.');
    setSaveStatus('Save failed', 'error');
    return false;
  }
}

function getDoc(id) {
  return loadDocs().find(d => d.id === id);
}

function upsertDoc(doc) {
  const docs = loadDocs();
  const idx = docs.findIndex(d => d.id === doc.id);
  if (idx >= 0) docs[idx] = doc;
  else docs.push(doc);
  return persistDocs(docs) ? doc : null;
}

function deleteDoc(id) {
  const docs = loadDocs().filter(d => d.id !== id);
  persistDocs(docs);
}

// ----- Counts -----
function updateCounts() {
  const text = editor.value;
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  wordCountEl.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;
  charCountEl.textContent = `${chars.toLocaleString()} ${chars === 1 ? 'character' : 'characters'}`;
}

// ----- Preview -----
function renderPreviewNow() {
  preview.innerHTML = renderMarkdown(editor.value);
}

const updatePreview = debounce(renderPreviewNow, 100);

// ----- Auto-save draft -----
const autoSaveDraft = debounce(() => {
  try {
    localStorage.setItem(STORAGE.DRAFT, editor.value);
    localStorage.setItem(STORAGE.DRAFT_NAME, docNameInput.value);
    if (currentId) {
      const doc = getDoc(currentId);
      if (doc) {
        doc.content = editor.value;
        doc.name = docNameInput.value || doc.name;
        doc.modified = new Date().toISOString();
        upsertDoc(doc);
        setSaveStatus('Saved', 'saved');
      }
    } else {
      setSaveStatus('Draft', 'saved');
    }
  } catch {
    setSaveStatus('Save failed', 'error');
  }
}, 600);

function markDirty() {
  dirty = true;
  setSaveStatus('Saving…', 'saving');
}

// ----- Editor input -----
editor.addEventListener('input', () => {
  markDirty();
  updatePreview();
  updateCounts();
  autoSaveDraft();
});

editor.addEventListener('scroll', () => syncScroll(editor, previewPane));
previewPane.addEventListener('scroll', () => syncScroll(previewPane, editor));

// ----- Synchronized scrolling -----
let syncing = false;
function syncScroll(from, to) {
  if (syncing) return;
  if (workspace.dataset.view !== 'split') return;
  syncing = true;
  const fromMax = (from.scrollHeight - from.clientHeight) || 1;
  const ratio = from.scrollTop / fromMax;
  const toMax = (to.scrollHeight - to.clientHeight) || 1;
  to.scrollTop = ratio * toMax;
  requestAnimationFrame(() => { syncing = false; });
}

// ----- Document name -----
docNameInput.addEventListener('input', () => {
  markDirty();
  autoSaveDraft();
});

docNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); docNameInput.blur(); }
});

// ----- Load / new document -----
function loadDocument(doc) {
  if (dirty && currentId !== doc.id) {
    if (!confirm('You have unsaved changes. Load "' + doc.name + '" anyway?')) return false;
  }
  currentId = doc.id;
  localStorage.setItem(STORAGE.CURRENT_ID, currentId);
  editor.value = doc.content || '';
  docNameInput.value = doc.name || 'Untitled';
  renderPreviewNow();
  updateCounts();
  dirty = false;
  setSaveStatus('Saved', 'saved');
  renderDocsList();
  return true;
}

function newDocument() {
  if (dirty && (editor.value.trim() || currentId)) {
    if (!confirm('Discard current changes and start a new document?')) return;
  }
  currentId = null;
  localStorage.removeItem(STORAGE.CURRENT_ID);
  editor.value = '';
  docNameInput.value = 'Untitled';
  renderPreviewNow();
  updateCounts();
  dirty = false;
  setSaveStatus('Ready', 'saved');
  renderDocsList();
  editor.focus();
}

function saveCurrent() {
  let name = (docNameInput.value || '').trim();
  if (!name || name === 'Untitled') {
    const entered = prompt('Document name:', name && name !== 'Untitled' ? name : 'My Document');
    if (entered === null) return;
    name = entered.trim() || 'Untitled';
    docNameInput.value = name;
  }
  const now = new Date().toISOString();
  let doc;
  if (currentId) {
    doc = getDoc(currentId);
    if (!doc) doc = { id: currentId };
    doc.name = name;
    doc.content = editor.value;
    doc.modified = now;
    if (!doc.created) doc.created = now;
  } else {
    doc = {
      id: uid(),
      name,
      content: editor.value,
      created: now,
      modified: now,
    };
    currentId = doc.id;
    localStorage.setItem(STORAGE.CURRENT_ID, currentId);
  }
  if (upsertDoc(doc)) {
    dirty = false;
    setSaveStatus('Saved', 'saved');
    showToast('Saved "' + name + '"');
    renderDocsList();
  }
}

// ----- Documents list rendering -----
function renderDocsList() {
  const docs = loadDocs().slice().sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
  docsList.innerHTML = '';
  if (!docs.length) {
    const empty = document.createElement('div');
    empty.className = 'docs-empty';
    empty.textContent = 'No saved documents yet. Click Save to add one.';
    docsList.appendChild(empty);
    return;
  }
  for (const doc of docs) {
    const li = document.createElement('li');
    li.className = 'doc-item' + (doc.id === currentId ? ' active' : '');
    li.dataset.id = doc.id;

    const titleRow = document.createElement('div');
    titleRow.className = 'doc-item-title';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = doc.name || 'Untitled';
    titleRow.appendChild(titleSpan);

    const actions = document.createElement('div');
    actions.className = 'doc-item-actions';

    const renameBtn = document.createElement('button');
    renameBtn.title = 'Rename';
    renameBtn.setAttribute('aria-label', 'Rename document');
    renameBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    renameBtn.addEventListener('click', e => {
      e.stopPropagation();
      const next = prompt('Rename document:', doc.name || 'Untitled');
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed) return;
      doc.name = trimmed;
      doc.modified = new Date().toISOString();
      upsertDoc(doc);
      if (doc.id === currentId) docNameInput.value = trimmed;
      renderDocsList();
    });

    const delBtn = document.createElement('button');
    delBtn.title = 'Delete';
    delBtn.setAttribute('aria-label', 'Delete document');
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('Delete "' + (doc.name || 'Untitled') + '"?')) return;
      deleteDoc(doc.id);
      if (doc.id === currentId) {
        currentId = null;
        localStorage.removeItem(STORAGE.CURRENT_ID);
        setSaveStatus('Ready', 'saved');
      }
      renderDocsList();
    });

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    titleRow.appendChild(actions);

    const meta = document.createElement('div');
    meta.className = 'doc-item-meta';
    meta.textContent = formatDate(doc.modified || doc.created);

    li.appendChild(titleRow);
    li.appendChild(meta);

    li.addEventListener('click', () => {
      if (loadDocument(doc)) closeDocs();
    });

    docsList.appendChild(li);
  }
}

// ----- Docs panel open/close -----
function openDocs() {
  renderDocsList();
  docsPanel.classList.add('open');
  docsBackdrop.classList.add('open');
  docsPanel.setAttribute('aria-hidden', 'false');
}
function closeDocs() {
  docsPanel.classList.remove('open');
  docsBackdrop.classList.remove('open');
  docsPanel.setAttribute('aria-hidden', 'true');
}

$('docsBtn').addEventListener('click', () => {
  if (docsPanel.classList.contains('open')) closeDocs();
  else openDocs();
});
$('docsCloseBtn').addEventListener('click', closeDocs);
docsBackdrop.addEventListener('click', closeDocs);
$('newDocBtn').addEventListener('click', () => { newDocument(); closeDocs(); });

// ----- File upload -----
async function loadFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large (max 10MB)');
    return;
  }
  try {
    const text = await file.text();
    if (dirty && (editor.value.trim() || currentId)) {
      if (!confirm('Replace current document with "' + file.name + '"?')) return;
    }
    editor.value = text;
    const baseName = file.name.replace(/\.(md|markdown|txt)$/i, '');
    docNameInput.value = baseName || 'Untitled';
    currentId = null;
    localStorage.removeItem(STORAGE.CURRENT_ID);
    renderPreviewNow();
    updateCounts();
    markDirty();
    autoSaveDraft();
    showToast('Loaded "' + file.name + '"');
  } catch (err) {
    showToast('Failed to read file');
  }
}

$('uploadBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) loadFile(f);
  fileInput.value = '';
});

// ----- Drag and drop -----
let dragDepth = 0;
window.addEventListener('dragenter', e => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
  e.preventDefault();
  dragDepth++;
  document.body.classList.add('dragging');
});
window.addEventListener('dragover', e => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
  e.preventDefault();
});
window.addEventListener('dragleave', e => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('dragging');
});
window.addEventListener('drop', e => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

// ----- Save button -----
$('saveBtn').addEventListener('click', saveCurrent);

// ----- Dropdowns (Export / Copy) -----
const dropdowns = document.querySelectorAll('.dropdown');
dropdowns.forEach(dd => {
  const trigger = dd.querySelector('[data-toggle]');
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = dd.classList.contains('open');
    dropdowns.forEach(other => other.classList.remove('open'));
    if (!wasOpen) {
      dd.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    } else {
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
});
document.addEventListener('click', () => {
  dropdowns.forEach(dd => {
    dd.classList.remove('open');
    const trigger = dd.querySelector('[data-toggle]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
});

// ----- Action handlers -----
function exportMarkdown() {
  const name = (docNameInput.value || 'document').trim() || 'document';
  const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${name}.md`);
  showToast('Exported markdown');
}

function exportHtml() {
  const body = renderMarkdown(editor.value);
  const title = (docNameInput.value || 'Document').trim() || 'Document';
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
  h1, h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  pre { background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { background: #f3f4f6; padding: 0.15em 0.35em; border-radius: 3px; font-size: 0.9em;
         font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  pre code { background: none; padding: 0; font-size: 0.9em; }
  blockquote { border-left: 4px solid #d1d5db; margin: 0; padding: 0.2em 1em; color: #4b5563; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #d1d5db; padding: 0.4em 0.7em; }
  th { background: #f9fafb; }
  img { max-width: 100%; border-radius: 4px; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
  a { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
${body}
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${title}.html`);
  showToast('Exported HTML');
}

async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied ' + label);
  } catch {
    showToast('Copy failed');
  }
}

document.addEventListener('click', e => {
  const item = e.target.closest('.menu-item');
  if (!item) return;
  const action = item.dataset.action;
  switch (action) {
    case 'export-md': exportMarkdown(); break;
    case 'export-html': exportHtml(); break;
    case 'copy-md': copyToClipboard(editor.value, 'markdown'); break;
    case 'copy-html': copyToClipboard(renderMarkdown(editor.value), 'HTML'); break;
  }
});

// ----- View mode -----
function setViewMode(mode) {
  if (!['split', 'editor', 'preview'].includes(mode)) mode = 'split';
  viewMode = mode;
  workspace.dataset.view = mode;
  localStorage.setItem(STORAGE.VIEW, mode);
  applySplitRatio();
  updateViewIcon();
  if (mode === 'preview') renderPreviewNow();
}

function cycleView() {
  const next = viewMode === 'split' ? 'editor' : viewMode === 'editor' ? 'preview' : 'split';
  setViewMode(next);
}

function updateViewIcon() {
  let svg;
  if (viewMode === 'split') {
    svg = '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>';
    viewBtn.title = 'View: Split (Ctrl+E)';
  } else if (viewMode === 'editor') {
    svg = '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="15" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/>';
    viewBtn.title = 'View: Editor (Ctrl+E)';
  } else {
    svg = '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z"/>';
    viewBtn.title = 'View: Preview (Ctrl+E)';
  }
  viewIcon.innerHTML = svg;
}

viewBtn.addEventListener('click', cycleView);

// ----- Splitter -----
function applySplitRatio() {
  if (viewMode !== 'split') {
    editorPane.style.flex = '';
    previewPane.style.flex = '';
    return;
  }
  const r = Math.max(0.15, Math.min(0.85, splitRatio));
  editorPane.style.flex = `${r} 1 0`;
  previewPane.style.flex = `${1 - r} 1 0`;
}

let dragging = false;
divider.addEventListener('mousedown', e => {
  dragging = true;
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const rect = workspace.getBoundingClientRect();
  const x = e.clientX - rect.left;
  splitRatio = x / rect.width;
  applySplitRatio();
});
window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  document.body.style.cursor = '';
  splitRatio = Math.max(0.15, Math.min(0.85, splitRatio));
  localStorage.setItem(STORAGE.SPLIT, String(splitRatio));
});

divider.addEventListener('keydown', e => {
  let delta = 0;
  if (e.key === 'ArrowLeft') delta = -0.05;
  else if (e.key === 'ArrowRight') delta = 0.05;
  else return;
  e.preventDefault();
  splitRatio = Math.max(0.15, Math.min(0.85, splitRatio + delta));
  applySplitRatio();
  localStorage.setItem(STORAGE.SPLIT, String(splitRatio));
});

// ----- Keyboard shortcuts -----
function wrapSelection(before, after = before, placeholder = '') {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const selected = value.slice(start, end) || placeholder;
  const replacement = before + selected + after;
  editor.value = value.slice(0, start) + replacement + value.slice(end);
  if (selected === placeholder && placeholder) {
    editor.selectionStart = start + before.length;
    editor.selectionEnd = start + before.length + placeholder.length;
  } else {
    editor.selectionStart = start + before.length;
    editor.selectionEnd = start + before.length + selected.length;
  }
  editor.focus();
  markDirty();
  updatePreview();
  updateCounts();
  autoSaveDraft();
}

function insertLink() {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const selected = value.slice(start, end) || 'text';
  const replacement = `[${selected}](url)`;
  editor.value = value.slice(0, start) + replacement + value.slice(end);
  const urlStart = start + selected.length + 3;
  editor.selectionStart = urlStart;
  editor.selectionEnd = urlStart + 3;
  editor.focus();
  markDirty();
  updatePreview();
  updateCounts();
  autoSaveDraft();
}

document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();

  if (e.shiftKey) {
    if (k === 'e') { e.preventDefault(); exportMarkdown(); return; }
    if (k === 'h') { e.preventDefault(); exportHtml(); return; }
  }

  if (k === 's') { e.preventDefault(); saveCurrent(); return; }
  if (k === 'o') { e.preventDefault(); fileInput.click(); return; }
  if (k === 'e') { e.preventDefault(); cycleView(); return; }

  // Formatting shortcuts only when editor is focused
  if (document.activeElement !== editor) return;

  if (k === 'b') { e.preventDefault(); wrapSelection('**', '**', 'bold'); return; }
  if (k === 'i') { e.preventDefault(); wrapSelection('*', '*', 'italic'); return; }
  if (k === 'k') { e.preventDefault(); insertLink(); return; }
});

// Tab key indents in the editor
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    if (start === end) {
      editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
    } else {
      const before = editor.value.slice(0, start);
      const sel = editor.value.slice(start, end);
      const after = editor.value.slice(end);
      const indented = sel.split('\n').map(l => e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l).join('\n');
      editor.value = before + indented + after;
      editor.selectionStart = start;
      editor.selectionEnd = start + indented.length;
    }
    markDirty();
    updatePreview();
    updateCounts();
    autoSaveDraft();
  }
});

// ----- Warn before leaving with unsaved changes -----
window.addEventListener('beforeunload', e => {
  if (dirty && currentId === null && editor.value.trim()) {
    // Draft is auto-saved, so this is mostly a courtesy
  }
});

// ----- Initialization -----
function init() {
  setViewMode(viewMode);
  applySplitRatio();

  // Restore current document or draft
  const draft = localStorage.getItem(STORAGE.DRAFT);
  const draftName = localStorage.getItem(STORAGE.DRAFT_NAME);

  if (currentId) {
    const doc = getDoc(currentId);
    if (doc) {
      editor.value = doc.content || '';
      docNameInput.value = doc.name || 'Untitled';
      // If draft differs, prefer the draft (unsaved changes)
      if (draft != null && draft !== doc.content) {
        editor.value = draft;
        if (draftName) docNameInput.value = draftName;
        dirty = true;
        setSaveStatus('Draft', 'saving');
      } else {
        setSaveStatus('Saved', 'saved');
      }
    } else {
      currentId = null;
      localStorage.removeItem(STORAGE.CURRENT_ID);
      if (draft != null) {
        editor.value = draft;
        if (draftName) docNameInput.value = draftName;
        setSaveStatus('Draft', 'saving');
      } else {
        editor.value = DEFAULT_DOC;
      }
    }
  } else if (draft != null) {
    editor.value = draft;
    if (draftName) docNameInput.value = draftName;
    setSaveStatus('Draft', 'saving');
  } else {
    editor.value = DEFAULT_DOC;
    setSaveStatus('Ready', 'saved');
  }

  renderPreviewNow();
  updateCounts();
  renderDocsList();
}

init();

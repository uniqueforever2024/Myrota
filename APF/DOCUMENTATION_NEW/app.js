const API_CANDIDATES = ["/api", "./api"];

const homeButton = document.getElementById("home-button");
const workspaceStatusEl = document.getElementById("workspace-status");
const openEditorButton = document.getElementById("open-editor-button");
const closeEditorButton = document.getElementById("close-editor-button");
const editorPanel = document.getElementById("editor-panel");
const noteForm = document.getElementById("note-form");
const noteIdInput = document.getElementById("note-id");
const noteTitleInput = document.getElementById("note-title");
const noteTagInput = document.getElementById("note-tag");
const noteBodyInput = document.getElementById("note-body");
const noteMediaInput = document.getElementById("note-media");
const mediaNameEl = document.getElementById("media-name");
const mediaPreviewEl = document.getElementById("media-preview");
const mediaPreviewImageEl = document.getElementById("media-preview-image");
const mediaPreviewFileEl = document.getElementById("media-preview-file");
const resetFormButton = document.getElementById("reset-form-button");
const formStatusEl = document.getElementById("form-status");
const notesGrid = document.getElementById("notes-grid");
const searchInput = document.getElementById("search-input");
const noteCountEl = document.getElementById("note-count");
const editorTitleEl = document.getElementById("editor-title");

let notes = [];
let searchTerm = "";
let pendingMedia = null;
let apiBaseUrl = "";

function setWorkspaceStatus(message, type = "") {
  if (!workspaceStatusEl) {
    return;
  }

  workspaceStatusEl.textContent = message || "";
  workspaceStatusEl.classList.remove("success", "error");

  if (type) {
    workspaceStatusEl.classList.add(type);
  }
}

function setFormStatus(message, type = "") {
  formStatusEl.textContent = message || "";
  formStatusEl.classList.remove("success", "error");

  if (type) {
    formStatusEl.classList.add(type);
  }
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMedia(media, fallback = {}) {
  const mediaName = String(media?.name || fallback.mediaName || "").trim();
  const mediaType = String(media?.type || fallback.mediaType || "").trim();
  const mediaDataUrl = String(media?.dataUrl || fallback.mediaDataUrl || "").trim();

  if (!mediaName && !mediaType && !mediaDataUrl) {
    return null;
  }

  return {
    name: mediaName,
    type: mediaType,
    dataUrl: mediaDataUrl,
  };
}

function normalizeNote(note) {
  const media = normalizeMedia(note.media, {
    mediaName: note.mediaName,
    mediaType: note.mediaType,
    mediaDataUrl: note.mediaDataUrl,
  });

  return {
    id: String(note.id || "").trim() || createId(),
    title: String(note.title || "").trim(),
    tag: String(note.tag || "").trim(),
    body: String(note.body || "").trim(),
    media,
    mediaName: media?.name || "",
    createdAt: String(note.createdAt || "").trim() || new Date().toISOString(),
    updatedAt: String(note.updatedAt || "").trim() || new Date().toISOString(),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortNotes(records) {
  return [...records].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function getVisibleNotes() {
  if (!searchTerm) {
    return sortNotes(notes);
  }

  const normalized = searchTerm.toLowerCase();
  return sortNotes(notes).filter((note) =>
    [note.title, note.tag, note.body, note.mediaName].some((value) =>
      String(value || "").toLowerCase().includes(normalized)
    )
  );
}

function openEditor() {
  editorPanel.classList.remove("hidden");
}

function closeEditor() {
  editorPanel.classList.add("hidden");
}

function resetMediaPreview() {
  mediaPreviewEl.classList.add("hidden");
  mediaPreviewImageEl.removeAttribute("src");
  mediaPreviewFileEl.textContent = "";
  mediaPreviewFileEl.classList.add("hidden");
  mediaNameEl.textContent = "No media uploaded yet";
  pendingMedia = null;
}

function fillMediaPreview(media) {
  if (!media || !media.name) {
    resetMediaPreview();
    return;
  }

  mediaPreviewEl.classList.remove("hidden");
  mediaNameEl.textContent = media.name;

  if (media.type && media.type.startsWith("image/") && media.dataUrl) {
    mediaPreviewImageEl.src = media.dataUrl;
    mediaPreviewImageEl.classList.remove("hidden");
    mediaPreviewFileEl.textContent = "";
    mediaPreviewFileEl.classList.add("hidden");
    return;
  }

  mediaPreviewImageEl.removeAttribute("src");
  mediaPreviewImageEl.classList.add("hidden");
  mediaPreviewFileEl.textContent = media.name;
  mediaPreviewFileEl.classList.remove("hidden");
}

function resetForm() {
  noteForm.reset();
  noteIdInput.value = "";
  editorTitleEl.textContent = "Create a documentation page";
  setFormStatus("");
  resetMediaPreview();
}

function beginCreateNote() {
  resetForm();
  openEditor();
  noteTitleInput.focus();
}

function editNote(noteId) {
  const note = notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  noteIdInput.value = note.id;
  noteTitleInput.value = note.title;
  noteTagInput.value = note.tag;
  noteBodyInput.value = note.body;
  pendingMedia = note.media || null;
  fillMediaPreview(pendingMedia);
  editorTitleEl.textContent = "Edit documentation page";
  setFormStatus("");
  openEditor();
  noteTitleInput.focus();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleMediaSelection() {
  const selectedFile = noteMediaInput.files && noteMediaInput.files[0];

  if (!selectedFile) {
    resetMediaPreview();
    return;
  }

  if (selectedFile.size > 2.5 * 1024 * 1024) {
    noteMediaInput.value = "";
    setFormStatus("Please upload a file smaller than 2.5 MB.", "error");
    resetMediaPreview();
    return;
  }

  const dataUrl = await readFileAsDataUrl(selectedFile);
  pendingMedia = {
    name: selectedFile.name,
    type: selectedFile.type || "application/octet-stream",
    dataUrl,
  };
  fillMediaPreview(pendingMedia);
  setFormStatus("");
}

function buildPdfHtml(note) {
  const mediaMarkup =
    note.media && note.media.type && note.media.type.startsWith("image/") && note.media.dataUrl
      ? `<img src="${note.media.dataUrl}" alt="${escapeHtml(
          note.media.name
        )}" style="width:100%;max-height:380px;object-fit:contain;border-radius:18px;border:1px solid #d5e5f7;margin-top:18px;" />`
      : note.media && note.media.name
        ? `<p style="margin-top:18px;font-weight:700;color:#0b4f92;">Attachment: ${escapeHtml(
            note.media.name
          )}</p>`
        : "";

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(note.title)}</title>
      <style>
        body {
          margin: 0;
          padding: 28px;
          font-family: Aptos, "Trebuchet MS", "Segoe UI", sans-serif;
          background: #eef7ff;
          color: #15304d;
        }
        .page {
          max-width: 780px;
          margin: 0 auto;
          padding: 34px 36px;
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 12px 34px rgba(6, 43, 89, 0.12);
          border-left: 6px solid #46afff;
        }
        .eyebrow {
          margin: 0 0 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-size: 12px;
          font-weight: 700;
          color: #0c66bd;
        }
        h1 {
          margin: 0 0 12px;
          font-family: "Book Antiqua", "Palatino Linotype", Georgia, serif;
          color: #0b4f92;
        }
        .meta {
          margin: 0 0 24px;
          color: #65809f;
          font-size: 14px;
        }
        .body {
          white-space: pre-wrap;
          line-height: 1.75;
        }
      </style>
    </head>
    <body>
      <article class="page">
        <p class="eyebrow">${escapeHtml(note.tag)}</p>
        <h1>${escapeHtml(note.title)}</h1>
        <p class="meta">Updated ${escapeHtml(formatDateTime(note.updatedAt))}</p>
        <div class="body">${escapeHtml(note.body)}</div>
        ${mediaMarkup}
      </article>
      <script>
        window.onload = function () {
          window.print();
        };
      </script>
    </body>
  </html>`;
}

function downloadPdf(noteId) {
  const note = notes.find((item) => item.id === noteId);

  if (!note) {
    return;
  }

  const exportWindow = window.open("", "_blank", "width=900,height=900");

  if (!exportWindow) {
    setFormStatus("Please allow pop-ups to export the note as PDF.", "error");
    return;
  }

  exportWindow.document.open();
  exportWindow.document.write(buildPdfHtml(note));
  exportWindow.document.close();
}

function renderNotes() {
  const visibleNotes = getVisibleNotes();
  noteCountEl.textContent = String(visibleNotes.length);

  if (!visibleNotes.length) {
    notesGrid.innerHTML = `
      <article class="empty-state">
        <h2>No notes found</h2>
        <p>Create your first documentation page from Oracle-backed storage with the + button, or change the search text.</p>
      </article>
    `;
    return;
  }

  notesGrid.innerHTML = visibleNotes
    .map((note) => {
      const imageMarkup =
        note.media && note.media.type && note.media.type.startsWith("image/") && note.media.dataUrl
          ? `
            <div class="note-media">
              <img src="${note.media.dataUrl}" alt="${escapeHtml(note.media.name)}" />
            </div>
          `
          : note.media && note.media.name
            ? `
              <div class="note-media">
                <div class="file-chip">${escapeHtml(note.media.name)}</div>
              </div>
            `
            : "";

      return `
        <article class="note-page">
          <div class="note-header">
            <div class="note-meta">
              <span class="note-tag">${escapeHtml(note.tag)}</span>
              <h2 class="note-title">${escapeHtml(note.title)}</h2>
            </div>
            <span class="note-date">${escapeHtml(formatDate(note.updatedAt))}</span>
          </div>

          <p class="note-body">${escapeHtml(note.body)}</p>
          ${imageMarkup}

          <div class="note-footer">
            <span class="note-date">Updated ${escapeHtml(formatDateTime(note.updatedAt))}</span>
            <div class="note-actions">
              <button class="note-action" type="button" data-action="edit" data-id="${escapeHtml(
                note.id
              )}">Edit</button>
              <button class="note-action" type="button" data-action="pdf" data-id="${escapeHtml(
                note.id
              )}">Download PDF</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function requestApi(path, options = {}) {
  if (!apiBaseUrl) {
    throw new Error("Oracle workspace is not available.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Oracle API request failed.");
  }

  return payload;
}

async function detectApi() {
  for (const candidate of API_CANDIDATES) {
    try {
      const response = await fetch(`${candidate}/health`, { cache: "no-store" });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();

      if (payload.storage !== "oracle" && payload.dbReady !== true) {
        continue;
      }

      apiBaseUrl = candidate;

      if (payload.apfHomeUrl && homeButton) {
        homeButton.href = payload.apfHomeUrl;
      }

      setWorkspaceStatus("Connected to Oracle workspace.", "success");
      return true;
    } catch {
      // Try the next candidate path.
    }
  }

  apiBaseUrl = "";
  setWorkspaceStatus("Oracle workspace is not reachable right now.", "error");
  return false;
}

async function ensureApiReady() {
  if (apiBaseUrl) {
    return true;
  }

  return detectApi();
}

async function loadNotesFromApi() {
  const hasApi = await detectApi();

  if (!hasApi) {
    notes = [];
    renderNotes();
    return;
  }

  try {
    const payload = await requestApi("/documentation-notes");
    notes = Array.isArray(payload.notes) ? payload.notes.map(normalizeNote) : [];
    renderNotes();
  } catch (error) {
    notes = [];
    renderNotes();
    setWorkspaceStatus(error.message || "Unable to load documentation notes.", "error");
  }
}

async function persistNote(nextRecord) {
  const hasApi = await ensureApiReady();

  if (!hasApi) {
    throw new Error("Oracle workspace is not reachable right now.");
  }

  const isEditing = Boolean(noteIdInput.value);
  const path = isEditing
    ? `/documentation-notes/${encodeURIComponent(nextRecord.id)}`
    : "/documentation-notes";
  const method = isEditing ? "PUT" : "POST";

  const payload = await requestApi(path, {
    method,
    body: JSON.stringify(nextRecord),
  });

  const savedNote = normalizeNote(payload.note);
  const existingIndex = notes.findIndex((note) => note.id === savedNote.id);

  if (existingIndex >= 0) {
    notes[existingIndex] = savedNote;
  } else {
    notes.unshift(savedNote);
  }

  notes = sortNotes(notes);
}

async function saveNote(event) {
  event.preventDefault();

  const title = noteTitleInput.value.trim();
  const tag = noteTagInput.value.trim();
  const body = noteBodyInput.value.trim();
  const noteId = noteIdInput.value.trim();

  if (!title || !tag || !body) {
    setFormStatus("Please complete the title, tag, and note content.", "error");
    return;
  }

  const nextRecord = {
    id: noteId || createId(),
    title,
    tag,
    body,
    media: pendingMedia,
    updatedAt: new Date().toISOString(),
  };

  try {
    await persistNote(nextRecord);
    renderNotes();
    resetForm();
    closeEditor();
    setFormStatus(
      noteId ? "Documentation page updated." : "Documentation page created.",
      "success"
    );
  } catch (error) {
    setFormStatus(
      error.message || "Unable to save the documentation page right now.",
      "error"
    );
  }
}

openEditorButton.addEventListener("click", beginCreateNote);
closeEditorButton.addEventListener("click", () => {
  resetForm();
  closeEditor();
});
resetFormButton.addEventListener("click", resetForm);
noteForm.addEventListener("submit", saveNote);
noteMediaInput.addEventListener("change", () => {
  handleMediaSelection().catch(() => {
    setFormStatus("Unable to read the uploaded media file.", "error");
    resetMediaPreview();
  });
});
searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim();
  renderNotes();
});
notesGrid.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const noteId = target.dataset.id;

  if (!action || !noteId) {
    return;
  }

  if (action === "edit") {
    editNote(noteId);
    return;
  }

  if (action === "pdf") {
    downloadPdf(noteId);
  }
});

setWorkspaceStatus("Connecting to Oracle workspace...");
loadNotesFromApi().catch(() => {
  notes = [];
  renderNotes();
  setWorkspaceStatus("Unable to initialize the documentation workspace.", "error");
});

try {
  require("dotenv").config();
} catch {}

const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  initializeDatabase,
  listDocumentationNotes,
  upsertDocumentationNote,
  deleteDocumentationNote,
  closeDatabase,
} = require("./db");

const PORT = Number(process.env.PORT || 3005);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 10000);
const APF_HOME_URL = process.env.APF_HOME_URL || "http://localhost:3001/";
const ROOT_DIR = __dirname;

let dbReady = false;
let dbInitInProgress = false;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "application/javascript; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".json") return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

async function serveWorkspaceFile(response, requestPath) {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const targetFile = path.resolve(ROOT_DIR, relativePath || "index.html");

  if (!targetFile.startsWith(path.resolve(ROOT_DIR))) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const fileContent = await fs.readFile(targetFile);
    response.writeHead(200, {
      "Content-Type": getContentType(targetFile),
    });
    response.end(fileContent);
  } catch {
    const indexFile = path.join(ROOT_DIR, "index.html");
    const indexContent = await fs.readFile(indexFile);
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
    });
    response.end(indexContent);
  }
}

async function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 5 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function readJsonBody(rawBody) {
  return rawBody ? JSON.parse(rawBody) : {};
}

function createNoteId() {
  if (typeof randomUUID === "function") {
    return `note-${randomUUID()}`;
  }

  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMedia(media) {
  if (!media) {
    return null;
  }

  const name = String(media.name || "").trim();
  const type = String(media.type || "").trim();
  const dataUrl = String(media.dataUrl || "").trim();

  if (!name && !type && !dataUrl) {
    return null;
  }

  return { name, type, dataUrl };
}

function normalizeNoteInput(payload, fallbackId = "") {
  return {
    id: String(payload?.id || fallbackId || createNoteId()).trim(),
    title: String(payload?.title || "").trim(),
    tag: String(payload?.tag || "").trim(),
    body: String(payload?.body || "").trim(),
    media: normalizeMedia(payload?.media),
  };
}

function validateNote(note) {
  if (!note.id || !note.title || !note.tag || !note.body) {
    return "Title, tag, and note content are required.";
  }

  return "";
}

function requireDatabaseReady(response) {
  if (!dbReady) {
    sendJson(response, 503, { error: "Database is not ready yet." });
    return false;
  }

  return true;
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const requestUrl = new URL(request.url, `http://localhost:${PORT}`);
  const requestPath = requestUrl.pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (requestPath === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      dbReady,
      storage: "oracle",
      apfHomeUrl: APF_HOME_URL,
    });
    return;
  }

  if (requestPath === "/api/documentation-notes" && request.method === "GET") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const notes = await listDocumentationNotes();
      sendJson(response, 200, { notes });
    } catch (error) {
      console.error("GET /api/documentation-notes failed", error);
      sendJson(response, 500, { error: "Unable to load documentation notes." });
    }
    return;
  }

  if (requestPath === "/api/documentation-notes" && request.method === "POST") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const body = await readRequestBody(request);
      const note = normalizeNoteInput(readJsonBody(body));
      const validationMessage = validateNote(note);

      if (validationMessage) {
        sendJson(response, 400, { error: validationMessage });
        return;
      }

      const savedNote = await upsertDocumentationNote(note);
      sendJson(response, 201, { note: savedNote });
    } catch (error) {
      console.error("POST /api/documentation-notes failed", error);
      sendJson(response, 500, { error: "Unable to save documentation note." });
    }
    return;
  }

  if (requestPath.startsWith("/api/documentation-notes/") && request.method === "PUT") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const noteId = decodeURIComponent(
        requestPath.replace("/api/documentation-notes/", "")
      );
      const body = await readRequestBody(request);
      const note = normalizeNoteInput(readJsonBody(body), noteId);
      const validationMessage = validateNote(note);

      if (validationMessage) {
        sendJson(response, 400, { error: validationMessage });
        return;
      }

      const savedNote = await upsertDocumentationNote(note);
      sendJson(response, 200, { note: savedNote });
    } catch (error) {
      console.error("PUT /api/documentation-notes/:id failed", error);
      sendJson(response, 500, { error: "Unable to update documentation note." });
    }
    return;
  }

  if (requestPath.startsWith("/api/documentation-notes/") && request.method === "DELETE") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const noteId = decodeURIComponent(
        requestPath.replace("/api/documentation-notes/", "")
      );
      await deleteDocumentationNote(noteId);
      sendJson(response, 200, { message: "Documentation note deleted." });
    } catch (error) {
      console.error("DELETE /api/documentation-notes/:id failed", error);
      sendJson(response, 500, { error: "Unable to delete documentation note." });
    }
    return;
  }

  if (request.method === "GET") {
    await serveWorkspaceFile(response, requestPath);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

async function initializeDatabaseWithRetry() {
  if (dbInitInProgress) {
    return;
  }

  dbInitInProgress = true;

  try {
    await initializeDatabase();
    dbReady = true;
    console.log("Documentation Oracle storage initialized");
  } catch (error) {
    dbReady = false;
    console.error("Documentation Oracle initialization failed, retrying:", error.message);
    setTimeout(() => {
      dbInitInProgress = false;
      initializeDatabaseWithRetry();
    }, DB_RETRY_DELAY_MS);
    return;
  }

  dbInitInProgress = false;
}

server.listen(PORT, () => {
  console.log(`Documentation workspace started at http://localhost:${PORT}`);
});

initializeDatabaseWithRetry();

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received. Shutting down...`);

  await new Promise((resolve) => {
    server.close(() => resolve());
  });

  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

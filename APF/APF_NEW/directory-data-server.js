const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.DIRECTORY_API_PORT || 3001);
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "public", "APF_NEW.json");
const BACKUP_DIR = path.join(ROOT_DIR, "APF_BACKUPS");
const PROJECT_APPS = {
  documentation: path.join(ROOT_DIR, "..", "DOCUMENTATION_NEW"),
  sftp: path.join(ROOT_DIR, "..", "SFTP_NEW"),
  certificate: path.join(ROOT_DIR, "..", "CERTIFICATE_NEW")
};
const DIRECTORY_TARGET_PROTOCOL =
  process.env.DIRECTORY_TARGET_PROTOCOL || "http";
const DIRECTORY_TARGET_HOST =
  process.env.DIRECTORY_TARGET_HOST || "frb2bcdu01.groupecat.com";
const DIRECTORY_TARGET_PORT = String(process.env.DIRECTORY_TARGET_PORT || "8000");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAbsoluteUrl(value) {
  return /^(https?:)?\/\//i.test(value);
}

function isHostPath(value) {
  return /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?\//i.test(value);
}

function normalizeTargetPath(value) {
  return value.replace(/^\/+/, "");
}

function normalizeStoredUrl(value) {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return "";
  }

  if (isAbsoluteUrl(trimmedValue)) {
    try {
      const parsedUrl = new URL(trimmedValue);
      const protocol = parsedUrl.protocol.replace(/:$/, "").toLowerCase();
      const hostname = parsedUrl.hostname.toLowerCase();
      const port = String(parsedUrl.port || "");

      if (
        protocol === DIRECTORY_TARGET_PROTOCOL.toLowerCase() &&
        hostname === DIRECTORY_TARGET_HOST.toLowerCase() &&
        port === DIRECTORY_TARGET_PORT
      ) {
        return normalizeTargetPath(
          `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
        );
      }
    } catch (error) {
      return trimmedValue;
    }

    return trimmedValue;
  }

  const targetHostPattern = new RegExp(
    `^${escapeRegExp(DIRECTORY_TARGET_HOST)}(?::${escapeRegExp(
      DIRECTORY_TARGET_PORT
    )})?/`,
    "i"
  );

  if (targetHostPattern.test(trimmedValue)) {
    return normalizeTargetPath(trimmedValue.replace(targetHostPattern, ""));
  }

  if (isHostPath(trimmedValue)) {
    return `${DIRECTORY_TARGET_PROTOCOL}://${trimmedValue}`;
  }

  return normalizeTargetPath(trimmedValue);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".js") {
    return "application/javascript; charset=utf-8";
  }

  if (extension === ".json") {
    return "application/json; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
}

async function serveProjectApp(response, projectId, requestPath) {
  const projectRoot = PROJECT_APPS[projectId];

  if (!projectRoot) {
    sendJson(response, 404, { error: "Project not found" });
    return;
  }

  const relativePath = requestPath.replace(`/apps/${projectId}`, "").replace(/^\/+/, "");
  const safeRelativePath = relativePath || "index.html";
  const targetFile = path.resolve(projectRoot, safeRelativePath);
  const resolvedRoot = path.resolve(projectRoot);

  if (!targetFile.startsWith(resolvedRoot)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const fileContent = await fs.readFile(targetFile);
    response.writeHead(200, {
      "Content-Type": getContentType(targetFile)
    });
    response.end(fileContent);
  } catch (error) {
    sendJson(response, 404, { error: "File not found" });
  }
}

function sanitizeEntry(entry, index) {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 8);

  return {
    id:
      typeof entry?.id === "string" && entry.id.trim()
        ? entry.id.trim()
        : `custom-${timestamp}-${index}-${randomPart}`,
    bu: String(entry?.bu || "").trim().toLowerCase(),
    type: String(entry?.type || "").trim(),
    label: String(entry?.label || "").trim(),
    url: normalizeStoredUrl(entry?.url),
    backup: String(entry?.backup || "").trim()
  };
}

function sanitizePayload(payload) {
  const rawEntries = Array.isArray(payload?.entries) ? payload.entries : [];
  const entries = rawEntries
    .map((entry, index) => sanitizeEntry(entry, index))
    .filter((entry) => entry.bu && entry.type && entry.label && entry.url);

  return {
    generatedAt: new Date().toISOString(),
    entries
  };
}

async function ensureBackupDirectory() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
}

function buildBackupName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `directory-data-backup-${stamp}.json`;
}

async function readDataFile() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function writeDataFile(nextPayload) {
  await ensureBackupDirectory();

  try {
    const currentContent = await fs.readFile(DATA_FILE, "utf8");
    const backupPath = path.join(BACKUP_DIR, buildBackupName());
    await fs.writeFile(backupPath, currentContent, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(DATA_FILE, JSON.stringify(nextPayload, null, 2), "utf8");
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
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (request.url === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestPath === "/apps/documentation" && request.method === "GET") {
    response.writeHead(302, { Location: "/apps/documentation/" });
    response.end();
    return;
  }

  if (requestPath === "/apps/sftp" && request.method === "GET") {
    response.writeHead(302, { Location: "/apps/sftp/" });
    response.end();
    return;
  }

  if (requestPath === "/apps/certificate" && request.method === "GET") {
    response.writeHead(302, { Location: "/apps/certificate/" });
    response.end();
    return;
  }

  if (requestPath.startsWith("/apps/documentation/") && request.method === "GET") {
    await serveProjectApp(response, "documentation", requestPath);
    return;
  }

  if (requestPath.startsWith("/apps/sftp/") && request.method === "GET") {
    await serveProjectApp(response, "sftp", requestPath);
    return;
  }

  if (requestPath.startsWith("/apps/certificate/") && request.method === "GET") {
    await serveProjectApp(response, "certificate", requestPath);
    return;
  }

  if (requestPath === "/api/directory-data" && request.method === "GET") {
    try {
      const payload = await readDataFile();
      sendJson(response, 200, payload);
    } catch (error) {
      console.error("GET /api/directory-data failed", DATA_FILE, error);
      sendJson(response, 500, { error: "Unable to read directory data." });
    }
    return;
  }

  if (requestPath === "/api/directory-data" && request.method === "POST") {
    try {
      const body = await readRequestBody(request);
      const parsedBody = body ? JSON.parse(body) : {};
      const nextPayload = sanitizePayload(parsedBody);
      await writeDataFile(nextPayload);
      sendJson(response, 200, nextPayload);
    } catch (error) {
      console.error("POST /api/directory-data failed", error);
      sendJson(response, 400, { error: "Unable to save directory data." });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Directory data API listening on http://localhost:${PORT}`);
  console.log(`Directory data file: ${DATA_FILE}`);
  console.log(
    `Directory target: ${DIRECTORY_TARGET_PROTOCOL}://${DIRECTORY_TARGET_HOST}:${DIRECTORY_TARGET_PORT}`
  );
});

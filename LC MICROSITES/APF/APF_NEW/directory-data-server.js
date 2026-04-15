try {
  require("dotenv").config();
} catch {}

const http = require("http");
const { randomUUID } = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const {
  initializeDatabase: initializeDocumentationDatabase,
  listDocumentationNotes,
  upsertDocumentationNote,
  deleteDocumentationNote,
} = require("../DOCUMENTATION_NEW/db");
const {
  initializeDatabase: initializeSftpDatabase,
  listSftpRecords,
  upsertSftpRecord,
  bulkUpsertSftpRecords,
  deleteSftpRecord,
} = require("../SFTP_NEW/db");
const {
  initializeDatabase: initializeCertificateDatabase,
  listCertificates,
  bulkUpsertCertificates,
  upsertCertificate,
  deleteCertificate,
} = require("../CERTIFICATE_NEW/db");

const {
  addColumnIfMissing,
  oracledb,
  closePool,
  executeIgnoreAlreadyExists,
  getTableColumnNames,
  healthCheck,
  primaryKeyExists,
  withConnection,
  withTransaction,
} = require("../shared/oracle-db");

const PORT = Number(process.env.DIRECTORY_API_PORT || 3001);
const ROOT_DIR = __dirname;
const PROJECT_APPS = {
  documentation: path.join(ROOT_DIR, "..", "DOCUMENTATION_NEW"),
  sftp: path.join(ROOT_DIR, "..", "SFTP_NEW"),
  certificate: path.join(ROOT_DIR, "..", "CERTIFICATE_NEW"),
};
const DIRECTORY_TARGET_PROTOCOL = process.env.DIRECTORY_TARGET_PROTOCOL || "http";
const DIRECTORY_TARGET_HOST =
  process.env.DIRECTORY_TARGET_HOST || "frb2bcdu01.groupecat.com";
const DIRECTORY_TARGET_PORT = String(process.env.DIRECTORY_TARGET_PORT || "8000");
const TABLE_NAME = "MYROTA_APF";

let dbReady = false;
let dbInitInProgress = false;

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
    } catch {
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
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
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
      "Content-Type": getContentType(targetFile),
    });
    response.end(fileContent);
  } catch {
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
    backup: String(entry?.backup || "").trim(),
  };
}

function sanitizePayload(payload) {
  const rawEntries = Array.isArray(payload?.entries) ? payload.entries : [];
  const entries = rawEntries
    .map((entry, index) => sanitizeEntry(entry, index))
    .filter((entry) => entry.bu && entry.type && entry.label && entry.url);

  return {
    generatedAt: new Date().toISOString(),
    entries,
  };
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

function createRecordId(prefix) {
  if (typeof randomUUID === "function") {
    return `${prefix}-${randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requireDatabaseReady(response) {
  if (!dbReady) {
    sendJson(response, 503, { error: "Database is not ready yet." });
    return false;
  }

  return true;
}

function normalizePort(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 22;
}

function normalizeSftpRecordInput(payload, fallbackId = "") {
  return {
    id: String(payload?.id || fallbackId || createRecordId("sftp")).trim(),
    partnerName: String(payload?.partnerName || "").trim(),
    connectionType: String(payload?.connectionType || "").trim().toUpperCase(),
    host: String(payload?.host || "").trim(),
    port: normalizePort(payload?.port),
    username: String(payload?.username || "").trim(),
    password: String(payload?.password || "").trim(),
    contactPerson: String(payload?.contactPerson || "").trim(),
    notes: String(payload?.notes || "").trim(),
  };
}

function validateSftpRecord(record) {
  if (
    !record.id ||
    !record.partnerName ||
    !record.connectionType ||
    !record.host ||
    !record.username ||
    !record.password ||
    !record.contactPerson
  ) {
    return "Partner name, connection type, host, username, password, and contact person are required.";
  }

  return "";
}

function normalizeDocumentationMedia(media) {
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

function normalizeDocumentationNoteInput(payload, fallbackId = "") {
  return {
    id: String(payload?.id || fallbackId || createRecordId("note")).trim(),
    title: String(payload?.title || "").trim(),
    tag: String(payload?.tag || "").trim(),
    body: String(payload?.body || "").trim(),
    media: normalizeDocumentationMedia(payload?.media),
  };
}

function validateDocumentationNote(note) {
  if (!note.id || !note.title || !note.tag || !note.body) {
    return "Title, tag, and note content are required.";
  }

  return "";
}

function normalizeCertificateRecordInput(payload, fallbackId = "") {
  return {
    id: String(payload?.id || fallbackId || createRecordId("cert")).trim(),
    partnerName: String(payload?.partnerName || "").trim(),
    certificateType: String(payload?.certificateType || "").trim(),
    contactTeam: String(payload?.contactTeam || "").trim(),
    issuedDate: String(payload?.issuedDate || "").trim(),
    expiryDate: String(payload?.expiryDate || "").trim(),
    uploadName: String(payload?.uploadName || "").trim(),
    uploadType: String(payload?.uploadType || "").trim(),
    uploadDataUrl: String(payload?.uploadDataUrl || "").trim(),
    notes: String(payload?.notes || "").trim(),
  };
}

function validateCertificateRecord(record) {
  if (
    !record.id ||
    !record.partnerName ||
    !record.certificateType ||
    !record.contactTeam ||
    !record.issuedDate ||
    !record.expiryDate
  ) {
    return "Partner name, certificate type, contact team, issued date, and expiry date are required.";
  }

  if (new Date(record.expiryDate).getTime() < new Date(record.issuedDate).getTime()) {
    return "Expiry date must be after the certificate generate date.";
  }

  return "";
}

async function initializeApfDatabase() {
  await withConnection(async (connection) => {
    await executeIgnoreAlreadyExists(
      connection,
      `
        CREATE TABLE ${TABLE_NAME} (
          ID VARCHAR2(120) PRIMARY KEY,
          BU VARCHAR2(16) NOT NULL,
          ENTRY_TYPE VARCHAR2(100) NOT NULL,
          LABEL VARCHAR2(300) NOT NULL,
          URL VARCHAR2(2000) NOT NULL,
          BACKUP_CONTACT VARCHAR2(300),
          CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
          UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
        )
      `
    );

    await addColumnIfMissing(connection, TABLE_NAME, "ID", "ID VARCHAR2(120)");
    await addColumnIfMissing(connection, TABLE_NAME, "BU", "BU VARCHAR2(16)");
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "ENTRY_TYPE",
      "ENTRY_TYPE VARCHAR2(100)"
    );
    await addColumnIfMissing(connection, TABLE_NAME, "LABEL", "LABEL VARCHAR2(300)");
    await addColumnIfMissing(connection, TABLE_NAME, "URL", "URL VARCHAR2(2000)");
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "BACKUP_CONTACT",
      "BACKUP_CONTACT VARCHAR2(300)"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "CREATED_AT",
      "CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP"
    );
    await addColumnIfMissing(
      connection,
      TABLE_NAME,
      "UPDATED_AT",
      "UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP"
    );

    const hasPrimaryKey = await primaryKeyExists(connection, TABLE_NAME);

    if (!hasPrimaryKey) {
      await executeIgnoreAlreadyExists(
        connection,
        `ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT MYR_APF_PK PRIMARY KEY (ID)`
      );
    }

    const columnNames = await getTableColumnNames(connection, TABLE_NAME);

    if (columnNames.has("BU") && columnNames.has("ENTRY_TYPE")) {
      await executeIgnoreAlreadyExists(
        connection,
        `CREATE INDEX MYR_APF_BU_TYPE_IDX ON ${TABLE_NAME} (BU, ENTRY_TYPE)`
      );
    }

  });
}

async function listEntries() {
  const result = await withConnection((connection) =>
    connection.execute(
      `
        SELECT
          ID,
          BU,
          ENTRY_TYPE,
          LABEL,
          URL,
          BACKUP_CONTACT,
          CREATED_AT,
          UPDATED_AT
        FROM ${TABLE_NAME}
        ORDER BY BU ASC, ENTRY_TYPE ASC, LABEL ASC
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    )
  );

  return result.rows.map((row) => ({
    id: row.ID,
    bu: row.BU,
    type: row.ENTRY_TYPE,
    label: row.LABEL,
    url: row.URL,
    backup: row.BACKUP_CONTACT || "",
  }));
}

async function replaceEntries(entries) {
  return withTransaction(async (connection) => {
    await connection.execute(`DELETE FROM ${TABLE_NAME}`);

    if (entries.length > 0) {
      await connection.executeMany(
        `
          INSERT INTO ${TABLE_NAME} (
            ID,
            BU,
            ENTRY_TYPE,
            LABEL,
            URL,
            BACKUP_CONTACT,
            CREATED_AT,
            UPDATED_AT
          ) VALUES (
            :id,
            :bu,
            :type,
            :label,
            :url,
            :backup,
            SYSTIMESTAMP,
            SYSTIMESTAMP
          )
        `,
        entries.map((entry) => ({
          id: entry.id,
          bu: entry.bu,
          type: entry.type,
          label: entry.label,
          url: entry.url,
          backup: entry.backup || "",
        }))
      );
    }

    const result = await connection.execute(
      `
        SELECT
          ID,
          BU,
          ENTRY_TYPE,
          LABEL,
          URL,
          BACKUP_CONTACT,
          CREATED_AT,
          UPDATED_AT
        FROM ${TABLE_NAME}
        ORDER BY BU ASC, ENTRY_TYPE ASC, LABEL ASC
      `,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    return {
      generatedAt: new Date().toISOString(),
      entries: result.rows.map((row) => ({
        id: row.ID,
        bu: row.BU,
        type: row.ENTRY_TYPE,
        label: row.LABEL,
        url: row.URL,
        backup: row.BACKUP_CONTACT || "",
      })),
    };
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
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (request.url === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true, dbReady, storage: "oracle" });
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
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const entries = await listEntries();
      sendJson(response, 200, {
        generatedAt: new Date().toISOString(),
        entries,
      });
    } catch (error) {
      console.error("GET /api/directory-data failed", error);
      sendJson(response, 500, { error: "Unable to read directory data." });
    }
    return;
  }

  if (requestPath === "/api/directory-data" && request.method === "POST") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const body = await readRequestBody(request);
      const parsedBody = readJsonBody(body);
      const nextPayload = sanitizePayload(parsedBody);
      const savedPayload = await replaceEntries(nextPayload.entries);
      sendJson(response, 200, savedPayload);
    } catch (error) {
      console.error("POST /api/directory-data failed", error);
      sendJson(response, 400, { error: "Unable to save directory data." });
    }
    return;
  }

  if (requestPath === "/api/sftp-records" && request.method === "GET") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const records = await listSftpRecords();
      sendJson(response, 200, { records });
    } catch (error) {
      console.error("GET /api/sftp-records failed", error);
      sendJson(response, 500, { error: "Unable to load SFTP records." });
    }
    return;
  }

  if (requestPath === "/api/sftp-records/bulk" && request.method === "PUT") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const body = await readRequestBody(request);
      const parsedBody = readJsonBody(body);
      const payloadRecords = Array.isArray(parsedBody.records) ? parsedBody.records : null;

      if (!payloadRecords) {
        sendJson(response, 400, { error: "records must be an array." });
        return;
      }

      const normalizedRecords = payloadRecords.map((record) =>
        normalizeSftpRecordInput(record)
      );
      const invalidRecord = normalizedRecords.find((record) => validateSftpRecord(record));

      if (invalidRecord) {
        sendJson(response, 400, { error: validateSftpRecord(invalidRecord) });
        return;
      }

      const records = await bulkUpsertSftpRecords(normalizedRecords);
      sendJson(response, 200, { records });
    } catch (error) {
      console.error("PUT /api/sftp-records/bulk failed", error);
      sendJson(response, 500, { error: "Unable to bulk save SFTP records." });
    }
    return;
  }

  if (requestPath === "/api/sftp-records" && request.method === "POST") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const body = await readRequestBody(request);
      const record = normalizeSftpRecordInput(readJsonBody(body));
      const validationMessage = validateSftpRecord(record);

      if (validationMessage) {
        sendJson(response, 400, { error: validationMessage });
        return;
      }

      const savedRecord = await upsertSftpRecord(record);
      sendJson(response, 201, { record: savedRecord });
    } catch (error) {
      console.error("POST /api/sftp-records failed", error);
      sendJson(response, 500, { error: "Unable to save SFTP record." });
    }
    return;
  }

  if (requestPath.startsWith("/api/sftp-records/") && request.method === "PUT") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const recordId = decodeURIComponent(requestPath.replace("/api/sftp-records/", ""));
      const body = await readRequestBody(request);
      const record = normalizeSftpRecordInput(readJsonBody(body), recordId);
      const validationMessage = validateSftpRecord(record);

      if (validationMessage) {
        sendJson(response, 400, { error: validationMessage });
        return;
      }

      const savedRecord = await upsertSftpRecord(record);
      sendJson(response, 200, { record: savedRecord });
    } catch (error) {
      console.error("PUT /api/sftp-records/:id failed", error);
      sendJson(response, 500, { error: "Unable to update SFTP record." });
    }
    return;
  }

  if (requestPath.startsWith("/api/sftp-records/") && request.method === "DELETE") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const recordId = decodeURIComponent(requestPath.replace("/api/sftp-records/", ""));
      await deleteSftpRecord(recordId);
      sendJson(response, 200, { message: "SFTP record deleted." });
    } catch (error) {
      console.error("DELETE /api/sftp-records/:id failed", error);
      sendJson(response, 500, { error: "Unable to delete SFTP record." });
    }
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
      const note = normalizeDocumentationNoteInput(readJsonBody(body));
      const validationMessage = validateDocumentationNote(note);

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
      const note = normalizeDocumentationNoteInput(readJsonBody(body), noteId);
      const validationMessage = validateDocumentationNote(note);

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

  if (requestPath === "/api/certificates" && request.method === "GET") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const records = await listCertificates();
      sendJson(response, 200, { records });
    } catch (error) {
      console.error("GET /api/certificates failed", error);
      sendJson(response, 500, { error: "Unable to load certificates." });
    }
    return;
  }

  if (requestPath === "/api/certificates/bulk" && request.method === "PUT") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const body = await readRequestBody(request);
      const parsedBody = readJsonBody(body);
      const payloadRecords = Array.isArray(parsedBody.records) ? parsedBody.records : null;

      if (!payloadRecords) {
        sendJson(response, 400, { error: "records must be an array." });
        return;
      }

      const normalizedRecords = payloadRecords.map((record) =>
        normalizeCertificateRecordInput(record)
      );
      const invalidRecord = normalizedRecords.find((record) =>
        Boolean(validateCertificateRecord(record))
      );

      if (invalidRecord) {
        sendJson(response, 400, { error: validateCertificateRecord(invalidRecord) });
        return;
      }

      const records = await bulkUpsertCertificates(normalizedRecords);
      sendJson(response, 200, { records });
    } catch (error) {
      console.error("PUT /api/certificates/bulk failed", error);
      sendJson(response, 500, { error: "Unable to bulk save certificates." });
    }
    return;
  }

  if (requestPath === "/api/certificates" && request.method === "POST") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const body = await readRequestBody(request);
      const record = normalizeCertificateRecordInput(readJsonBody(body));
      const validationMessage = validateCertificateRecord(record);

      if (validationMessage) {
        sendJson(response, 400, { error: validationMessage });
        return;
      }

      const savedRecord = await upsertCertificate(record);
      sendJson(response, 201, { record: savedRecord });
    } catch (error) {
      console.error("POST /api/certificates failed", error);
      sendJson(response, 500, { error: "Unable to save certificate." });
    }
    return;
  }

  if (requestPath.startsWith("/api/certificates/") && request.method === "PUT") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const recordId = decodeURIComponent(requestPath.replace("/api/certificates/", ""));
      const body = await readRequestBody(request);
      const record = normalizeCertificateRecordInput(readJsonBody(body), recordId);
      const validationMessage = validateCertificateRecord(record);

      if (validationMessage) {
        sendJson(response, 400, { error: validationMessage });
        return;
      }

      const savedRecord = await upsertCertificate(record);
      sendJson(response, 200, { record: savedRecord });
    } catch (error) {
      console.error("PUT /api/certificates/:id failed", error);
      sendJson(response, 500, { error: "Unable to update certificate." });
    }
    return;
  }

  if (requestPath.startsWith("/api/certificates/") && request.method === "DELETE") {
    if (!requireDatabaseReady(response)) {
      return;
    }

    try {
      const recordId = decodeURIComponent(requestPath.replace("/api/certificates/", ""));
      await deleteCertificate(recordId);
      sendJson(response, 200, { message: "Certificate deleted." });
    } catch (error) {
      console.error("DELETE /api/certificates/:id failed", error);
      sendJson(response, 500, { error: "Unable to delete certificate." });
    }
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
    await initializeApfDatabase();
    await initializeDocumentationDatabase();
    await initializeSftpDatabase();
    await initializeCertificateDatabase();
    await healthCheck();
    dbReady = true;
    console.log("APF Oracle storage initialized");
  } catch (error) {
    dbReady = false;
    console.error("APF Oracle initialization failed, retrying:", error.message);
    setTimeout(() => {
      dbInitInProgress = false;
      initializeDatabaseWithRetry();
    }, 10000);
    return;
  }

  dbInitInProgress = false;
}

server.listen(PORT, () => {
  console.log(`Directory data API listening on http://localhost:${PORT}`);
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

  await closePool();
  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

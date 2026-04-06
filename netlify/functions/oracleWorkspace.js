const { randomUUID } = require("crypto");
const {
  addColumnIfMissing,
  executeIgnoreAlreadyExists,
  getTableColumnNames,
  healthCheck,
  oracledb,
  primaryKeyExists,
  withConnection,
  withTransaction,
} = require("../../APF/shared/oracle-db");
const {
  initializeDatabase: initializeDocumentationDatabase,
  listDocumentationNotes,
  upsertDocumentationNote,
  deleteDocumentationNote,
} = require("../../APF/DOCUMENTATION_NEW/db");
const {
  initializeDatabase: initializeSftpDatabase,
  listSftpRecords,
  upsertSftpRecord,
  bulkUpsertSftpRecords,
  deleteSftpRecord,
} = require("../../APF/SFTP_NEW/db");
const {
  initializeDatabase: initializeCertificateDatabase,
  listCertificates,
  bulkUpsertCertificates,
  upsertCertificate,
  deleteCertificate,
} = require("../../APF/CERTIFICATE_NEW/db");

const TABLE_NAME = "MYROTA_APF";
const DIRECTORY_TARGET_PROTOCOL = process.env.DIRECTORY_TARGET_PROTOCOL || "http";
const DIRECTORY_TARGET_HOST =
  process.env.DIRECTORY_TARGET_HOST || "frb2bcdu01.groupecat.com";
const DIRECTORY_TARGET_PORT = String(process.env.DIRECTORY_TARGET_PORT || "8000");
const APF_HOME_URL = process.env.APF_HOME_URL || "/";

let dbReady = false;
let initPromise = null;

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
    body: JSON.stringify(payload),
  };
}

function createRecordId(prefix) {
  if (typeof randomUUID === "function") {
    return `${prefix}-${randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
    await addColumnIfMissing(connection, TABLE_NAME, "ENTRY_TYPE", "ENTRY_TYPE VARCHAR2(100)");
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

async function listApfEntries() {
  const result = await withConnection((connection) =>
    connection.execute(
      `
        SELECT
          ID,
          BU,
          ENTRY_TYPE,
          LABEL,
          URL,
          BACKUP_CONTACT
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

async function replaceApfEntries(entries) {
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

    return {
      generatedAt: new Date().toISOString(),
      entries: await listApfEntries(),
    };
  });
}

async function ensureDatabaseReady() {
  if (dbReady) {
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      await initializeApfDatabase();
      await initializeDocumentationDatabase();
      await initializeSftpDatabase();
      await initializeCertificateDatabase();
      dbReady = true;
    })().catch((error) => {
      dbReady = false;
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

function getRoutePath(event) {
  const pathValue = String(event.path || "").split("?")[0];

  if (pathValue.startsWith("/.netlify/functions/oracleWorkspace/")) {
    return `/${pathValue.replace("/.netlify/functions/oracleWorkspace/", "")}`;
  }

  if (pathValue === "/.netlify/functions/oracleWorkspace") {
    return "/";
  }

  if (pathValue.startsWith("/api/")) {
    return `/${pathValue.replace("/api/", "")}`;
  }

  if (pathValue === "/api") {
    return "/";
  }

  return pathValue || "/";
}

function readJsonBody(event) {
  if (!event.body) {
    return {};
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  return JSON.parse(rawBody);
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  const routePath = getRoutePath(event);

  try {
    await ensureDatabaseReady();
  } catch (error) {
    if (routePath === "/health" && event.httpMethod === "GET") {
      return json(503, {
        ok: false,
        dbReady: false,
        storage: "oracle",
        error: error.message || "Oracle initialization failed.",
        apfHomeUrl: APF_HOME_URL,
      });
    }

    return json(503, {
      error: error.message || "Oracle workspace is not ready yet.",
    });
  }

  if (routePath === "/health" && event.httpMethod === "GET") {
    const ping = await healthCheck();
    return json(200, {
      ok: Boolean(ping.rows?.[0]),
      dbReady,
      storage: "oracle",
      apfHomeUrl: APF_HOME_URL,
    });
  }

  if (routePath === "/directory-data" && event.httpMethod === "GET") {
    return json(200, {
      generatedAt: new Date().toISOString(),
      entries: await listApfEntries(),
    });
  }

  if (routePath === "/directory-data" && event.httpMethod === "POST") {
    const payload = sanitizePayload(readJsonBody(event));
    return json(200, await replaceApfEntries(payload.entries));
  }

  if (routePath === "/sftp-records" && event.httpMethod === "GET") {
    return json(200, { records: await listSftpRecords() });
  }

  if (routePath === "/sftp-records" && event.httpMethod === "POST") {
    const record = normalizeSftpRecordInput(readJsonBody(event));
    const validationError = validateSftpRecord(record);

    if (validationError) {
      return json(400, { error: validationError });
    }

    return json(201, { record: await upsertSftpRecord(record) });
  }

  if (routePath === "/sftp-records/bulk" && event.httpMethod === "PUT") {
    const payload = readJsonBody(event);
    const records = Array.isArray(payload?.records)
      ? payload.records.map((record, index) =>
          normalizeSftpRecordInput(record, createRecordId(`sftp-${index}`))
        )
      : [];

    const invalidRecord = records.find((record) => validateSftpRecord(record));

    if (invalidRecord) {
      return json(400, { error: validateSftpRecord(invalidRecord) });
    }

    return json(200, { records: await bulkUpsertSftpRecords(records) });
  }

  if (routePath.startsWith("/sftp-records/")) {
    const recordId = decodeURIComponent(routePath.replace("/sftp-records/", ""));

    if (event.httpMethod === "PUT") {
      const record = normalizeSftpRecordInput(readJsonBody(event), recordId);
      const validationError = validateSftpRecord(record);

      if (validationError) {
        return json(400, { error: validationError });
      }

      return json(200, { record: await upsertSftpRecord(record) });
    }

    if (event.httpMethod === "DELETE") {
      await deleteSftpRecord(recordId);
      return json(200, { ok: true });
    }
  }

  if (routePath === "/documentation-notes" && event.httpMethod === "GET") {
    return json(200, { notes: await listDocumentationNotes() });
  }

  if (routePath === "/documentation-notes" && event.httpMethod === "POST") {
    const note = normalizeDocumentationNoteInput(readJsonBody(event));
    const validationError = validateDocumentationNote(note);

    if (validationError) {
      return json(400, { error: validationError });
    }

    return json(201, { note: await upsertDocumentationNote(note) });
  }

  if (routePath.startsWith("/documentation-notes/")) {
    const noteId = decodeURIComponent(routePath.replace("/documentation-notes/", ""));

    if (event.httpMethod === "PUT") {
      const note = normalizeDocumentationNoteInput(readJsonBody(event), noteId);
      const validationError = validateDocumentationNote(note);

      if (validationError) {
        return json(400, { error: validationError });
      }

      return json(200, { note: await upsertDocumentationNote(note) });
    }

    if (event.httpMethod === "DELETE") {
      await deleteDocumentationNote(noteId);
      return json(200, { ok: true });
    }
  }

  if (routePath === "/certificates" && event.httpMethod === "GET") {
    return json(200, { records: await listCertificates() });
  }

  if (routePath === "/certificates" && event.httpMethod === "POST") {
    const record = normalizeCertificateRecordInput(readJsonBody(event));
    const validationError = validateCertificateRecord(record);

    if (validationError) {
      return json(400, { error: validationError });
    }

    return json(201, { record: await upsertCertificate(record) });
  }

  if (routePath === "/certificates/bulk" && event.httpMethod === "PUT") {
    const payload = readJsonBody(event);
    const records = Array.isArray(payload?.records)
      ? payload.records.map((record, index) =>
          normalizeCertificateRecordInput(record, createRecordId(`cert-${index}`))
        )
      : [];

    const invalidRecord = records.find((record) => validateCertificateRecord(record));

    if (invalidRecord) {
      return json(400, { error: validateCertificateRecord(invalidRecord) });
    }

    return json(200, { records: await bulkUpsertCertificates(records) });
  }

  if (routePath.startsWith("/certificates/")) {
    const recordId = decodeURIComponent(routePath.replace("/certificates/", ""));

    if (event.httpMethod === "PUT") {
      const record = normalizeCertificateRecordInput(readJsonBody(event), recordId);
      const validationError = validateCertificateRecord(record);

      if (validationError) {
        return json(400, { error: validationError });
      }

      return json(200, { record: await upsertCertificate(record) });
    }

    if (event.httpMethod === "DELETE") {
      await deleteCertificate(recordId);
      return json(200, { ok: true });
    }
  }

  return json(404, { error: "Oracle workspace route not found." });
};

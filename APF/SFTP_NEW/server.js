try {
  require("dotenv").config();
} catch {}

const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const {
  initializeDatabase,
  listSftpRecords,
  upsertSftpRecord,
  bulkUpsertSftpRecords,
  deleteSftpRecord,
  closeDatabase
} = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3004);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 10000);
const APF_HOME_URL = process.env.APF_HOME_URL || "http://localhost:5173/";
const WORKSPACE_DIR = __dirname;

let dbReady = false;
let dbInitInProgress = false;

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/vendor", express.static(path.join(WORKSPACE_DIR, "vendor")));

function normalizePort(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 22;
}

function normalizeRecordInput(payload, fallbackId = "") {
  return {
    id: String(payload.id || fallbackId || randomUUID()).trim(),
    partnerName: String(payload.partnerName || "").trim(),
    connectionType: String(payload.connectionType || "").trim().toUpperCase(),
    host: String(payload.host || "").trim(),
    port: normalizePort(payload.port),
    username: String(payload.username || "").trim(),
    password: String(payload.password || "").trim(),
    contactPerson: String(payload.contactPerson || "").trim(),
    notes: String(payload.notes || "").trim()
  };
}

function validateRecord(record) {
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

function requireDatabase(res) {
  if (!dbReady) {
    res.status(503).json({ message: "Database is not ready yet" });
    return false;
  }

  return true;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    dbReady,
    storage: "oracle",
    apfHomeUrl: APF_HOME_URL
  });
});

app.get("/api/sftp-records", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  try {
    const records = await listSftpRecords();
    res.json({ records });
  } catch (error) {
    console.error("Unable to load SFTP records:", error);
    res.status(500).json({ message: "Unable to load SFTP records" });
  }
});

app.put("/api/sftp-records/bulk", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  const payloadRecords = Array.isArray(req.body.records) ? req.body.records : null;

  if (!payloadRecords) {
    res.status(400).json({ message: "records must be an array" });
    return;
  }

  const normalizedRecords = payloadRecords.map((record) => normalizeRecordInput(record));
  const invalidRecord = normalizedRecords.find((record) => validateRecord(record));

  if (invalidRecord) {
    res.status(400).json({ message: validateRecord(invalidRecord) });
    return;
  }

  try {
    const records = await bulkUpsertSftpRecords(normalizedRecords);
    res.json({ records });
  } catch (error) {
    console.error("Unable to bulk save SFTP records:", error);
    res.status(500).json({ message: "Unable to bulk save SFTP records" });
  }
});

app.post("/api/sftp-records", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  const record = normalizeRecordInput(req.body);
  const validationMessage = validateRecord(record);

  if (validationMessage) {
    res.status(400).json({ message: validationMessage });
    return;
  }

  try {
    const savedRecord = await upsertSftpRecord(record);
    res.status(201).json({ record: savedRecord });
  } catch (error) {
    console.error("Unable to save SFTP record:", error);
    res.status(500).json({ message: "Unable to save SFTP record" });
  }
});

app.put("/api/sftp-records/:id", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  const record = normalizeRecordInput(req.body, req.params.id);
  const validationMessage = validateRecord(record);

  if (validationMessage) {
    res.status(400).json({ message: validationMessage });
    return;
  }

  try {
    const savedRecord = await upsertSftpRecord(record);
    res.json({ record: savedRecord });
  } catch (error) {
    console.error("Unable to update SFTP record:", error);
    res.status(500).json({ message: "Unable to update SFTP record" });
  }
});

app.delete("/api/sftp-records/:id", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  try {
    await deleteSftpRecord(req.params.id);
    res.json({ message: "SFTP record deleted" });
  } catch (error) {
    console.error("Unable to delete SFTP record:", error);
    res.status(500).json({ message: "Unable to delete SFTP record" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(WORKSPACE_DIR, "index.html"));
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(WORKSPACE_DIR, "index.html"));
});

app.get("/styles.css", (req, res) => {
  res.sendFile(path.join(WORKSPACE_DIR, "styles.css"));
});

app.get("/app.js", (req, res) => {
  res.sendFile(path.join(WORKSPACE_DIR, "app.js"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(WORKSPACE_DIR, "index.html"));
});

async function initializeDatabaseWithRetry() {
  if (dbInitInProgress) {
    return;
  }

  dbInitInProgress = true;

  try {
    await initializeDatabase();
    dbReady = true;
    console.log("SFTP database initialized");
  } catch (error) {
    dbReady = false;
    console.error("SFTP database initialization failed, retrying:", error.message);
    setTimeout(() => {
      dbInitInProgress = false;
      initializeDatabaseWithRetry();
    }, DB_RETRY_DELAY_MS);
    return;
  }

  dbInitInProgress = false;
}

const server = app.listen(PORT, () => {
  console.log(`SFTP workspace started at http://localhost:${PORT}`);
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

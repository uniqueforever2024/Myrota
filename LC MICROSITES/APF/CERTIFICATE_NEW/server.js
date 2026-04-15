try {
  require("dotenv").config();
} catch {}

const path = require("path");
const { randomUUID } = require("crypto");
const express = require("express");
const {
  initializeDatabase,
  listCertificates,
  bulkUpsertCertificates,
  upsertCertificate,
  deleteCertificate,
  closeDatabase,
} = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3003);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 10000);
const APF_HOME_URL = process.env.APF_HOME_URL || "http://localhost:3001/";
const PUBLIC_DIR = path.join(__dirname, "public");

let dbReady = false;
let dbInitInProgress = false;

function createCertificateId() {
  if (typeof randomUUID === "function") {
    return `cert-${randomUUID()}`;
  }

  return `cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCertificateRecord(payload, fallbackId = "") {
  return {
    id: String(payload?.id || fallbackId || createCertificateId()).trim(),
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

function requireDatabase(res) {
  if (!dbReady) {
    res.status(503).json({ message: "Database is not ready yet" });
    return false;
  }

  return true;
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    dbReady,
    storage: "oracle",
    apfHomeUrl: APF_HOME_URL,
  });
});

app.get("/api/certificates", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  try {
    const records = await listCertificates();
    res.json({ records });
  } catch (error) {
    console.error("Unable to load certificates:", error);
    res.status(500).json({ message: "Unable to load certificates" });
  }
});

app.put("/api/certificates/bulk", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  const payloadRecords = Array.isArray(req.body?.records) ? req.body.records : null;

  if (!payloadRecords) {
    res.status(400).json({ message: "records must be an array." });
    return;
  }

  const normalizedRecords = payloadRecords.map((record) =>
    normalizeCertificateRecord(record)
  );
  const invalidRecord = normalizedRecords.find((record) =>
    Boolean(validateCertificateRecord(record))
  );

  if (invalidRecord) {
    res.status(400).json({ message: validateCertificateRecord(invalidRecord) });
    return;
  }

  try {
    const records = await bulkUpsertCertificates(normalizedRecords);
    res.json({ records });
  } catch (error) {
    console.error("Unable to bulk save certificates:", error);
    res.status(500).json({ message: "Unable to bulk save certificates" });
  }
});

app.post("/api/certificates", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  const record = normalizeCertificateRecord(req.body);
  const validationMessage = validateCertificateRecord(record);

  if (validationMessage) {
    res.status(400).json({ message: validationMessage });
    return;
  }

  try {
    const savedRecord = await upsertCertificate(record);
    res.status(201).json({ record: savedRecord });
  } catch (error) {
    console.error("Unable to save certificate:", error);
    res.status(500).json({ message: "Unable to save certificate" });
  }
});

app.put("/api/certificates/:id", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  const record = normalizeCertificateRecord(req.body, req.params.id);
  const validationMessage = validateCertificateRecord(record);

  if (validationMessage) {
    res.status(400).json({ message: validationMessage });
    return;
  }

  try {
    const savedRecord = await upsertCertificate(record);
    res.json({ record: savedRecord });
  } catch (error) {
    console.error("Unable to update certificate:", error);
    res.status(500).json({ message: "Unable to update certificate" });
  }
});

app.delete("/api/certificates/:id", async (req, res) => {
  if (!requireDatabase(res)) {
    return;
  }

  try {
    await deleteCertificate(req.params.id);
    res.json({ message: "Certificate deleted" });
  } catch (error) {
    console.error("Unable to delete certificate:", error);
    res.status(500).json({ message: "Unable to delete certificate" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

async function initializeDatabaseWithRetry() {
  if (dbInitInProgress) {
    return;
  }

  dbInitInProgress = true;

  try {
    await initializeDatabase();
    dbReady = true;
    console.log("Certificate Oracle storage initialized");
  } catch (error) {
    dbReady = false;
    console.error("Certificate Oracle initialization failed, retrying:", error.message);
    setTimeout(() => {
      dbInitInProgress = false;
      initializeDatabaseWithRetry();
    }, DB_RETRY_DELAY_MS);
    return;
  }

  dbInitInProgress = false;
}

const server = app.listen(PORT, () => {
  console.log(`Certificate workspace started at http://localhost:${PORT}`);
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

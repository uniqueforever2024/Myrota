const STORAGE_KEY = "sftp_workspace_records_v1";
const TEMPLATE_FILE_NAME = "sftp-partner-template.xlsx";
const API_CANDIDATES = ["./api", "/api"];

const openFormButton = document.getElementById("open-form-button");
const closeFormButton = document.getElementById("close-form-button");
const resetFormButton = document.getElementById("reset-form-button");
const downloadTemplateButton = document.getElementById("download-template-button");
const importFileInput = document.getElementById("import-file-input");
const searchInput = document.getElementById("search-input");
const editorPanel = document.getElementById("editor-panel");
const editorTitle = document.getElementById("editor-title");
const workspaceStatus = document.getElementById("workspace-status");
const recordCount = document.getElementById("record-count");
const recordsBody = document.getElementById("records-body");
const sftpForm = document.getElementById("sftp-form");
const recordIdInput = document.getElementById("record-id");
const partnerNameInput = document.getElementById("partner-name");
const connectionTypeInput = document.getElementById("connection-type");
const hostInput = document.getElementById("host");
const portInput = document.getElementById("port");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const contactPersonInput = document.getElementById("contact-person");
const notesInput = document.getElementById("notes");

let records = [];
let searchTerm = "";
let apiBaseUrl = "";
let apiMode = false;

function loadLocalRecords() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function cacheRecords(nextRecords) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
}

function setStatus(message, type = "") {
  workspaceStatus.textContent = message || "";
  workspaceStatus.classList.remove("success", "error");

  if (type) {
    workspaceStatus.classList.add(type);
  }
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `sftp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeConnectionType(value) {
  return String(value || "SFTP").trim().toUpperCase() || "SFTP";
}

function parsePort(value) {
  const numericValue = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 65535
    ? numericValue
    : 22;
}

function normalizeRecord(record, { preserveId = true } = {}) {
  const nextId = String(record.id || "").trim();
  const updatedAt = String(record.updatedAt || record.updated_at || "").trim() || new Date().toISOString();

  return {
    id: preserveId && nextId ? nextId : createId(),
    partnerName: String(record.partnerName || record.partner_name || "").trim(),
    connectionType: normalizeConnectionType(record.connectionType || record.connection_type),
    host: String(record.host || "").trim(),
    port: parsePort(record.port),
    username: String(record.username || "").trim(),
    password: String(record.password || record.password_value || "").trim(),
    contactPerson: String(record.contactPerson || record.contact_person || "").trim(),
    notes: String(record.notes || "").trim(),
    updatedAt
  };
}

function formatDateTime(dateValue) {
  return new Date(dateValue).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sortRecords(nextRecords) {
  return [...nextRecords].sort((left, right) => {
    const updatedDelta = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return left.partnerName.localeCompare(right.partnerName);
  });
}

function getVisibleRecords() {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const sorted = sortRecords(records);

  if (!normalizedSearch) {
    return sorted;
  }

  return sorted.filter((record) =>
    [
      record.partnerName,
      record.connectionType,
      record.host,
      String(record.port),
      record.username,
      record.password,
      record.contactPerson,
      record.notes
    ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
  );
}

function openEditor() {
  editorPanel.classList.remove("hidden");
}

function closeEditor() {
  editorPanel.classList.add("hidden");
}

function resetForm() {
  sftpForm.reset();
  recordIdInput.value = "";
  connectionTypeInput.value = "SFTP";
  portInput.value = "22";
  editorTitle.textContent = "Add partner connection details";
}

function beginCreateRecord() {
  resetForm();
  openEditor();
  partnerNameInput.focus();
}

function editRecord(recordId) {
  const selectedRecord = records.find((record) => record.id === recordId);
  if (!selectedRecord) {
    return;
  }

  recordIdInput.value = selectedRecord.id;
  partnerNameInput.value = selectedRecord.partnerName;
  connectionTypeInput.value = selectedRecord.connectionType;
  hostInput.value = selectedRecord.host;
  portInput.value = String(selectedRecord.port || 22);
  usernameInput.value = selectedRecord.username;
  passwordInput.value = selectedRecord.password;
  contactPersonInput.value = selectedRecord.contactPerson;
  notesInput.value = selectedRecord.notes;
  editorTitle.textContent = "Edit partner connection details";
  openEditor();
  partnerNameInput.focus();
}

function renderRecords() {
  const visibleRecords = getVisibleRecords();
  recordCount.textContent = String(visibleRecords.length);

  if (!visibleRecords.length) {
    recordsBody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">
            No SFTP details found. Add a new record or import an Excel file to get started.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  recordsBody.innerHTML = visibleRecords
    .map((record) => {
      return `
        <tr>
          <td>${escapeHtml(record.partnerName)}</td>
          <td><span class="chip">${escapeHtml(record.connectionType)}</span></td>
          <td class="cell-host">${escapeHtml(record.host)}</td>
          <td>${escapeHtml(record.port)}</td>
          <td class="cell-username">${escapeHtml(record.username)}</td>
          <td class="cell-password">${escapeHtml(record.password)}</td>
          <td>${escapeHtml(record.contactPerson)}</td>
          <td>${escapeHtml(record.notes || "-")}</td>
          <td>${escapeHtml(formatDateTime(record.updatedAt))}</td>
          <td>
            <div class="row-actions">
              <button class="row-action" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">
                Edit
              </button>
              <button class="row-action danger" type="button" data-action="delete" data-id="${escapeHtml(record.id)}">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function requestApi(path, options = {}) {
  if (!apiBaseUrl) {
    throw new Error("SFTP API is not available");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || "SFTP API request failed");
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
      apiBaseUrl = candidate;
      apiMode = payload.storage === "postgres" || payload.dbReady === true;
      setStatus("Connected to PostgreSQL workspace.", "success");
      return true;
    } catch (error) {
      // Try the next candidate path.
    }
  }

  apiBaseUrl = "";
  apiMode = false;
  setStatus("Records are stored in this browser until a database is connected.");
  return false;
}

async function loadRecordsFromActiveStorage() {
  const hasApi = await detectApi();

  if (hasApi) {
    try {
      const payload = await requestApi("/sftp-records");
      records = Array.isArray(payload.records) ? payload.records.map(normalizeRecord) : [];
      cacheRecords(records);
      renderRecords();
      return;
    } catch (error) {
      apiBaseUrl = "";
      apiMode = false;
      setStatus(
        "The PostgreSQL workspace is not reachable right now. Showing local browser records instead.",
        "error"
      );
    }
  }

  records = loadLocalRecords().map((record) => normalizeRecord(record));
  renderRecords();
}

async function persistRecord(nextRecord) {
  if (apiMode) {
    const method = recordIdInput.value ? "PUT" : "POST";
    const path = recordIdInput.value
      ? `/sftp-records/${encodeURIComponent(nextRecord.id)}`
      : "/sftp-records";
    const payload = await requestApi(path, {
      method,
      body: JSON.stringify(nextRecord)
    });

    const savedRecord = normalizeRecord(payload.record);
    const existingIndex = records.findIndex((record) => record.id === savedRecord.id);

    if (existingIndex >= 0) {
      records[existingIndex] = savedRecord;
    } else {
      records.unshift(savedRecord);
    }

    records = sortRecords(records);
    cacheRecords(records);
    return;
  }

  if (recordIdInput.value) {
    records = records.map((record) => (record.id === recordIdInput.value ? nextRecord : record));
  } else {
    records = [nextRecord, ...records];
  }

  cacheRecords(records);
}

async function removeRecord(recordId) {
  if (apiMode) {
    await requestApi(`/sftp-records/${encodeURIComponent(recordId)}`, {
      method: "DELETE"
    });
  }

  records = records.filter((record) => record.id !== recordId);
  cacheRecords(records);
}

async function persistBulkRecords(nextRecords) {
  if (apiMode) {
    const payload = await requestApi("/sftp-records/bulk", {
      method: "PUT",
      body: JSON.stringify({ records: nextRecords })
    });
    records = Array.isArray(payload.records) ? payload.records.map(normalizeRecord) : [];
    cacheRecords(records);
    return;
  }

  records = nextRecords;
  cacheRecords(records);
}

function buildTemplateRows() {
  return [
    {
      id: "",
      partnerName: "Partner Alpha",
      connectionType: "SFTP",
      host: "sftp.partner-alpha.com",
      port: 22,
      username: "partner_alpha",
      password: "replace-me",
      contactPerson: "EDI Support",
      notes: "Daily inbound file exchange"
    }
  ];
}

function downloadTemplate() {
  const worksheet = XLSX.utils.json_to_sheet(buildTemplateRows(), {
    header: [
      "id",
      "partnerName",
      "connectionType",
      "host",
      "port",
      "username",
      "password",
      "contactPerson",
      "notes"
    ]
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SFTP Details");
  XLSX.writeFile(workbook, TEMPLATE_FILE_NAME);
  setStatus("Excel template downloaded.", "success");
}

function getImportCell(row, key) {
  const matchingKey = Object.keys(row).find(
    (item) => item.trim().toLowerCase() === key.toLowerCase()
  );

  return matchingKey ? row[matchingKey] : "";
}

function normalizeImportedRecord(row) {
  return normalizeRecord(
    {
      id: getImportCell(row, "id"),
      partnerName: getImportCell(row, "partnerName"),
      connectionType: getImportCell(row, "connectionType"),
      host: getImportCell(row, "host"),
      port: getImportCell(row, "port"),
      username: getImportCell(row, "username"),
      password: getImportCell(row, "password"),
      contactPerson: getImportCell(row, "contactPerson"),
      notes: getImportCell(row, "notes"),
      updatedAt: new Date().toISOString()
    },
    { preserveId: true }
  );
}

function mergeImportedRecords(existingRecords, importedRecords) {
  const nextRecords = existingRecords.map((record) => normalizeRecord(record));
  let added = 0;
  let updated = 0;

  importedRecords.forEach((record) => {
    if (!record.partnerName || !record.connectionType || !record.host || !record.username) {
      return;
    }

    const idMatchIndex = record.id
      ? nextRecords.findIndex((item) => item.id === record.id)
      : -1;

    const fallbackMatchIndex = nextRecords.findIndex(
      (item) =>
        item.partnerName.trim().toLowerCase() === record.partnerName.trim().toLowerCase() &&
        item.connectionType === record.connectionType &&
        item.host.trim().toLowerCase() === record.host.trim().toLowerCase()
    );

    const targetIndex = idMatchIndex >= 0 ? idMatchIndex : fallbackMatchIndex;

    if (targetIndex >= 0) {
      nextRecords[targetIndex] = {
        ...nextRecords[targetIndex],
        ...record,
        id: nextRecords[targetIndex].id,
        updatedAt: new Date().toISOString()
      };
      updated += 1;
      return;
    }

    nextRecords.unshift({
      ...record,
      id: record.id || createId(),
      updatedAt: new Date().toISOString()
    });
    added += 1;
  });

  return {
    records: nextRecords,
    added,
    updated
  };
}

async function importExcelFile(file) {
  if (!file) {
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (!rows.length) {
    setStatus("The imported file is empty.", "error");
    return;
  }

  const importedRecords = rows.map(normalizeImportedRecord);
  const mergeResult = mergeImportedRecords(records, importedRecords);

  if (mergeResult.added === 0 && mergeResult.updated === 0) {
    setStatus("No valid SFTP rows were found in the import file.", "error");
    return;
  }

  await persistBulkRecords(mergeResult.records);
  renderRecords();
  setStatus(
    `Bulk import completed: ${mergeResult.added} added, ${mergeResult.updated} updated.`,
    "success"
  );
}

async function submitForm(event) {
  event.preventDefault();
  const isEditing = Boolean(recordIdInput.value);

  const nextRecord = normalizeRecord({
    id: recordIdInput.value,
    partnerName: partnerNameInput.value,
    connectionType: connectionTypeInput.value,
    host: hostInput.value,
    port: portInput.value,
    username: usernameInput.value,
    password: passwordInput.value,
    contactPerson: contactPersonInput.value,
    notes: notesInput.value,
    updatedAt: new Date().toISOString()
  });

  if (
    !nextRecord.partnerName ||
    !nextRecord.connectionType ||
    !nextRecord.host ||
    !nextRecord.username ||
    !nextRecord.password ||
    !nextRecord.contactPerson
  ) {
    setStatus("Please complete all required SFTP fields.", "error");
    return;
  }

  try {
    await persistRecord(nextRecord);
    renderRecords();
    resetForm();
    closeEditor();
    setStatus(
      isEditing ? "SFTP details updated." : "SFTP details added.",
      "success"
    );
  } catch (error) {
    setStatus(error.message || "Unable to save SFTP details right now.", "error");
  }
}

openFormButton.addEventListener("click", beginCreateRecord);
closeFormButton.addEventListener("click", () => {
  resetForm();
  closeEditor();
});
resetFormButton.addEventListener("click", resetForm);
downloadTemplateButton.addEventListener("click", downloadTemplate);
sftpForm.addEventListener("submit", submitForm);

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value;
  renderRecords();
});

importFileInput.addEventListener("change", () => {
  const selectedFile = importFileInput.files && importFileInput.files[0];
  importExcelFile(selectedFile)
    .catch((error) => {
      setStatus(
        error.message || "Unable to import the Excel file. Please check the format and try again.",
        "error"
      );
    })
    .finally(() => {
      importFileInput.value = "";
    });
});

recordsBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const recordId = target.dataset.id;

  if (!action || !recordId) {
    return;
  }

  if (action === "edit") {
    editRecord(recordId);
    return;
  }

  if (action === "delete") {
    removeRecord(recordId)
      .then(() => {
        renderRecords();
        setStatus("SFTP details removed.", "success");
      })
      .catch((error) => {
        setStatus(error.message || "Unable to remove SFTP details right now.", "error");
      });
  }
});

loadRecordsFromActiveStorage().catch(() => {
  records = loadLocalRecords().map((record) => normalizeRecord(record));
  renderRecords();
  setStatus("Unable to initialize the SFTP workspace. Showing local browser data.", "error");
});

const API_CANDIDATES = ["/api", "./api", "../api"];
const SESSION_KEY = "certificate_new_session_v1";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_FILE_NAME = "certificate-bulk-template.xlsx";

const workspaceStatusEl = document.getElementById("workspace-status");
const logoutButton = document.getElementById("logout-button");
const logoutOverlay = document.getElementById("logout-overlay");
const reopenButton = document.getElementById("reopen-button");
const homeButton = document.getElementById("home-button");
const manageButton = document.getElementById("manage-button");
const toggleFormButton = document.getElementById("toggle-form-button");
const downloadTemplateButton = document.getElementById("download-template-button");
const importFileInput = document.getElementById("import-file-input");
const formPanel = document.getElementById("form-panel");
const closeFormButton = document.getElementById("close-form-button");
const certificateForm = document.getElementById("certificate-form");
const certificateIdInput = document.getElementById("certificate-id");
const resetFormButton = document.getElementById("reset-form-button");
const saveCertificateButton = document.getElementById("save-certificate-button");
const uploadInput = document.getElementById("certificate-upload");
const uploadNameEl = document.getElementById("upload-name");
const formStatusEl = document.getElementById("form-status");
const formEyebrowEl = document.getElementById("form-eyebrow");
const formTitleEl = document.getElementById("form-title");
const todayDateEl = document.getElementById("today-date");
const detailsTitleEl = document.getElementById("details-title");
const detailsCopyEl = document.getElementById("details-copy");
const detailsCountEl = document.getElementById("details-count");
const detailsShell = document.getElementById("details-shell");
const closeDetailsButton = document.getElementById("close-details-button");
const searchInput = document.getElementById("search-input");
const tableBodyEl = document.getElementById("certificate-table-body");

const countTrackedEl = document.getElementById("count-tracked");
const count7El = document.getElementById("count-7");
const count30El = document.getElementById("count-30");
const count15El = document.getElementById("count-15");
const countExpiredEl = document.getElementById("count-expired");
const labelTrackedEl = document.getElementById("label-tracked");
const label7El = document.getElementById("label-7");
const label30El = document.getElementById("label-30");
const label15El = document.getElementById("label-15");
const labelExpiredEl = document.getElementById("label-expired");

const windowCards = Array.from(document.querySelectorAll(".window-card"));
const MYROTA_HOME_URL = "/";
const MYROTA_LOGIN_URL = "/?logout=1";
const urlState = new URL(window.location.href);
const popupMode = urlState.searchParams.get("mode") || "";
const popupRecordId = urlState.searchParams.get("id") || "";
const isPopupFormMode = popupMode === "add" || popupMode === "edit";
const POPUP_SYNC_KEY = "certificate_new_sync_v1";

let selectedFilter = "all";
let searchTerm = "";
let certificates = [];
let pendingUpload = null;
let apiBaseUrl = "";
let formMode = popupMode === "edit" ? "edit" : "add";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function setFormStatus(message, type) {
  formStatusEl.textContent = message || "";
  formStatusEl.classList.remove("success", "error");

  if (type) {
    formStatusEl.classList.add(type);
  }
}

function setSessionOpen(isOpen) {
  window.sessionStorage.setItem(SESSION_KEY, isOpen ? "open" : "closed");
}

function isSessionClosed() {
  return window.sessionStorage.getItem(SESSION_KEY) === "closed";
}

function buildModeUrl(mode, recordId = "") {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("mode", mode);

  if (recordId) {
    nextUrl.searchParams.set("id", recordId);
  } else {
    nextUrl.searchParams.delete("id");
  }

  return nextUrl.toString();
}

function buildHomeUrl() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete("mode");
  nextUrl.searchParams.delete("id");
  return nextUrl.toString();
}

function publishCertificateSync(message) {
  const payload = {
    type: "certificate-sync",
    message,
    at: Date.now(),
  };

  try {
    window.localStorage.setItem(POPUP_SYNC_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage sync failures.
  }

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(payload, window.location.origin);
    } catch {
      // Ignore opener messaging failures.
    }
  }
}

async function refreshPortalAfterPopup(message) {
  await loadCertificatesFromApi();
  selectedFilter = "all";
  searchTerm = "";

  if (searchInput) {
    searchInput.value = "";
  }

  closeDetailsPanel();
  renderPortal();

  if (message) {
    setWorkspaceStatus(message, "success");
  }
}

function openCertificatePopup(mode, recordId = "") {
  const popupWindow = window.open(
    buildModeUrl(mode, recordId),
    recordId ? `certificate-${recordId}` : "certificate-add",
    "width=920,height=920,resizable=yes,scrollbars=yes"
  );

  if (popupWindow) {
    popupWindow.focus();
    return;
  }

  window.location.assign(buildModeUrl(mode, recordId));
}

function createCertificateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `cert-${window.crypto.randomUUID()}`;
  }

  return `cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCertificate(record) {
  return {
    id: String(record.id || "").trim() || createCertificateId(),
    partnerName: String(record.partnerName || "").trim(),
    certificateType: String(record.certificateType || "").trim(),
    contactTeam: String(record.contactTeam || "").trim(),
    issuedDate: String(record.issuedDate || "").trim(),
    expiryDate: String(record.expiryDate || "").trim(),
    uploadName: String(record.uploadName || "").trim(),
    uploadType: String(record.uploadType || "").trim(),
    uploadDataUrl: String(record.uploadDataUrl || "").trim(),
    notes: String(record.notes || "").trim(),
    createdAt: String(record.createdAt || "").trim(),
    updatedAt: String(record.updatedAt || "").trim(),
  };
}

function setFormMode(mode) {
  formMode = mode === "edit" ? "edit" : "add";

  if (formEyebrowEl) {
    formEyebrowEl.textContent = formMode === "edit" ? "Edit Certificate" : "Add Certificate";
  }

  if (formTitleEl) {
    formTitleEl.textContent =
      formMode === "edit"
        ? "Update an existing tracked certificate"
        : "Add a new certificate for tracking";
  }

  if (saveCertificateButton) {
    saveCertificateButton.textContent =
      formMode === "edit" ? "Save Changes" : "Save Certificate";
  }
}

function startOfLocalDay(dateInput) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDaysUntilExpiry(expiryDate) {
  const today = startOfLocalDay(new Date());
  const expiry = startOfLocalDay(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / DAY_IN_MS);
}

function getStatus(record) {
  const daysUntilExpiry = getDaysUntilExpiry(record.expiryDate);

  if (daysUntilExpiry < 0) {
    return "expired";
  }

  if (daysUntilExpiry <= 7) {
    return "expiring7";
  }

  if (daysUntilExpiry <= 15) {
    return "expiring15";
  }

  if (daysUntilExpiry <= 30) {
    return "expiring30";
  }

  return "active";
}

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }

  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status, daysUntilExpiry) {
  if (status === "expired") {
    const daysAgo = Math.abs(daysUntilExpiry);
    return daysAgo === 1 ? "Expired 1 day ago" : `Expired ${daysAgo} days ago`;
  }

  if (daysUntilExpiry === 0) {
    return "Expires today";
  }

  return `${daysUntilExpiry} days left`;
}

function sortByExpiry(records) {
  return [...records].sort((left, right) => {
    return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
  });
}

function getGroupedRecords() {
  return certificates.reduce(
    (accumulator, record) => {
      const status = getStatus(record);

      if (status === "expired") {
        accumulator.expired.push(record);
      } else if (status === "expiring7") {
        accumulator.expiring7.push(record);
      } else if (status === "expiring15") {
        accumulator.expiring15.push(record);
      } else if (status === "expiring30") {
        accumulator.expiring30.push(record);
      } else {
        accumulator.active.push(record);
      }

      return accumulator;
    },
    {
      expired: [],
      expiring7: [],
      expiring30: [],
      expiring15: [],
      active: [],
    }
  );
}

function getSelectedRecords() {
  const grouped = getGroupedRecords();

  if (selectedFilter === "expiring30") {
    return {
      title: "Certificates expiring in 16 to 30 days",
      copy: "These certificates are inside the 30 day planning window.",
      records: grouped.expiring30,
    };
  }

  if (selectedFilter === "expiring15") {
    return {
      title: "Certificates expiring in 8 to 15 days",
      copy: "These certificates are inside the 15 day window and need follow-up soon.",
      records: grouped.expiring15,
    };
  }

  if (selectedFilter === "expired") {
    return {
      title: "Expired certificates",
      copy: "These certificates have already expired and need immediate attention.",
      records: grouped.expired,
    };
  }

  if (selectedFilter === "expiring7") {
    return {
      title: "Certificates expiring in less than 7 days",
      copy: "These certificates are very close to expiry and need urgent action.",
      records: grouped.expiring7,
    };
  }

  return {
    title: "All tracked certificates",
    copy: "Select one expiry window above to filter the complete certificate detail list.",
    records: [
      ...grouped.expired,
      ...grouped.expiring7,
      ...grouped.expiring15,
      ...grouped.expiring30,
      ...grouped.active,
    ],
  };
}

function renderWindowCounts() {
  const grouped = getGroupedRecords();
  const trackedCount = certificates.length;

  countTrackedEl.textContent = String(trackedCount);
  count7El.textContent = String(grouped.expiring7.length);
  count30El.textContent = String(grouped.expiring30.length);
  count15El.textContent = String(grouped.expiring15.length);
  countExpiredEl.textContent = String(grouped.expired.length);

  labelTrackedEl.textContent =
    trackedCount === 0 ? "No certificate tracked yet" : "Click to view all tracked certificates";
  label7El.textContent =
    grouped.expiring7.length === 0 ? "No certificate in this window" : "Click to view all details";
  label30El.textContent =
    grouped.expiring30.length === 0 ? "No certificate in this window" : "Click to view all details";
  label15El.textContent =
    grouped.expiring15.length === 0 ? "No certificate in this window" : "Click to view all details";
  labelExpiredEl.textContent =
    grouped.expired.length === 0 ? "No expired certificate" : "Click to view all details";
}

function renderActiveWindow() {
  windowCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.filter === selectedFilter);
  });
}

function renderTable() {
  const { title, copy, records } = getSelectedRecords();
  const filteredRecords = records.filter((record) =>
    record.partnerName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const sortedRecords = sortByExpiry(filteredRecords);

  detailsTitleEl.textContent = title;
  detailsCopyEl.textContent = searchTerm
    ? `${copy} Search results for "${searchTerm}".`
    : copy;
  detailsCountEl.textContent = `${sortedRecords.length} item${sortedRecords.length === 1 ? "" : "s"}`;
  todayDateEl.textContent = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  if (!sortedRecords.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">${
            searchTerm
              ? `No certificates found for "${escapeHtml(searchTerm)}".`
              : "No certificates found in this selection."
          }</div>
        </td>
      </tr>
    `;
    return;
  }

  tableBodyEl.innerHTML = sortedRecords
    .map((record) => {
      const status = getStatus(record);
      const daysUntilExpiry = getDaysUntilExpiry(record.expiryDate);

      return `
        <tr>
          <td>${escapeHtml(record.partnerName)}</td>
          <td>${escapeHtml(record.certificateType)}</td>
          <td>${escapeHtml(record.contactTeam || "-")}</td>
          <td>${escapeHtml(formatDate(record.issuedDate))}</td>
          <td>${escapeHtml(formatDate(record.expiryDate))}</td>
          <td>${escapeHtml(record.uploadName || "Upload pending")}</td>
          <td>
            <span class="status-chip ${status}">
              ${escapeHtml(getStatusLabel(status, daysUntilExpiry))}
            </span>
          </td>
          <td>${escapeHtml(record.notes || "-")}</td>
          <td>
            <div class="row-actions">
              <button class="row-action" type="button" data-action="edit" data-id="${escapeHtml(
                record.id
              )}">
                Edit
              </button>
              <button class="row-action danger" type="button" data-action="delete" data-id="${escapeHtml(
                record.id
              )}">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderPortal() {
  renderWindowCounts();
  renderActiveWindow();
  renderTable();
}

function openDetailsPanel() {
  detailsShell.classList.remove("hidden");
  detailsShell.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    detailsShell.classList.add("open");
  });
}

function closeDetailsPanel() {
  detailsShell.classList.remove("open");
  detailsShell.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (!detailsShell.classList.contains("open")) {
      detailsShell.classList.add("hidden");
    }
  }, 260);
}

function openFormPanel() {
  formPanel.classList.remove("hidden");

  if (!isPopupFormMode && toggleFormButton) {
    toggleFormButton.textContent = "Hide Form";
  }
}

function closeFormPanel() {
  if (isPopupFormMode) {
    window.close();
    window.setTimeout(() => {
      window.location.assign(buildHomeUrl());
    }, 180);
    return;
  }

  formPanel.classList.add("hidden");

  if (toggleFormButton) {
    toggleFormButton.textContent = "Add Certificate";
  }
}

function resetPendingUpload() {
  pendingUpload = null;
  uploadInput.value = "";
  uploadNameEl.textContent = "No file selected yet";
}

function clearForm() {
  certificateForm.reset();
  certificateIdInput.value = "";
  setFormStatus("", "");
  resetPendingUpload();
  setFormMode(isPopupFormMode && popupMode === "edit" ? "edit" : "add");
}

function populateForm(record) {
  certificateIdInput.value = record.id;
  certificateForm.elements.partnerName.value = record.partnerName;
  certificateForm.elements.certificateType.value = record.certificateType;
  certificateForm.elements.contactTeam.value = record.contactTeam;
  certificateForm.elements.issuedDate.value = record.issuedDate;
  certificateForm.elements.expiryDate.value = record.expiryDate;
  certificateForm.elements.notes.value = record.notes || "";

  if (record.uploadName || record.uploadType || record.uploadDataUrl) {
    pendingUpload = {
      name: record.uploadName || "",
      type: record.uploadType || "application/octet-stream",
      dataUrl: record.uploadDataUrl || "",
    };
    uploadNameEl.textContent = record.uploadName || "Existing upload kept";
  } else {
    resetPendingUpload();
  }
}

function preparePopupForm(records = []) {
  document.body.classList.add("popup-mode");
  openFormPanel();

  if (popupMode === "edit") {
    const existingRecord = records.find((record) => record.id === popupRecordId);

    if (!existingRecord) {
      setFormStatus("Unable to find the selected certificate for editing.", "error");
      setFormMode("edit");
      return;
    }

    setFormMode("edit");
    populateForm(existingRecord);
    setFormStatus("", "");
    return;
  }

  setFormMode("add");
  clearForm();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function updateUploadSelection() {
  const selectedFile = uploadInput.files && uploadInput.files[0];

  if (!selectedFile) {
    resetPendingUpload();
    return;
  }

  if (selectedFile.size > 2.5 * 1024 * 1024) {
    setFormStatus("Please upload a file smaller than 2.5 MB.", "error");
    resetPendingUpload();
    return;
  }

  pendingUpload = {
    name: selectedFile.name,
    type: selectedFile.type || "application/octet-stream",
    dataUrl: await readFileAsDataUrl(selectedFile),
  };
  uploadNameEl.textContent = pendingUpload.name;
  setFormStatus("", "");
}

function ensureXlsxLibrary() {
  if (typeof XLSX === "undefined") {
    throw new Error("Excel tools are not available right now.");
  }
}

function buildTemplateRows() {
  return [
    {
      id: "",
      partnerName: "Partner Alpha",
      certificateType: "AS2",
      contactTeam: "EDI Support",
      issuedDate: "2026-04-01",
      expiryDate: "2027-04-01",
      uploadName: "",
      uploadType: "",
      uploadDataUrl: "",
      notes: "Renewal owner and environment notes",
    },
  ];
}

function downloadTemplate() {
  ensureXlsxLibrary();

  const worksheet = XLSX.utils.json_to_sheet(buildTemplateRows(), {
    header: [
      "id",
      "partnerName",
      "certificateType",
      "contactTeam",
      "issuedDate",
      "expiryDate",
      "uploadName",
      "uploadType",
      "uploadDataUrl",
      "notes",
    ],
  });
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Certificates");
  XLSX.writeFile(workbook, TEMPLATE_FILE_NAME);
  setWorkspaceStatus("Certificate Excel template downloaded.", "success");
}

function getImportCell(row, key) {
  const matchingKey = Object.keys(row).find(
    (item) => item.trim().toLowerCase() === key.toLowerCase()
  );

  return matchingKey ? row[matchingKey] : "";
}

function normalizeImportedCertificate(row) {
  return normalizeCertificate({
    id: getImportCell(row, "id"),
    partnerName: getImportCell(row, "partnerName"),
    certificateType: getImportCell(row, "certificateType"),
    contactTeam: getImportCell(row, "contactTeam"),
    issuedDate: getImportCell(row, "issuedDate"),
    expiryDate: getImportCell(row, "expiryDate"),
    uploadName: getImportCell(row, "uploadName"),
    uploadType: getImportCell(row, "uploadType"),
    uploadDataUrl: getImportCell(row, "uploadDataUrl"),
    notes: getImportCell(row, "notes"),
  });
}

function mergeImportedCertificates(existingCertificates, importedCertificates) {
  const nextCertificates = existingCertificates.map((record) =>
    normalizeCertificate(record)
  );
  let added = 0;
  let updated = 0;
  let skipped = 0;

  importedCertificates.forEach((record) => {
    if (
      !record.partnerName ||
      !record.certificateType ||
      !record.contactTeam ||
      !record.issuedDate ||
      !record.expiryDate
    ) {
      skipped += 1;
      return;
    }

    if (new Date(record.expiryDate).getTime() < new Date(record.issuedDate).getTime()) {
      skipped += 1;
      return;
    }

    const idMatchIndex = record.id
      ? nextCertificates.findIndex((item) => item.id === record.id)
      : -1;

    const fallbackMatchIndex = nextCertificates.findIndex(
      (item) =>
        item.partnerName.trim().toLowerCase() ===
          record.partnerName.trim().toLowerCase() &&
        item.certificateType.trim().toLowerCase() ===
          record.certificateType.trim().toLowerCase() &&
        item.contactTeam.trim().toLowerCase() ===
          record.contactTeam.trim().toLowerCase()
    );

    const targetIndex = idMatchIndex >= 0 ? idMatchIndex : fallbackMatchIndex;

    if (targetIndex >= 0) {
      nextCertificates[targetIndex] = normalizeCertificate({
        ...nextCertificates[targetIndex],
        ...record,
        id: nextCertificates[targetIndex].id,
      });
      updated += 1;
      return;
    }

    nextCertificates.push(
      normalizeCertificate({
        ...record,
        id: record.id || createCertificateId(),
      })
    );
    added += 1;
  });

  return {
    records: nextCertificates,
    added,
    updated,
    skipped,
  };
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
      // Try the next candidate.
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

async function loadCertificatesFromApi() {
  const hasApi = await detectApi();

  if (!hasApi) {
    certificates = [];
    renderPortal();
    return;
  }

  try {
    const payload = await requestApi("/certificates");
    certificates = Array.isArray(payload.records)
      ? payload.records.map(normalizeCertificate)
      : [];
    if (isPopupFormMode) {
      preparePopupForm(certificates);
    }
    renderPortal();
  } catch (error) {
    certificates = [];
    if (isPopupFormMode) {
      preparePopupForm(certificates);
    }
    renderPortal();
    setWorkspaceStatus(error.message || "Unable to load certificates from Oracle.", "error");
  }
}

async function persistCertificate(record, { isEditing = false } = {}) {
  const hasApi = await ensureApiReady();

  if (!hasApi) {
    throw new Error("Oracle workspace is not reachable right now.");
  }

  const payload = await requestApi(
    isEditing ? `/certificates/${encodeURIComponent(record.id)}` : "/certificates",
    {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(record),
    }
  );

  const savedRecord = normalizeCertificate(payload.record);
  const existingIndex = certificates.findIndex((item) => item.id === savedRecord.id);

  if (existingIndex >= 0) {
    certificates[existingIndex] = savedRecord;
  } else {
    certificates.push(savedRecord);
  }
}

async function removeCertificate(recordId) {
  const hasApi = await ensureApiReady();

  if (!hasApi) {
    throw new Error("Oracle workspace is not reachable right now.");
  }

  await requestApi(`/certificates/${encodeURIComponent(recordId)}`, {
    method: "DELETE",
  });

  certificates = certificates.filter((record) => record.id !== recordId);
}

async function persistBulkCertificates(records) {
  const hasApi = await ensureApiReady();

  if (!hasApi) {
    throw new Error("Oracle workspace is not reachable right now.");
  }

  const payload = await requestApi("/certificates/bulk", {
    method: "PUT",
    body: JSON.stringify({ records }),
  });

  certificates = Array.isArray(payload.records)
    ? payload.records.map(normalizeCertificate)
    : [];
}

async function importExcelFile(file) {
  if (!file) {
    return;
  }

  ensureXlsxLibrary();

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    setWorkspaceStatus("The imported Excel file is empty.", "error");
    return;
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  if (!rows.length) {
    setWorkspaceStatus("The imported Excel file is empty.", "error");
    return;
  }

  const importedCertificates = rows.map(normalizeImportedCertificate);
  const mergeResult = mergeImportedCertificates(certificates, importedCertificates);

  if (mergeResult.added === 0 && mergeResult.updated === 0) {
    setWorkspaceStatus(
      mergeResult.skipped > 0
        ? "No valid certificate rows were found in the Excel file."
        : "The imported Excel file does not contain any certificate rows.",
      "error"
    );
    return;
  }

  await persistBulkCertificates(mergeResult.records);
  selectedFilter = "all";
  searchTerm = "";
  searchInput.value = "";
  openDetailsPanel();
  renderPortal();
  setWorkspaceStatus(
    `Bulk import completed: ${mergeResult.added} added, ${mergeResult.updated} updated${
      mergeResult.skipped ? `, ${mergeResult.skipped} skipped` : ""
    }.`,
    "success"
  );
}

async function addCertificate(event) {
  event.preventDefault();

  const formData = new FormData(certificateForm);
  const certificateId = String(formData.get("certificateId") || "").trim();
  const isEditing = Boolean(certificateId);
  const partnerName = String(formData.get("partnerName") || "").trim();
  const certificateType = String(formData.get("certificateType") || "").trim();
  const contactTeam = String(formData.get("contactTeam") || "").trim();
  const issuedDate = String(formData.get("issuedDate") || "").trim();
  const expiryDate = String(formData.get("expiryDate") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!partnerName || !certificateType || !contactTeam || !issuedDate || !expiryDate) {
    setFormStatus("Please complete all required certificate fields.", "error");
    return;
  }

  if (new Date(expiryDate).getTime() < new Date(issuedDate).getTime()) {
    setFormStatus("Expiry date must be after the certificate generate date.", "error");
    return;
  }

  try {
    const savedRecordId = certificateId || createCertificateId();

    await persistCertificate({
      id: savedRecordId,
      partnerName,
      certificateType,
      contactTeam,
      issuedDate,
      expiryDate,
      uploadName: pendingUpload?.name || "",
      uploadType: pendingUpload?.type || "",
      uploadDataUrl: pendingUpload?.dataUrl || "",
      notes,
    }, { isEditing });

    selectedFilter = "all";
    searchTerm = "";
    searchInput.value = "";
    clearForm();
    renderPortal();
    const successMessage = isEditing
      ? "Certificate updated successfully."
      : "Certificate saved successfully.";

    if (isPopupFormMode) {
      publishCertificateSync(successMessage);
      window.close();
      window.setTimeout(() => {
        window.location.assign(buildHomeUrl());
      }, 180);
      return;
    }

    closeDetailsPanel();
    setWorkspaceStatus(successMessage, "success");
    setFormStatus(successMessage, "success");
  } catch (error) {
    setFormStatus(error.message || "Unable to save certificate right now.", "error");
  }
}

function resolveApfLogoutUrl() {
  return MYROTA_LOGIN_URL;
}

function closePortalSession() {
  setSessionOpen(true);
  closeFormPanel();
  closeDetailsPanel();
  logoutOverlay.classList.add("hidden");
  window.location.assign(resolveApfLogoutUrl());
}

function reopenPortalSession() {
  setSessionOpen(true);
  logoutOverlay.classList.add("hidden");
}

windowCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (isSessionClosed()) {
      return;
    }

    selectedFilter = card.dataset.filter || "all";
    openDetailsPanel();
    renderPortal();
  });
});

logoutButton.addEventListener("click", closePortalSession);
reopenButton.addEventListener("click", reopenPortalSession);
manageButton.addEventListener("click", () => {
  if (isSessionClosed()) {
    return;
  }

  selectedFilter = "all";
  searchTerm = "";
  searchInput.value = "";
  openDetailsPanel();
  renderPortal();
});
closeDetailsButton.addEventListener("click", closeDetailsPanel);
downloadTemplateButton.addEventListener("click", () => {
  try {
    downloadTemplate();
  } catch (error) {
    setWorkspaceStatus(
      error.message || "Unable to download the certificate Excel template.",
      "error"
    );
  }
});
importFileInput.addEventListener("change", () => {
  const selectedFile = importFileInput.files && importFileInput.files[0];

  importExcelFile(selectedFile)
    .catch((error) => {
      setWorkspaceStatus(
        error.message || "Unable to import the certificate Excel file right now.",
        "error"
      );
    })
    .finally(() => {
      importFileInput.value = "";
    });
});
detailsShell.addEventListener("click", (event) => {
  if (event.target === detailsShell) {
    closeDetailsPanel();
  }
});
toggleFormButton.addEventListener("click", () => {
  if (isSessionClosed()) {
    return;
  }

  openCertificatePopup("add");
});
closeFormButton.addEventListener("click", closeFormPanel);
certificateForm.addEventListener("submit", addCertificate);
resetFormButton.addEventListener("click", clearForm);
tableBodyEl.addEventListener("click", (event) => {
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
    openCertificatePopup("edit", recordId);
    return;
  }

  if (action === "delete") {
    if (!window.confirm("Delete this certificate from tracking?")) {
      return;
    }

    removeCertificate(recordId)
      .then(() => {
        selectedFilter = "all";
        searchTerm = "";
        searchInput.value = "";
        closeDetailsPanel();
        renderPortal();
        setWorkspaceStatus("Certificate deleted successfully.", "success");
      })
      .catch((error) => {
        setWorkspaceStatus(
          error.message || "Unable to delete certificate right now.",
          "error"
        );
      });
  }
});
uploadInput.addEventListener("change", () => {
  updateUploadSelection().catch(() => {
    setFormStatus("Unable to read the uploaded certificate file.", "error");
    resetPendingUpload();
  });
});
searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim();
  renderPortal();
});
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data?.type !== "certificate-sync") {
    return;
  }

  refreshPortalAfterPopup(event.data.message).catch(() => {
    setWorkspaceStatus("Certificate list refreshed.", "success");
  });
});
window.addEventListener("storage", (event) => {
  if (event.key !== POPUP_SYNC_KEY || !event.newValue) {
    return;
  }

  try {
    const payload = JSON.parse(event.newValue);

    if (payload?.type !== "certificate-sync") {
      return;
    }

    refreshPortalAfterPopup(payload.message).catch(() => {
      setWorkspaceStatus("Certificate list refreshed.", "success");
    });
  } catch {
    // Ignore malformed sync payloads.
  }
});

setWorkspaceStatus("Connecting to Oracle workspace...");
renderPortal();
resetPendingUpload();
reopenPortalSession();

if (isPopupFormMode) {
  document.body.classList.add("popup-mode");
  setFormMode(popupMode === "edit" ? "edit" : "add");
  openFormPanel();
}

if (homeButton) {
  homeButton.href = MYROTA_HOME_URL;
}

loadCertificatesFromApi().catch(() => {
  certificates = [];
  renderPortal();
  setWorkspaceStatus("Unable to initialize the certificate workspace.", "error");
});

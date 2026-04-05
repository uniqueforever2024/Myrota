const STORAGE_KEY = "certificate_new_records_v1";
const SESSION_KEY = "certificate_new_session_v1";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const workspaceStatusEl = document.getElementById("workspace-status");
const logoutButton = document.getElementById("logout-button");
const logoutOverlay = document.getElementById("logout-overlay");
const reopenButton = document.getElementById("reopen-button");
const homeButton = document.getElementById("home-button");
const manageButton = document.getElementById("manage-button");
const toggleFormButton = document.getElementById("toggle-form-button");
const formPanel = document.getElementById("form-panel");
const closeFormButton = document.getElementById("close-form-button");
const certificateForm = document.getElementById("certificate-form");
const resetFormButton = document.getElementById("reset-form-button");
const uploadInput = document.getElementById("certificate-upload");
const uploadNameEl = document.getElementById("upload-name");
const formStatusEl = document.getElementById("form-status");
const todayDateEl = document.getElementById("today-date");
const detailsTitleEl = document.getElementById("details-title");
const detailsCopyEl = document.getElementById("details-copy");
const detailsCountEl = document.getElementById("details-count");
const detailsShell = document.getElementById("details-shell");
const detailsPanel = document.getElementById("details-panel");
const closeDetailsButton = document.getElementById("close-details-button");
const searchInput = document.getElementById("search-input");
const tableBodyEl = document.getElementById("certificate-table-body");

const count7El = document.getElementById("count-7");
const count30El = document.getElementById("count-30");
const count15El = document.getElementById("count-15");
const countExpiredEl = document.getElementById("count-expired");
const label7El = document.getElementById("label-7");
const label30El = document.getElementById("label-30");
const label15El = document.getElementById("label-15");
const labelExpiredEl = document.getElementById("label-expired");

const windowCards = Array.from(document.querySelectorAll(".window-card"));
const MYROTA_HOME_URL = "/";
const MYROTA_LOGIN_URL = "/?logout=1";

let selectedFilter = "all";
let searchTerm = "";
let certificates = loadCertificates();

function createDateString(offsetDays) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function createSeedCertificates() {
  return [
    {
      id: "seed-alpha",
      partnerName: "Partner Alpha",
      certificateType: "OFTP",
      contactTeam: "EDI Operations",
      issuedDate: createDateString(-320),
      expiryDate: createDateString(27),
      uploadName: "partner-alpha-oftp.cer",
      notes: "Production endpoint certificate"
    },
    {
      id: "seed-beta",
      partnerName: "Partner Beta",
      certificateType: "AS2",
      contactTeam: "B2B Integration Team",
      issuedDate: createDateString(-340),
      expiryDate: createDateString(12),
      uploadName: "partner-beta-as2.pem",
      notes: "Urgent renewal already requested"
    },
    {
      id: "seed-gamma",
      partnerName: "Partner Gamma",
      certificateType: "SSL",
      contactTeam: "Security Team",
      issuedDate: createDateString(-390),
      expiryDate: createDateString(-4),
      uploadName: "partner-gamma-ssl.crt",
      notes: "Expired and pending replacement"
    },
    {
      id: "seed-delta",
      partnerName: "Partner Delta",
      certificateType: "VPN",
      contactTeam: "Network Team",
      issuedDate: createDateString(-210),
      expiryDate: createDateString(5),
      uploadName: "partner-delta-vpn.pfx",
      notes: "Network tunnel certificate"
    },
    {
      id: "seed-epsilon",
      partnerName: "Partner Epsilon",
      certificateType: "SFTP Key Pair",
      contactTeam: "SFTP Admin Team",
      issuedDate: createDateString(-120),
      expiryDate: createDateString(63),
      uploadName: "partner-epsilon-key.pub",
      notes: "Active certificate outside alert windows"
    }
  ];
}

function saveCertificates(records) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function setFormStatus(message, type) {
  formStatusEl.textContent = message || "";
  formStatusEl.classList.remove("success", "error");

  if (type) {
    formStatusEl.classList.add(type);
  }
}

function loadCertificates() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      const seeds = createSeedCertificates();
      saveCertificates(seeds);
      return seeds;
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return createSeedCertificates();
    }

    const onlySeedRecords =
      parsed.length > 0 && parsed.every((record) => String(record?.id || "").startsWith("seed-"));

    return onlySeedRecords ? createSeedCertificates() : parsed;
  } catch (error) {
    return createSeedCertificates();
  }
}

function setSessionOpen(isOpen) {
  window.sessionStorage.setItem(SESSION_KEY, isOpen ? "open" : "closed");
}

function isSessionClosed() {
  return window.sessionStorage.getItem(SESSION_KEY) === "closed";
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
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
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
      active: []
    }
  );
}

function getSelectedRecords() {
  const grouped = getGroupedRecords();

  if (selectedFilter === "expiring30") {
    return {
      title: "Certificates expiring in 16 to 30 days",
      copy: "These certificates are inside the 30 day planning window.",
      records: grouped.expiring30
    };
  }

  if (selectedFilter === "expiring15") {
    return {
      title: "Certificates expiring in 8 to 15 days",
      copy: "These certificates are inside the 15 day window and need follow-up soon.",
      records: grouped.expiring15
    };
  }

  if (selectedFilter === "expired") {
    return {
      title: "Expired certificates",
      copy: "These certificates have already expired and need immediate attention.",
      records: grouped.expired
    };
  }

  if (selectedFilter === "expiring7") {
    return {
      title: "Certificates expiring in less than 7 days",
      copy: "These certificates are very close to expiry and need urgent action.",
      records: grouped.expiring7
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
      ...grouped.active
    ]
  };
}

function renderWindowCounts() {
  const grouped = getGroupedRecords();

  count7El.textContent = String(grouped.expiring7.length);
  count30El.textContent = String(grouped.expiring30.length);
  count15El.textContent = String(grouped.expiring15.length);
  countExpiredEl.textContent = String(grouped.expired.length);

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
    year: "numeric"
  });

  if (!sortedRecords.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">${
            searchTerm
              ? `No certificates found for "${searchTerm}".`
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
          <td>${record.partnerName}</td>
          <td>${record.certificateType}</td>
          <td>${record.contactTeam || "-"}</td>
          <td>${formatDate(record.issuedDate)}</td>
          <td>${formatDate(record.expiryDate)}</td>
          <td>${record.uploadName || "Upload pending"}</td>
          <td>
            <span class="status-chip ${status}">
              ${getStatusLabel(status, daysUntilExpiry)}
            </span>
          </td>
          <td>${record.notes || "-"}</td>
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
  toggleFormButton.textContent = "Hide Form";
}

function closeFormPanel() {
  formPanel.classList.add("hidden");
  toggleFormButton.textContent = "Add Certificate";
}

function updateUploadLabel() {
  const selectedFile = uploadInput.files && uploadInput.files[0];
  uploadNameEl.textContent = selectedFile ? selectedFile.name : "No file selected yet";
}

function clearForm() {
  certificateForm.reset();
  updateUploadLabel();
  setFormStatus("", "");
}

function addCertificate(event) {
  event.preventDefault();

  const formData = new FormData(certificateForm);
  const partnerName = String(formData.get("partnerName") || "").trim();
  const certificateType = String(formData.get("certificateType") || "").trim();
  const contactTeam = String(formData.get("contactTeam") || "").trim();
  const issuedDate = String(formData.get("issuedDate") || "");
  const expiryDate = String(formData.get("expiryDate") || "");
  const notes = String(formData.get("notes") || "").trim();
  const selectedFile = uploadInput.files && uploadInput.files[0];

  if (!partnerName || !certificateType || !contactTeam || !issuedDate || !expiryDate) {
    setFormStatus("Please complete all required certificate fields.", "error");
    return;
  }

  if (new Date(expiryDate).getTime() < new Date(issuedDate).getTime()) {
    setFormStatus("Expiry date must be after the certificate generate date.", "error");
    return;
  }

  certificates = [
    ...certificates,
    {
      id: `cert-${Date.now()}`,
      partnerName,
      certificateType,
      contactTeam,
      issuedDate,
      expiryDate,
      uploadName: selectedFile ? selectedFile.name : "Upload pending",
      notes
    }
  ];

  saveCertificates(certificates);
  selectedFilter = "all";
  searchTerm = "";
  searchInput.value = "";
  clearForm();
  openDetailsPanel();
  renderPortal();
  setFormStatus("Certificate saved successfully.", "success");
}

async function hydrateWorkspaceStatus() {
  if (!workspaceStatusEl) {
    try {
      const response = await fetch("./api/health");
      if (!response.ok) {
        throw new Error("Health check failed");
      }

      const payload = await response.json();
      if (payload.apfHomeUrl && homeButton) {
        homeButton.href = payload.apfHomeUrl;
      }
    } catch (error) {
      return;
    }

    return;
  }

  try {
    const response = await fetch("./api/health");
    if (!response.ok) {
      throw new Error("Health check failed");
    }

    const payload = await response.json();
    workspaceStatusEl.textContent =
      payload.mode === "open-workspace"
        ? "Certificate portal is ready."
        : "Workspace ready.";
    workspaceStatusEl.classList.add("success");

    if (payload.apfHomeUrl && homeButton) {
      homeButton.href = payload.apfHomeUrl;
    }
  } catch (error) {
    workspaceStatusEl.textContent = "Certificate portal is available.";
    workspaceStatusEl.classList.add("warning");
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
detailsShell.addEventListener("click", (event) => {
  if (event.target === detailsShell) {
    closeDetailsPanel();
  }
});
toggleFormButton.addEventListener("click", () => {
  if (isSessionClosed()) {
    return;
  }

  if (formPanel.classList.contains("hidden")) {
    openFormPanel();
  } else {
    closeFormPanel();
  }
});
closeFormButton.addEventListener("click", closeFormPanel);
certificateForm.addEventListener("submit", addCertificate);
resetFormButton.addEventListener("click", clearForm);
uploadInput.addEventListener("change", updateUploadLabel);
searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim();
  renderPortal();
});

hydrateWorkspaceStatus();
renderPortal();
updateUploadLabel();
reopenPortalSession();

if (homeButton) {
  homeButton.href = MYROTA_HOME_URL;
}

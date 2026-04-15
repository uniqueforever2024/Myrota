import * as XLSX from "xlsx";
import { DEFAULT_SECTION, LEGACY_TYPE_MAP, SECTION_ORDER } from "./config";

const DIRECTORY_TARGET_PROTOCOL =
  process.env.REACT_APP_DIRECTORY_TARGET_PROTOCOL || "http";
const DIRECTORY_TARGET_HOST =
  process.env.REACT_APP_DIRECTORY_TARGET_HOST || "frb2bcdu01.groupecat.com";
const DIRECTORY_TARGET_PORT =
  process.env.REACT_APP_DIRECTORY_TARGET_PORT || "8000";

function buildTargetOrigin() {
  const portPart = DIRECTORY_TARGET_PORT ? `:${DIRECTORY_TARGET_PORT}` : "";
  return `${DIRECTORY_TARGET_PROTOCOL}://${DIRECTORY_TARGET_HOST}${portPart}`;
}

function isAbsoluteUrl(value) {
  return /^(https?:)?\/\//i.test(value);
}

function isHostPath(value) {
  return /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?\//i.test(value);
}

export function normalizeLegacyType(type) {
  if (!type) {
    return "";
  }

  const normalized = type.toLowerCase();
  return LEGACY_TYPE_MAP[normalized] || "";
}

export function normalizeEntry(entry) {
  return {
    id: entry.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bu: (entry.bu || "").toLowerCase(),
    type: normalizeLegacyType(entry.type) || entry.type || "",
    label: (entry.label || "").trim(),
    url: (entry.url || "").trim(),
    backup: (entry.backup || "").trim()
  };
}

export function buildDirectoryUrl(url) {
  const trimmedUrl = String(url || "").trim();

  if (!trimmedUrl) {
    return "#";
  }

  if (isAbsoluteUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  if (isHostPath(trimmedUrl)) {
    return `http://${trimmedUrl}`;
  }

  return `${buildTargetOrigin()}/${trimmedUrl.replace(/^\/+/, "")}`;
}

export function isEmailContact(value) {
  return /@/.test(value || "");
}

export function createHashRoute(route) {
  if (route.page === "logout") {
    return `#/logout/${route.lang || "en"}`;
  }

  if (route.page === "home") {
    return `#/home/${route.lang || "en"}`;
  }

  const section = SECTION_ORDER.includes(route.section)
    ? route.section
    : DEFAULT_SECTION;
  const sectionPart = `/${section}`;
  return `#/${route.bu}/${route.lang || "en"}${sectionPart}`;
}

export function parseHashRoute(hash) {
  const cleanHash = (hash || "").replace(/^#\/?/, "");
  const parts = cleanHash.split("/").filter(Boolean);

  if (parts.length === 0 || parts[0] === "home" || parts[0] === "logout") {
    return {
      page: parts[0] === "logout" ? "logout" : "home",
      lang: parts[1] || "en",
      bu: "",
      section: ""
    };
  }

  const parsedSection = parts[2] || "";
  const section = SECTION_ORDER.includes(parsedSection)
    ? parsedSection
    : DEFAULT_SECTION;

  return {
    page: "directory",
    bu: parts[0] || "fr",
    lang: parts[1] || "en",
    section
  };
}

export function getEntriesForSection(entries, bu, type) {
  return entries.filter((entry) => entry.bu === bu && entry.type === type);
}

export function countEntriesBySection(entries, bu) {
  return SECTION_ORDER.reduce((accumulator, type) => {
    accumulator[type] = entries.filter(
      (entry) => entry.bu === bu && entry.type === type
    ).length;
    return accumulator;
  }, {});
}

export function downloadJson(filename, data) {
  downloadFile(
    filename,
    JSON.stringify(data, null, 2),
    "application/json"
  );
}

export function downloadFile(filename, content, type) {
  const blob = new Blob([content], {
    type
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  window.URL.revokeObjectURL(url);
}

const BULK_TEMPLATE_HEADERS = ["id", "bu", "type", "label", "url", "backup"];

function getImportCell(row, key) {
  const matchingKey = Object.keys(row).find(
    (item) => item.trim().toLowerCase() === key.toLowerCase()
  );

  return matchingKey ? row[matchingKey] : "";
}

function buildBulkTemplateRows(defaults = {}) {
  return [
    {
      id: "",
      bu: defaults.bu || "fr",
      type: defaults.type || DEFAULT_SECTION,
      label: "Partner link label",
      url: "/B2BI_archives/example-path",
      backup: "support@example.com"
    }
  ];
}

function escapeCsvCell(value, delimiter) {
  const normalizedValue = String(value ?? "");

  if (
    normalizedValue.includes(delimiter) ||
    normalizedValue.includes('"') ||
    normalizedValue.includes("\n") ||
    normalizedValue.includes("\r")
  ) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

export function buildBulkTemplateCsv(defaults = {}) {
  const delimiter = ";";
  const headers = BULK_TEMPLATE_HEADERS;
  const sampleRow = Object.values(buildBulkTemplateRows(defaults)[0]);

  return [
    headers.join(delimiter),
    sampleRow.map((value) => escapeCsvCell(value, delimiter)).join(delimiter)
  ].join("\r\n");
}

export function buildBulkTemplateWorkbook(defaults = {}) {
  const worksheet = XLSX.utils.json_to_sheet(buildBulkTemplateRows(defaults), {
    header: BULK_TEMPLATE_HEADERS
  });
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "APF Links");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

function detectDelimiter(text) {
  const firstContentLine = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim());

  if (!firstContentLine) {
    return ";";
  }

  const semicolonCount = (firstContentLine.match(/;/g) || []).length;
  const commaCount = (firstContentLine.match(/,/g) || []).length;

  return semicolonCount >= commaCount ? ";" : ",";
}

function parseDelimitedText(text, delimiter) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let index = 0;
  let inQuotes = false;

  while (index < text.length) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 2;
        continue;
      }

      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (!inQuotes && character === delimiter) {
      currentRow.push(currentCell);
      currentCell = "";
      index += 1;
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      index += 1;
      continue;
    }

    currentCell += character;
    index += 1;
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export function parseBulkImportCsv(text) {
  const normalizedText = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(normalizedText);
  const rows = parseDelimitedText(normalizedText, delimiter).filter((row) =>
    row.some((cell) => String(cell || "").trim())
  );

  if (rows.length === 0) {
    return [];
  }

  const headerMap = rows[0].reduce((accumulator, header, index) => {
    accumulator[String(header || "").trim().toLowerCase()] = index;
    return accumulator;
  }, {});

  const pickValue = (cells, key) => {
    const columnIndex = headerMap[key];
    return columnIndex === undefined ? "" : String(cells[columnIndex] || "").trim();
  };

  return rows.slice(1).map((cells) => ({
    id: pickValue(cells, "id"),
    bu: pickValue(cells, "bu"),
    type: pickValue(cells, "type"),
    label: pickValue(cells, "label"),
    url: pickValue(cells, "url"),
    backup: pickValue(cells, "backup")
  }));
}

export async function parseBulkImportFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  return rows.map((row) => ({
    id: String(getImportCell(row, "id") || "").trim(),
    bu: String(getImportCell(row, "bu") || "").trim(),
    type: String(getImportCell(row, "type") || "").trim(),
    label: String(getImportCell(row, "label") || "").trim(),
    url: String(getImportCell(row, "url") || "").trim(),
    backup: String(getImportCell(row, "backup") || "").trim()
  }));
}

export function mergeBulkEntries(existingEntries, importedEntries) {
  const nextEntries = existingEntries.map((entry) => normalizeEntry(entry));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  importedEntries.forEach((entry) => {
    const normalized = normalizeEntry(entry);

    if (!normalized.bu || !normalized.type || !normalized.label || !normalized.url) {
      skipped += 1;
      return;
    }

    const idMatchIndex = normalized.id
      ? nextEntries.findIndex((item) => item.id === normalized.id)
      : -1;

    if (idMatchIndex >= 0) {
      nextEntries[idMatchIndex] = normalizeEntry({
        ...nextEntries[idMatchIndex],
        ...normalized,
        id: nextEntries[idMatchIndex].id
      });
      updated += 1;
      return;
    }

    const fallbackMatchIndex = nextEntries.findIndex(
      (item) =>
        item.bu === normalized.bu &&
        item.type === normalized.type &&
        item.label.trim().toLowerCase() === normalized.label.trim().toLowerCase()
    );

    if (fallbackMatchIndex >= 0) {
      nextEntries[fallbackMatchIndex] = normalizeEntry({
        ...nextEntries[fallbackMatchIndex],
        ...normalized,
        id: nextEntries[fallbackMatchIndex].id
      });
      updated += 1;
      return;
    }

    nextEntries.push(normalized);
    added += 1;
  });

  return {
    entries: nextEntries,
    added,
    updated,
    skipped
  };
}

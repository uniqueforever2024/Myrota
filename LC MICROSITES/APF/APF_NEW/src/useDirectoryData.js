import { useEffect, useMemo, useState } from "react";
import { normalizeEntry } from "./utils";

function resolveApiBase() {
  if (process.env.REACT_APP_DIRECTORY_API) {
    return process.env.REACT_APP_DIRECTORY_API;
  }

  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    if (isLocalHost && window.location.port === "3000") {
      return "http://localhost:3001/api";
    }
  }

  return "/api";
}

const API_BASE = resolveApiBase();
const API_URL = `${API_BASE}/directory-data`;

function readApiError(response, payload, fallbackMessage) {
  const payloadMessage =
    (typeof payload?.error === "string" && payload.error.trim()) ||
    (typeof payload?.message === "string" && payload.message.trim());

  if (payloadMessage) {
    return payloadMessage;
  }

  if (response?.status) {
    return `${fallbackMessage} (status ${response.status})`;
  }

  return fallbackMessage;
}

export default function useDirectoryData() {
  const [seedEntries, setSeedEntries] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const parseEntries = (dataFile) =>
      Array.isArray(dataFile.entries)
        ? dataFile.entries.map(normalizeEntry)
        : [];

    const loadEntries = async () => {
      try {
        const response = await fetch(API_URL, { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json") ? await response.json() : null;

        if (!response.ok) {
          throw new Error(readApiError(response, payload, "Directory API request failed."));
        }

        if (!active) {
          return;
        }

        const parsedSeed = parseEntries(payload || {});
        setSeedEntries(parsedSeed);
        setEntries(parsedSeed);
        setError("");
        setLoaded(true);
      } catch (error) {
        if (!active) {
          return;
        }

        setSeedEntries([]);
        setEntries([]);
        setError(error?.message || "Oracle directory data is not available right now.");
        setLoaded(true);
      }
    };

    loadEntries();

    return () => {
      active = false;
    };
  }, []);

  const persistEntries = async (nextEntries) => {
    const normalizedEntries = nextEntries.map(normalizeEntry);
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        entries: normalizedEntries
      })
    });
    const contentType = response.headers.get("content-type") || "";
    const savedPayload = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
      throw new Error(readApiError(response, savedPayload, "Save failed."));
    }

    const savedEntries = Array.isArray(savedPayload.entries)
      ? savedPayload.entries.map(normalizeEntry)
      : [];

    setSeedEntries(savedEntries);
    setEntries(savedEntries);
    setError("");
  };

  const actions = useMemo(
    () => ({
      async addEntry(entry) {
        await persistEntries([...entries, normalizeEntry(entry)]);
      },
      async updateEntry(id, updates) {
        const nextEntries = entries.map((entry) =>
          entry.id === id ? normalizeEntry({ ...entry, ...updates }) : entry
        );
        await persistEntries(nextEntries);
      },
      async removeEntry(id) {
        await persistEntries(entries.filter((entry) => entry.id !== id));
      },
      async importEntries(importedEntries) {
        await persistEntries(importedEntries.map(normalizeEntry));
      },
      async resetToSeed() {
        await persistEntries(seedEntries);
      }
    }),
    [entries, seedEntries]
  );

  return {
    seedEntries,
    entries,
    loaded,
    error,
    actions
  };
}

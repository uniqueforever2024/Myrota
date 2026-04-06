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

export default function useDirectoryData() {
  const [seedEntries, setSeedEntries] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const parseEntries = (dataFile) =>
      Array.isArray(dataFile.entries)
        ? dataFile.entries.map(normalizeEntry)
        : [];

    const loadEntries = async () => {
      try {
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`Directory API failed with status ${response.status}`);
        }

        const dataFile = await response.json();

        if (!active) {
          return;
        }

        const parsedSeed = parseEntries(dataFile);
        setSeedEntries(parsedSeed);
        setEntries(parsedSeed);
        setLoaded(true);
      } catch (error) {
        if (!active) {
          return;
        }

        setSeedEntries([]);
        setEntries([]);
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

    if (!response.ok) {
      throw new Error("Save failed");
    }

    const savedPayload = await response.json();
    const savedEntries = Array.isArray(savedPayload.entries)
      ? savedPayload.entries.map(normalizeEntry)
      : [];

    setSeedEntries(savedEntries);
    setEntries(savedEntries);
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
    actions
  };
}

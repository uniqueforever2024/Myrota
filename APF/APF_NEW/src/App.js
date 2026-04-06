import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SECTION } from "./config";
import {
  parseHashRoute,
  createHashRoute,
  getEntriesForSection,
  buildBulkTemplateWorkbook,
  downloadFile,
  parseBulkImportFile,
  mergeBulkEntries
} from "./utils";
import { getText } from "./text";
import useDirectoryData from "./useDirectoryData";
import AuthScreen from "./components/AuthScreen";
import DashboardShell from "./components/DashboardShell";
import DirectoryManagerModal from "./components/DirectoryManagerModal";

const AUTH_STORAGE_KEY = "apf_new_auth_session_v1";
const MYROTA_HOME_URL = "/";
const MYROTA_LOGIN_URL = "/?logout=1";
const DEFAULT_CREDENTIALS = {
  admin: { username: "admin", password: "admin123" }
};

function readStoredSession() {
  try {
    const rawValue = window.sessionStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue?.role && parsedValue?.username ? parsedValue : null;
  } catch (error) {
    return null;
  }
}

function App() {
  const [route, setRoute] = useState(() => parseHashRoute(window.location.hash));
  const [session, setSession] = useState(() => readStoredSession());
  const [loginMode, setLoginMode] = useState("client");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerError, setManagerError] = useState("");
  const [managerNotice, setManagerNotice] = useState("");
  const [managerSaving, setManagerSaving] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [managerFilters, setManagerFilters] = useState({
    bu: route.bu || "fr",
    type: route.section || DEFAULT_SECTION
  });
  const [formState, setFormState] = useState({
    id: "",
    bu: route.bu || "fr",
    type: route.section || DEFAULT_SECTION,
    label: "",
    url: "",
    backup: ""
  });

  const { entries, loaded, error: directoryError, actions } = useDirectoryData();
  const text = getText(route.lang);
  const canManage = Boolean(session);
  const currentBu = route.bu || "fr";
  const currentSection = route.page === "directory" ? route.section || DEFAULT_SECTION : "";

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHashRoute(window.location.hash));

    if (!window.location.hash) {
      window.location.hash = "#/home/en";
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setManagerFilters((previous) => ({
      ...previous,
      bu: route.bu || previous.bu,
      type: route.section || previous.type
    }));

    setFormState((previous) => ({
      ...previous,
      bu: route.bu || previous.bu,
      type: route.section || previous.type
    }));
  }, [route.bu, route.section]);

  useEffect(() => {
    if (!formState.id) {
      setFormState((previous) => ({
        ...previous,
        bu: managerFilters.bu,
        type: managerFilters.type
      }));
    }
  }, [formState.id, managerFilters.bu, managerFilters.type]);

  useEffect(() => {
    if (!canManage && managerOpen) {
      setManagerOpen(false);
    }
  }, [canManage, managerOpen]);

  const visibleEntries = useMemo(() => {
    const selectedEntries = currentSection
      ? getEntriesForSection(entries, currentBu, currentSection)
      : [];

    if (!searchValue.trim()) {
      return selectedEntries;
    }

    const term = searchValue.toLowerCase();
    return selectedEntries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(term) ||
        entry.url.toLowerCase().includes(term) ||
        entry.backup.toLowerCase().includes(term)
    );
  }, [currentBu, currentSection, entries, searchValue]);

  const navigate = (nextRoute) => {
    window.location.hash = createHashRoute(nextRoute);
  };

  const redirectToMyRotaLogin = () => {
    try {
      window.sessionStorage.removeItem("myrota.portal.login.v1");
    } catch (error) {
      // Ignore storage errors and still redirect.
    }

    window.location.assign(MYROTA_LOGIN_URL);
  };

  const goToMyRotaHome = () => {
    window.location.assign(MYROTA_HOME_URL);
  };

  const clearSessionState = () => {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
    setManagerOpen(false);
    setSearchValue("");
    setLoginMode("client");
    setLoginForm({ username: "", password: "" });
    setLoginError("");
    setManagerError("");
    setManagerNotice("");
  };

  const switchLoginMode = (nextMode) => {
    setLoginMode(nextMode);
    setLoginError("");
    setLoginForm({ username: "", password: "" });
  };

  const handleLogin = (event) => {
    event.preventDefault();

    if (loginMode === "client") {
      const nextSession = { role: "client", username: "client" };
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setLoginError("");
      setLoginForm({ username: "", password: "" });
      return;
    }

    const expectedCredentials = DEFAULT_CREDENTIALS.admin;
    const normalizedUsername = loginForm.username.trim().toLowerCase();

    if (
      normalizedUsername !== expectedCredentials.username ||
      loginForm.password !== expectedCredentials.password
    ) {
      setLoginError(text.loginErrorAdmin || "Admin access details are not correct.");
      return;
    }

    const nextSession = { role: loginMode, username: normalizedUsername };
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setLoginError("");
    setLoginForm({ username: "", password: "" });
  };

  const logout = () => {
    clearSessionState();
    redirectToMyRotaLogin();
  };

  useEffect(() => {
    if (route.page !== "logout") {
      return;
    }

    clearSessionState();
    redirectToMyRotaLogin();
  }, [route.page, route.lang]);

  const openManagerForCurrentContext = () => {
    if (!canManage) {
      return;
    }

    setManagerFilters({
      bu: route.bu || "fr",
      type: route.section || DEFAULT_SECTION
    });
    setFormState({
      id: "",
      bu: route.bu || "fr",
      type: route.section || DEFAULT_SECTION,
      label: "",
      url: "",
      backup: ""
    });
    setManagerError("");
    setManagerNotice("");
    setManagerOpen(true);
  };

  const submitEntry = async (event) => {
    event.preventDefault();

    if (!canManage || !formState.label.trim() || !formState.url.trim()) {
      return;
    }

    const payload = { ...formState };
    setManagerSaving(true);
    setManagerError("");
    setManagerNotice("");

    try {
      if (formState.id) {
        await actions.updateEntry(formState.id, payload);
      } else {
        await actions.addEntry(payload);
      }

      setFormState((previous) => ({
        ...previous,
        id: "",
        label: "",
        url: "",
        backup: ""
      }));
      setManagerOpen(false);
    } catch (error) {
      setManagerError(
        text.savePartnerError ||
          "Unable to save the partner right now. Please make sure the Oracle save service is running."
      );
    } finally {
      setManagerSaving(false);
    }
  };

  const removeEntryAndClose = async (id) => {
    if (!canManage) {
      return;
    }

    setManagerSaving(true);
    setManagerError("");
    setManagerNotice("");

    try {
      await actions.removeEntry(id);
      setManagerOpen(false);
    } catch (error) {
      setManagerError(
        text.removePartnerError ||
          "Unable to remove the partner right now. Please make sure the Oracle save service is running."
      );
    } finally {
      setManagerSaving(false);
    }
  };

  const editEntry = (entry) => {
    if (!canManage) {
      return;
    }

    setManagerFilters({ bu: entry.bu, type: entry.type });
    setFormState(entry);
    setManagerError("");
    setManagerNotice("");
    setManagerOpen(true);
  };

  const downloadBulkTemplate = () => {
    const workbookBuffer = buildBulkTemplateWorkbook({
      bu: formState.bu || route.bu || "fr",
      type: formState.type || route.section || DEFAULT_SECTION
    });

    downloadFile(
      `partner-bulk-template-${formState.bu || "fr"}-${formState.type || DEFAULT_SECTION}.xlsx`,
      workbookBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    setManagerNotice(
      text.bulkTemplateReady || "Excel template downloaded."
    );
    setManagerError("");
  };

  const importBulkFile = async (file) => {
    if (!canManage || !file) {
      return;
    }

    setManagerSaving(true);
    setManagerError("");
    setManagerNotice("");

    try {
      const importedEntries = await parseBulkImportFile(file);
      const mergedResult = mergeBulkEntries(entries, importedEntries);

      if (mergedResult.added === 0 && mergedResult.updated === 0) {
        setManagerError(
          text.bulkImportEmpty ||
            "No valid bulk rows were found. Please use the downloaded template."
        );
        return;
      }

      await actions.importEntries(mergedResult.entries);
      setFormState((previous) => ({
        ...previous,
        id: "",
        label: "",
        url: "",
        backup: ""
      }));

      const successTemplate =
        text.bulkImportSuccess ||
        "Bulk import completed: {added} added, {updated} updated.";

      setManagerNotice(
        successTemplate
          .replace("{added}", String(mergedResult.added))
          .replace("{updated}", String(mergedResult.updated))
      );
    } catch (error) {
      setManagerError(
        text.bulkImportError ||
          "Unable to import the bulk file right now. Please check the Excel template and try again."
      );
    } finally {
      setManagerSaving(false);
    }
  };

  if (!loaded) {
    return <div className="loading-screen">{text.loadingDirectories || "Loading directories..."}</div>;
  }

  if (!session) {
    return (
      <AuthScreen
        route={route}
        navigate={navigate}
        goToMyRotaHome={goToMyRotaHome}
        loginMode={loginMode}
        switchLoginMode={switchLoginMode}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        loginError={loginError}
        handleLogin={handleLogin}
        text={text}
      />
    );
  }

  return (
    <>
      <DashboardShell
        route={route}
        text={text}
        navigate={navigate}
        canManage={canManage}
        entries={entries}
        visibleEntries={visibleEntries}
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        currentBu={currentBu}
        currentSection={currentSection}
        openManagerForCurrentContext={openManagerForCurrentContext}
        downloadBulkTemplate={downloadBulkTemplate}
        importBulkFile={importBulkFile}
        directoryError={directoryError}
        managerNotice={managerNotice}
        managerError={managerError}
        managerSaving={managerSaving}
        editEntry={editEntry}
        goToMyRotaHome={goToMyRotaHome}
        logout={logout}
      />
      {managerOpen && canManage ? (
        <DirectoryManagerModal
          text={text}
          formState={formState}
          setFormState={setFormState}
          submitEntry={submitEntry}
          downloadBulkTemplate={downloadBulkTemplate}
          importBulkFile={importBulkFile}
          removeEntry={removeEntryAndClose}
          managerError={managerError}
          managerNotice={managerNotice}
          managerSaving={managerSaving}
          setManagerOpen={setManagerOpen}
        />
      ) : null}
    </>
  );
}

export default App;

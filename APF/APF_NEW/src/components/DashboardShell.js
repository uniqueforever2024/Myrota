import {
  BU_OPTIONS,
  LANGUAGES,
  MAP_LINKS,
  SECTION_META,
  SECTION_ORDER
} from "../config";
import { buildDirectoryUrl, isEmailContact } from "../utils";

function DashboardShell({
  route,
  text,
  navigate,
  canManage,
  entries,
  visibleEntries,
  searchValue,
  setSearchValue,
  currentBu,
  currentSection,
  openManagerForCurrentContext,
  downloadBulkTemplate,
  importBulkFile,
  managerNotice,
  managerError,
  managerSaving,
  editEntry,
  goToMyRotaHome,
  logout
}) {
  const t = (key, fallback) => text[key] || fallback;
  const currentBuMeta = BU_OPTIONS.find((bu) => bu.id === currentBu);
  const currentSectionMeta = SECTION_META[currentSection] || SECTION_META[SECTION_ORDER[0]];
  const buSectionCounts = BU_OPTIONS.reduce((accumulator, bu) => {
    accumulator[bu.id] = entries.filter(
      (entry) => entry.bu === bu.id && entry.type === currentSection
    ).length;
    return accumulator;
  }, {});

  return (
    <div className="app-shell authenticated-shell">
      <header className="app-header">
        <div className="brand-block">
          <h1>{t("appHeaderTitle", "ACCESS TO PRODUCTION FILES")}</h1>
        </div>

        <div className="header-actions">
          <button
            className="header-icon-button"
            type="button"
            onClick={goToMyRotaHome}
            aria-label={t("myRotaDashboard", "MyRota dashboard")}
            title={t("myRotaDashboard", "MyRota dashboard")}
          >
            <HeaderActionIcon type="home" />
          </button>
          {canManage ? (
            <div className="admin-shortcuts">
              <button
                className="header-icon-button"
                type="button"
                onClick={openManagerForCurrentContext}
                disabled={managerSaving}
                aria-label={t("openManager", "Add New Partner")}
                title={t("openManager", "Add New Partner")}
              >
                <HeaderActionIcon type="add" />
              </button>
              <button
                className="header-icon-button"
                type="button"
                onClick={downloadBulkTemplate}
                disabled={managerSaving}
                aria-label={t("downloadTemplate", "Download Excel template")}
                title={t("downloadTemplate", "Download Excel template")}
              >
                <HeaderActionIcon type="download" />
              </button>
              <label
                className={`header-icon-button header-file-button ${
                  managerSaving ? "is-disabled" : ""
                }`}
                aria-label={t("importBulk", "Import bulk")}
                title={t("importBulk", "Import bulk")}
              >
                <HeaderActionIcon type="upload" />
                <span className="sr-only">{t("importBulk", "Import bulk")}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={managerSaving}
                  onChange={(event) => {
                    const [file] = Array.from(event.target.files || []);

                    if (file) {
                      importBulkFile(file);
                    }

                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : null}
          <button
            className="header-icon-button"
            type="button"
            onClick={logout}
            aria-label={t("logout", "Logout")}
            title={t("logout", "Logout")}
          >
            <HeaderActionIcon type="logout" />
          </button>
        </div>
      </header>

      <nav className="top-nav">
        <div className="top-nav-links">
          {SECTION_ORDER.map((sectionId) => (
            <button
              key={sectionId}
              className={`tab ${
                route.page === "directory" && currentSection === sectionId ? "active" : ""
              }`}
              onClick={() =>
                navigate({
                  page: "directory",
                  bu: currentBu,
                  lang: route.lang,
                  section: sectionId
                })
              }
            >
              {t(
                SECTION_META[sectionId].navLabelKey,
                SECTION_META[sectionId].navFallback
              )}
            </button>
          ))}
        </div>

        <div className="top-nav-languages">
          {LANGUAGES.map((language) => (
            <button
              key={language.id}
              className={`lang-pill ${route.lang === language.id ? "active" : ""}`}
              onClick={() =>
                navigate({
                  page: route.page,
                  bu: route.bu,
                  lang: language.id,
                  section: route.section
                })
              }
            >
              {language.label}
            </button>
          ))}
        </div>
      </nav>

      {managerNotice ? <div className="page-status manager-notice">{managerNotice}</div> : null}
      {managerError ? <div className="page-status manager-error">{managerError}</div> : null}

      {route.page === "home" ? (
        <main className={`home-view ${canManage ? "home-view-admin" : "home-view-client"}`}>
          <section className="home-map-panel">
            <div className="hero-map home-map-large">
              <div className="map-stage">
                <img
                  src={`${process.env.PUBLIC_URL || ""}/Europe2.png`}
                  alt="Europe map"
                />
                {MAP_LINKS.map((point) => {
                  const bu = BU_OPTIONS.find((item) => item.id === point.id);

                  return (
                    <button
                      key={point.id}
                      className="map-point"
                      style={{ top: point.top, left: point.left }}
                      onClick={() =>
                        navigate({
                          page: "directory",
                          bu: point.id,
                          lang: route.lang,
                          section: currentSection || SECTION_ORDER[0]
                        })
                      }
                    >
                      {bu ? bu.label : point.id.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {canManage ? (
            <section className="quick-access-card admin-launchpad">
              <div className="section-header">
                <h3>{t("quickAccess", "Quick access")}</h3>
                <span>{BU_OPTIONS.length}</span>
              </div>

              <div className="launcher-grid">
                {BU_OPTIONS.map((bu) => {
                  const buCount = entries.filter((entry) => entry.bu === bu.id).length;
                  return (
                    <button
                      key={bu.id}
                      className="launcher-card"
                      onClick={() =>
                        navigate({
                          page: "directory",
                          bu: bu.id,
                          lang: route.lang,
                          section: currentSection || SECTION_ORDER[0]
                        })
                      }
                    >
                      <span className="launcher-tag">{bu.label}</span>
                      <strong>{bu.name}</strong>
                      <span className="launcher-meta">{buCount}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="quick-access-card support-panel">
            <div className="support-panel-copy">
              <h3>{t("supportTitle", "Need support?")}</h3>
              <p>
                {t(
                  "supportMessage",
                  "If the site is not working as expected, contact the support team directly."
                )}
              </p>
            </div>

            <a
              className="primary-button support-button"
              href="mailto:HCL-EDI-TEAM@hcltech.com?subject=EDI%20LC%20APF%20Support"
            >
              {t("supportButton", "Email support")}
            </a>
          </section>

        </main>
      ) : (
        <main className="directory-layout">
          <aside className="sidebar">
            <div className="sidebar-block">
              <div className="sidebar-copy">
                <div className="eyebrow">
                  {t(currentSectionMeta.navLabelKey, currentSectionMeta.navFallback)}
                </div>
                <h3>{t("businessUnits", "Business units")}</h3>
                <p className="sidebar-description">
                  {t(currentSectionMeta.labelKey, currentSectionMeta.labelKey)}
                </p>
              </div>

              <div className="sidebar-bu-list">
                {BU_OPTIONS.map((bu) => (
                  <button
                    key={bu.id}
                    className={`sidebar-link ${currentBu === bu.id ? "active" : ""}`}
                    onClick={() =>
                      navigate({
                        page: "directory",
                        bu: bu.id,
                        lang: route.lang,
                        section: currentSection
                      })
                    }
                  >
                    <span>{bu.label}</span>
                    <span className="count-badge">{buSectionCounts[bu.id] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="content-panel">
            <div className="content-toolbar">
              <div>
                <div className="eyebrow">{currentBuMeta?.label || currentBu.toUpperCase()}</div>
                <h2>{t(currentSectionMeta.navLabelKey, currentSectionMeta.navFallback)}</h2>
                <p className="content-subtitle">
                  {t(currentSectionMeta.labelKey, currentSectionMeta.labelKey)}
                </p>
              </div>

              <div className="search-box">
                <input
                  type="search"
                  value={searchValue}
                  placeholder={t("searchPlaceholder", "Search current entries")}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
                {canManage ? (
                  <div className="content-actions">
                    <button className="secondary-button" onClick={openManagerForCurrentContext}>
                      {t("openManager", "Add New Partner")}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={managerSaving}
                      onClick={downloadBulkTemplate}
                    >
                      {t("downloadTemplate", "Download Excel template")}
                    </button>
                    <label
                      className={`secondary-button import-button toolbar-import-button ${
                        managerSaving ? "is-disabled" : ""
                      }`}
                    >
                      {t("importBulk", "Import Excel")}
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        disabled={managerSaving}
                        onChange={(event) => {
                          const [file] = Array.from(event.target.files || []);

                          if (file) {
                            importBulkFile(file);
                          }

                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            </div>

            <DirectoryResults
              canManage={canManage}
              currentSection={currentSection}
              visibleEntries={visibleEntries}
              editEntry={editEntry}
              t={t}
            />
          </section>
        </main>
      )}
    </div>
  );
}

function DirectoryResults({ canManage, currentSection, visibleEntries, editEntry, t }) {
  if (visibleEntries.length === 0) {
    return (
      <div className="empty-state">
        <p>{t("noEntries", "No entries are available in this section yet.")}</p>
        <span>
          {canManage
            ? t("emptyHint", "Use the manager to add the first link.")
            : t("noLinkAvailable", "No link is available here yet.")}
        </span>
      </div>
    );
  }

  if (SECTION_META[currentSection].showsBackup) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("directoryLink", "Link")}</th>
              <th>{t("supportColumn", "Emergency contact")}</th>
              {canManage ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <a href={buildDirectoryUrl(entry.url)} target="_blank" rel="noreferrer">
                    {entry.label}
                  </a>
                </td>
                <td>
                  {isEmailContact(entry.backup) ? (
                    <a href={`mailto:${entry.backup}`}>{entry.backup}</a>
                  ) : (
                    entry.backup || "-"
                  )}
                </td>
                {canManage ? (
                  <td className="action-cell">
                    <button className="inline-button" onClick={() => editEntry(entry)}>
                      {t("editEntry", "Edit")}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="directory-list">
      {visibleEntries.map((entry) => (
        <article className="directory-item" key={entry.id}>
          <div>
            <h3>{entry.label}</h3>
            <p>{buildDirectoryUrl(entry.url)}</p>
          </div>
          <div className="directory-actions">
            <a
              className="primary-button"
              href={buildDirectoryUrl(entry.url)}
              target="_blank"
              rel="noreferrer"
            >
              {t("openDirectory", "Open link")}
            </a>
            {canManage ? (
              <button className="inline-button" onClick={() => editEntry(entry)}>
                {t("editEntry", "Edit")}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function HeaderActionIcon({ type }) {
  if (type === "add") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 5.5v13M5.5 12h13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "download") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 5.5v9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M8.5 11.5 12 15l3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 18.5h12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "upload") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 18.5v-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M15.5 11.5 12 8l-3.5 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 18.5h12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "documentation") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 5.5h8.5L18 9v9.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.5 5.5V9H18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 12h6M9 15h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "sftp") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 8.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 8.5V7a2.5 2.5 0 0 1 5 0v1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10 13h4M12 11v4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "logout") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M10 5.5H7.5A1.5 1.5 0 0 0 6 7v10a1.5 1.5 0 0 0 1.5 1.5H10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 8.5l4 3.5-4 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 12h8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4.5 10.5 12 4l7.5 6.5V19a1 1 0 0 1-1 1H14v-5h-4v5H5.5a1 1 0 0 1-1-1z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5l6 2.4v4.2c0 4-2.3 6.9-6 8.4-3.7-1.5-6-4.4-6-8.4V6.9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12.5l1.7 1.7 3.8-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default DashboardShell;

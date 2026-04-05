import {
  BU_OPTIONS,
  LANGUAGES,
  MAP_LINKS,
  SECTION_META,
  SECTION_ORDER,
  SIDEBAR_GROUPS
} from "../config";
import { buildDirectoryUrl, isEmailContact } from "../utils";

function DashboardShell({
  route,
  text,
  navigate,
  canManage,
  entries,
  sectionCounts,
  visibleEntries,
  searchValue,
  setSearchValue,
  currentBu,
  currentSection,
  openManagerForCurrentContext,
  editEntry,
  managerOpen,
  setManagerOpen,
  goToMyRotaHome,
  logout
}) {
  const t = (key, fallback) => text[key] || fallback;
  const currentBuMeta = BU_OPTIONS.find((bu) => bu.id === currentBu);
  const projectBase = process.env.REACT_APP_DIRECTORY_API || "http://localhost:3001";
  const certificateAppUrl =
    process.env.REACT_APP_CERTIFICATE_APP_URL || "http://localhost:3003";
  const adminProjectLinks = [
    {
      id: "documentation",
      label: t("documentation", "Documentation"),
      href: `${projectBase}/apps/documentation/`
    },
    {
      id: "sftp",
      label: t("sftp", "SFTP"),
      href: `${projectBase}/apps/sftp/`
    },
    {
      id: "certificate",
      label: t("certificate", "Certificate"),
      href: certificateAppUrl
    }
  ];

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
              {adminProjectLinks.map((link) => (
                <a
                  key={link.id}
                  className="admin-shortcut-link"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={link.label}
                  title={link.label}
                >
                  <span className="admin-shortcut-icon">
                    <HeaderActionIcon type={link.id} />
                  </span>
                </a>
              ))}
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
          <button
            className={`tab ${route.page === "home" ? "active" : ""}`}
            onClick={() => navigate({ page: "home", lang: route.lang })}
          >
            {t("home", "Home")}
          </button>

          {BU_OPTIONS.map((bu) => (
            <button
              key={bu.id}
              className={`tab ${route.bu === bu.id ? "active" : ""}`}
              onClick={() =>
                navigate({
                  page: "directory",
                  bu: bu.id,
                  lang: route.lang,
                  section: route.section
                })
              }
            >
              {bu.label}
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
                        navigate({ page: "directory", bu: point.id, lang: route.lang })
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
                        navigate({ page: "directory", bu: bu.id, lang: route.lang })
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
              href="mailto:HCL-EDI_TEAM@gmail.com?subject=EDI%20LC%20APF%20Support"
            >
              {t("supportButton", "Email support")}
            </a>
          </section>

        </main>
      ) : (
        <main className="directory-layout">
          <aside className="sidebar">
            {SIDEBAR_GROUPS.map((group) => (
              <div className="sidebar-block" key={group.titleKey}>
                {group.type === "single" ? (
                  <button
                    className={`sidebar-link ${currentSection === group.item ? "active" : ""}`}
                    onClick={() =>
                      navigate({
                        page: "directory",
                        bu: currentBu,
                        lang: route.lang,
                        section: group.item
                      })
                    }
                  >
                    <span>{t(group.titleKey, group.titleKey)}</span>
                    <span className="count-badge">{sectionCounts[group.item] || 0}</span>
                  </button>
                ) : (
                  <>
                    <h3>{t(group.titleKey, group.titleKey)}</h3>
                    {(group.sections || []).map((sectionGroup) => (
                      <div className="sidebar-subgroup" key={sectionGroup.headingKey}>
                        <h4>{t(sectionGroup.headingKey, sectionGroup.headingKey)}</h4>
                        {sectionGroup.items.map((item) => (
                          <button
                            key={item}
                            className={`sidebar-link ${currentSection === item ? "active" : ""}`}
                            onClick={() =>
                              navigate({
                                page: "directory",
                                bu: currentBu,
                                lang: route.lang,
                                section: item
                              })
                            }
                          >
                            <span>{t(SECTION_META[item].labelKey, SECTION_META[item].labelKey)}</span>
                            <span className="count-badge">{sectionCounts[item] || 0}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {(group.items || []).map((item) => (
                      <button
                        key={item}
                        className={`sidebar-link ${currentSection === item ? "active" : ""}`}
                        onClick={() =>
                          navigate({
                            page: "directory",
                            bu: currentBu,
                            lang: route.lang,
                            section: item
                          })
                        }
                      >
                        <span>{t(SECTION_META[item].labelKey, SECTION_META[item].labelKey)}</span>
                        <span className="count-badge">{sectionCounts[item] || 0}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            ))}
          </aside>

          <section className="content-panel">
            <div className="content-toolbar">
              <div>
                <div className="eyebrow">{currentBuMeta?.label || currentBu.toUpperCase()}</div>
                <h2>
                  {currentSection
                    ? t(SECTION_META[currentSection].labelKey, SECTION_META[currentSection].labelKey)
                    : t("welcomeTitle", "Business Unit Overview")}
                </h2>
              </div>

              {currentSection ? (
                <div className="search-box">
                  <input
                    type="search"
                    value={searchValue}
                    placeholder={t("searchPlaceholder", "Search current entries")}
                    onChange={(event) => setSearchValue(event.target.value)}
                  />
                  {canManage ? (
                    <button className="secondary-button" onClick={openManagerForCurrentContext}>
                      {t("openManager", "Add New Partner")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!currentSection ? (
              <div className="welcome-card">
                <div className="section-list">
                  {SECTION_ORDER.map((item) => (
                    <button
                      key={item}
                      className="list-row"
                      onClick={() =>
                        navigate({
                          page: "directory",
                          bu: currentBu,
                          lang: route.lang,
                          section: item
                        })
                      }
                    >
                      <span>{t(SECTION_META[item].labelKey, SECTION_META[item].labelKey)}</span>
                      <strong className="list-row-meta">{sectionCounts[item] || 0}</strong>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <DirectoryResults
                canManage={canManage}
                currentSection={currentSection}
                visibleEntries={visibleEntries}
                editEntry={editEntry}
                t={t}
              />
            )}
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

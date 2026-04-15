import { LANGUAGES } from "../config";

function AuthScreen({
  route,
  navigate,
  goToMyRotaHome,
  loginMode,
  switchLoginMode,
  loginForm,
  setLoginForm,
  loginError,
  handleLogin,
  text
}) {
  const t = (key, fallback) => text[key] || fallback;
  const imageBase = process.env.PUBLIC_URL || "";
  const isAdmin = loginMode === "admin";
  const versionLabel = t("loginVersion", "version 2.2");

  return (
    <div className="app-shell login-shell">
      <main className="login-screen">
        <div className="login-language-switcher login-language-floating">
          <button
            type="button"
            className="lang-pill"
            onClick={goToMyRotaHome}
            title="Return to MyRota dashboard"
          >
            MyRota
          </button>
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

        <section className="login-center">
          <div className={`login-portal ${isAdmin ? "admin" : ""}`}>
            <div className="login-portal-left">
              <a
                className="login-corner-brand"
                href="https://www.groupecat.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="Open Groupe CAT website"
                title="Open Groupe CAT website"
              >
                <img src={`${imageBase}/groupecatlogo.png`} alt="Group CAT logo" />
              </a>

              <div className="login-copy">
                <h1>{t("loginAccessTitle", "Access to Production file")}</h1>
                <button
                  type="button"
                  className={`login-copy-version-button ${isAdmin ? "active" : ""}`}
                  onClick={() => switchLoginMode(isAdmin ? "client" : "admin")}
                  title={isAdmin ? "Back to client login" : "Open admin login"}
                >
                  <span className="login-copy-version">{versionLabel}</span>
                </button>
              </div>
            </div>

            <a
              className="login-bottom-arc login-powered-link"
              href="https://www.hcltech.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Open HCLTech website"
              title="Open HCLTech website"
            >
              <span className="login-admin-copy">
                {t("poweredManagedBy", "powered and managed by")}
              </span>
              <img src={`${imageBase}/hcltechlogo.png`} alt="HCLTech logo" />
            </a>

            <div className={`login-panel ${isAdmin ? "admin-mode" : "client-mode"}`}>
              {isAdmin ? (
                <form className="login-form admin-form" onSubmit={handleLogin}>
                  <label className="login-field">
                    <span>{t("userId", "UserId")}</span>
                    <input
                      type="text"
                      autoComplete="username"
                      placeholder={t("userIdPlaceholder", "Enter your UserId")}
                      value={loginForm.username}
                      onChange={(event) =>
                        setLoginForm((previous) => ({
                          ...previous,
                          username: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="login-field">
                    <span>{t("passwordLabel", "Password")}</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder={t("passwordPlaceholder", "Enter your password")}
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((previous) => ({
                          ...previous,
                          password: event.target.value
                        }))
                      }
                    />
                  </label>

                  {loginError ? <div className="login-error">{loginError}</div> : null}

                  <button className="primary-button login-submit" type="submit">
                    {t("signIn", "Sign in")}
                  </button>
                </form>
              ) : (
                <form className="login-form client-form" onSubmit={handleLogin}>
                  <div className="client-login-box">
                    <span className="client-login-title">
                      {t("clientWelcomeBack", "Welcome Back")}
                    </span>
                    <button className="primary-button login-submit" type="submit">
                      {t("signIn", "Sign in")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AuthScreen;

const REQUIRED_CONFIG_KEYS = ["JIRA_BASE_URL", "JIRA_USERNAME", "JIRA_PASSWORD"];

const isTruthy = (value) => /^(1|true|yes|on)$/i.test(String(value || "").trim());

const normalizeBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
};

const buildConfigFromSource = (source = {}) => ({
  baseUrl: normalizeBaseUrl(source.JIRA_BASE_URL),
  username: String(source.JIRA_USERNAME || "").trim(),
  password: String(source.JIRA_PASSWORD || "").trim(),
});

const getMissingConfigKeys = (config = buildConfigFromSource(process.env)) => {
  const missing = [];
  if (!config.baseUrl) missing.push("JIRA_BASE_URL");
  if (!config.username) missing.push("JIRA_USERNAME");
  if (!config.password) missing.push("JIRA_PASSWORD");
  return missing;
};

const shouldUseMockData = () => isTruthy(process.env.JIRA_DASHBOARD_USE_MOCK);

const getJiraConfig = () => {
  const config = buildConfigFromSource(process.env);
  const missingKeys = getMissingConfigKeys(config);

  if (missingKeys.length > 0) {
    const error = new Error(
      `Missing Netlify Jira environment variables: ${missingKeys.join(", ")}`
    );
    error.code = "jira/config-missing";
    throw error;
  }

  return config;
};

const buildAuthHeader = ({ username, password }) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

const parseErrorBody = async (response) => {
  try {
    const data = await response.json();
    if (typeof data === "string") return data;
    if (data?.errorMessages?.length) return data.errorMessages.join(", ");
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    return JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }
};

const searchJira = async ({ jql, maxResults = 0, fields = [] }) => {
  const config = getJiraConfig();
  const searchUrl = new URL(`${config.baseUrl}/rest/api/2/search`);
  searchUrl.searchParams.set("jql", jql);
  searchUrl.searchParams.set("startAt", "0");
  searchUrl.searchParams.set("maxResults", String(maxResults));

  if (fields.length > 0) {
    searchUrl.searchParams.set("fields", fields.join(","));
  }

  const response = await fetch(searchUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: buildAuthHeader(config),
    },
  });

  if (!response.ok) {
    const detail = await parseErrorBody(response);
    const error = new Error(detail || `Jira request failed with ${response.status}`);
    error.code = "jira/request-failed";
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const normalizeIssue = (issue, baseUrl) => {
  const fields = issue?.fields || {};

  return {
    id: issue?.id || null,
    key: issue?.key || "",
    summary: fields.summary || "",
    status: fields.status?.name || "Unknown",
    assignee: fields.assignee?.displayName || "Unassigned",
    reporter: fields.reporter?.displayName || "Unknown",
    priority: fields.priority?.name || "Not set",
    project: fields.project?.key || "",
    issueType: fields.issuetype?.name || "",
    updated: fields.updated || null,
    scheduledStart: fields.customfield_17170 || null,
    scheduledEnd: fields.customfield_17172 || null,
    url: `${baseUrl}/browse/${issue?.key || ""}`,
  };
};

module.exports = {
  REQUIRED_CONFIG_KEYS,
  getJiraConfig,
  getMissingConfigKeys,
  normalizeIssue,
  searchJira,
  shouldUseMockData,
};

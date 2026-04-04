const REQUIRED_ENV_KEYS = ["JIRA_BASE_URL", "JIRA_USERNAME", "JIRA_PASSWORD"];

const getMissingConfigKeys = () =>
  REQUIRED_ENV_KEYS.filter((key) => !String(process.env[key] || "").trim());

const getJiraConfig = () => {
  const missingKeys = getMissingConfigKeys();
  if (missingKeys.length > 0) {
    const error = new Error(`Missing Jira configuration: ${missingKeys.join(", ")}`);
    error.code = "jira/config-missing";
    throw error;
  }

  return {
    baseUrl: String(process.env.JIRA_BASE_URL).replace(/\/+$/, ""),
    username: String(process.env.JIRA_USERNAME),
    password: String(process.env.JIRA_PASSWORD),
  };
};

const buildAuthHeader = ({ username, password }) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

const parseErrorBody = async (response) => {
  try {
    const data = await response.json();
    if (typeof data === "string") return data;
    if (data?.errorMessages?.length) return data.errorMessages.join(", ");
    if (data?.message) return data.message;
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

const normalizeIssue = (issue) => {
  const config = getJiraConfig();
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
    url: `${config.baseUrl}/browse/${issue?.key || ""}`,
  };
};

module.exports = {
  getMissingConfigKeys,
  normalizeIssue,
  searchJira,
};

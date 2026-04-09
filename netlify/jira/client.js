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

const requestJiraJson = async (url, config = getJiraConfig()) => {
  const response = await fetch(url, {
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

const searchJira = async ({ jql, maxResults = 0, fields = [] }) => {
  const config = getJiraConfig();
  const searchUrl = new URL(`${config.baseUrl}/rest/api/2/search`);
  searchUrl.searchParams.set("jql", jql);
  searchUrl.searchParams.set("startAt", "0");
  searchUrl.searchParams.set("maxResults", String(maxResults));

  if (fields.length > 0) {
    searchUrl.searchParams.set("fields", fields.join(","));
  }

  return requestJiraJson(searchUrl, config);
};

const collectCommentText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(collectCommentText).filter(Boolean).join("");
  }

  if (typeof value !== "object") return "";

  if (typeof value.text === "string") {
    return value.text;
  }

  if (value.type === "hardBreak") {
    return "\n";
  }

  const nested = Array.isArray(value.content)
    ? value.content.map(collectCommentText).join("")
    : "";

  if (["paragraph", "blockquote", "codeBlock", "heading", "listItem"].includes(value.type)) {
    return nested ? `${nested}\n` : "";
  }

  return nested;
};

const normalizeComment = (comment) => {
  if (!comment) return null;

  const body = collectCommentText(comment.body).trim();

  return {
    id: comment.id || null,
    author:
      comment.updateAuthor?.displayName ||
      comment.author?.displayName ||
      "Unknown",
    body,
    created: comment.created || null,
    updated: comment.updated || comment.created || null,
  };
};

const readCommentItems = (payload) => {
  if (Array.isArray(payload?.comments)) return payload.comments;
  if (Array.isArray(payload?.values)) return payload.values;
  return [];
};

const fetchLatestIssueComment = async (issueKey, config = getJiraConfig()) => {
  const commentsUrl = new URL(
    `${config.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`
  );

  try {
    commentsUrl.searchParams.set("maxResults", "1");
    commentsUrl.searchParams.set("orderBy", "-created");
    const latestPage = await requestJiraJson(commentsUrl, config);
    const latestComment = normalizeComment(readCommentItems(latestPage)[0]);
    if (latestComment || Number(latestPage?.total || 0) <= 1) {
      return latestComment;
    }
  } catch {
    // Some Jira deployments do not support orderBy here, so fall back to paging below.
  }

  const firstPageUrl = new URL(
    `${config.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`
  );
  firstPageUrl.searchParams.set("maxResults", "1");

  const firstPage = await requestJiraJson(firstPageUrl, config);
  const firstItems = readCommentItems(firstPage);
  const totalComments = Number(firstPage?.total || firstItems.length || 0);
  if (totalComments <= 1) {
    return normalizeComment(firstItems[0]);
  }

  const finalPageUrl = new URL(
    `${config.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`
  );
  finalPageUrl.searchParams.set("startAt", String(Math.max(totalComments - 1, 0)));
  finalPageUrl.searchParams.set("maxResults", "1");

  const finalPage = await requestJiraJson(finalPageUrl, config);
  return normalizeComment(readCommentItems(finalPage)[0]);
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
  fetchLatestIssueComment,
  normalizeIssue,
  searchJira,
  shouldUseMockData,
};

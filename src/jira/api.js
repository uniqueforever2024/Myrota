const NETLIFY_FUNCTION_PATH = "/.netlify/functions/jiraDashboard";
const NETLIFY_DEV_URL = `http://127.0.0.1:8888${NETLIFY_FUNCTION_PATH}`;

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const getApiBaseCandidates = () => {
  const explicitBaseUrl = import.meta.env.VITE_JIRA_DASHBOARD_API_URL?.trim();
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const port = typeof window !== "undefined" ? window.location.port : "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(host);
  const sameOriginFunctionUrl = origin
    ? new URL(NETLIFY_FUNCTION_PATH, origin).toString()
    : NETLIFY_FUNCTION_PATH;
  const localNetlifyDevUrl = isLocalHost && port !== "8888" ? NETLIFY_DEV_URL : null;

  return unique([
    explicitBaseUrl,
    localNetlifyDevUrl,
    sameOriginFunctionUrl,
  ]);
};

const buildRequestUrl = (baseUrl, params) => {
  const url = new URL(baseUrl, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const readResponseBody = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

const describeCandidateFailure = (baseUrl, error) => {
  if (error?.responseStatus) {
    if (error.responseStatus === 404 && baseUrl === NETLIFY_DEV_URL) {
      return "Local Netlify Jira backend is not running. Start it with `npx netlify dev`.";
    }

    if (error.responseStatus === 404 && String(baseUrl || "").includes(NETLIFY_FUNCTION_PATH)) {
      return "Netlify Jira backend is not reachable right now.";
    }

    return error.message || "Jira backend request failed.";
  }

  if (baseUrl === NETLIFY_DEV_URL) {
    return "Local Netlify Jira backend is not running. Start it with `npx netlify dev`.";
  }

  if (String(baseUrl || "").includes(NETLIFY_FUNCTION_PATH)) {
    return "Netlify Jira backend is not reachable right now.";
  }

  return error?.message || "Jira backend request failed.";
};

const requestJiraDashboard = async (params) => {
  let lastError = null;
  const failureMessages = [];

  for (const baseUrl of getApiBaseCandidates()) {
    try {
      const response = await fetch(buildRequestUrl(baseUrl, params), {
        headers: {
          Accept: "application/json",
        },
      });

      const body = await readResponseBody(response);
      if (!response.ok) {
        const error = new Error(
          typeof body === "string" ? body : body?.error || `Request failed (${response.status})`
        );
        error.responseStatus = response.status;
        throw error;
      }

      return body;
    } catch (error) {
      lastError = error;
      failureMessages.push(describeCandidateFailure(baseUrl, error));
    }
  }

  if (failureMessages.length > 0) {
    throw new Error(Array.from(new Set(failureMessages)).join(" "));
  }

  throw lastError || new Error("No Jira dashboard endpoint is available.");
};

export const fetchJiraSummary = () => requestJiraDashboard({ mode: "summary" });

export const fetchJiraIssueDetails = (view) =>
  requestJiraDashboard({ mode: "details", view });

export const formatJiraDate = (value, options = {}) => {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
};

export const formatJiraDateTime = (value) => {
  if (!value) return "Not updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatJiraScheduleWindow = ({ scheduledStart, scheduledEnd }) => {
  if (!scheduledStart && !scheduledEnd) return "Schedule not set";
  if (scheduledStart && scheduledEnd) {
    return `${formatJiraDateTime(scheduledStart)} - ${formatJiraDateTime(scheduledEnd)}`;
  }
  return scheduledStart
    ? `Starts ${formatJiraDateTime(scheduledStart)}`
    : `Ends ${formatJiraDateTime(scheduledEnd)}`;
};

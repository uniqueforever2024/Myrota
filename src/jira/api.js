const FIREBASE_PROJECT_ID = "myrota-13aa3";
const FUNCTIONS_REGION = "us-central1";
const CLOUD_FUNCTION_URL = `https://${FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net/jiraDashboard`;
const EMULATOR_FUNCTION_URL = `http://127.0.0.1:5001/${FIREBASE_PROJECT_ID}/${FUNCTIONS_REGION}/jiraDashboard`;

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const getApiBaseCandidates = () => {
  const explicitBaseUrl = import.meta.env.VITE_JIRA_DASHBOARD_API_URL?.trim();
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(host);

  return unique([
    explicitBaseUrl,
    isLocalHost ? EMULATOR_FUNCTION_URL : null,
    CLOUD_FUNCTION_URL,
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
  if (baseUrl === EMULATOR_FUNCTION_URL) {
    return "Local Jira backend is not running on the Firebase Functions emulator.";
  }

  if (baseUrl === CLOUD_FUNCTION_URL) {
    return "Deployed Jira backend is not reachable. The jiraDashboard function may not be deployed yet.";
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
        throw new Error(
          typeof body === "string" ? body : body?.error || `Request failed (${response.status})`
        );
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

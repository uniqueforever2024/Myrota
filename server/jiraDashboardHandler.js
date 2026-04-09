const { buildMockDetailPayload, buildMockSummaryPayload } = require("../netlify/jira/mockData");
const { getMissingConfigKeys, shouldUseMockData } = require("../netlify/jira/client");
const { buildDetailPayload, buildSummaryPayload } = require("../netlify/jira/views");

const RESPONSE_HEADERS = {
  "Cache-Control": "private, max-age=60, s-maxage=60",
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const createResponse = (statusCode, payload) => ({
  statusCode,
  headers: RESPONSE_HEADERS,
  body: JSON.stringify(payload),
});

const sendJson = (res, statusCode, payload) => {
  Object.entries(RESPONSE_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.status(statusCode).json(payload);
};

const getQueryValue = (query, key, fallback = "") => String(query?.[key] || fallback);

const buildPayload = async (query) => {
  const mode = getQueryValue(query, "mode", "summary");

  if (shouldUseMockData()) {
    if (mode === "summary") {
      return { statusCode: 200, payload: buildMockSummaryPayload() };
    }

    if (mode === "details") {
      return {
        statusCode: 200,
        payload: buildMockDetailPayload(getQueryValue(query, "view")),
      };
    }

    return { statusCode: 400, payload: { error: "Unknown Jira dashboard mode." } };
  }

  const missingKeys = getMissingConfigKeys();
  if (missingKeys.length > 0) {
    return {
      statusCode: 500,
      payload: {
        error: `Jira configuration is incomplete: ${missingKeys.join(", ")}`,
      },
    };
  }

  if (mode === "summary") {
    return { statusCode: 200, payload: await buildSummaryPayload() };
  }

  if (mode === "details") {
    return {
      statusCode: 200,
      payload: await buildDetailPayload(getQueryValue(query, "view")),
    };
  }

  return { statusCode: 400, payload: { error: "Unknown Jira dashboard mode." } };
};

const buildErrorResponse = (error) => {
  const status = error?.code === "jira/unknown-view" ? 400 : error?.status || 500;
  return {
    statusCode: status,
    payload: {
      error:
        status === 500
          ? error?.message || "Failed to load Jira dashboard data."
          : error?.message || "Jira dashboard request failed.",
    },
  };
};

const handleNetlifyRequest = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return createResponse(204, {});
  }

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Use GET for jiraDashboard." });
  }

  try {
    const { statusCode, payload } = await buildPayload(event.queryStringParameters);
    return createResponse(statusCode, payload);
  } catch (error) {
    const { statusCode, payload } = buildErrorResponse(error);
    return createResponse(statusCode, payload);
  }
};

const handleNodeRequest = async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Use GET for jiraDashboard." });
    return;
  }

  try {
    const { statusCode, payload } = await buildPayload(req.query);
    sendJson(res, statusCode, payload);
  } catch (error) {
    const { statusCode, payload } = buildErrorResponse(error);
    sendJson(res, statusCode, payload);
  }
};

module.exports = {
  handleNetlifyRequest,
  handleNodeRequest,
};

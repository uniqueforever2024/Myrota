const { buildMockDetailPayload, buildMockSummaryPayload } = require("../jira/mockData");
const { getMissingConfigKeys, shouldUseMockData } = require("../jira/client");
const { buildDetailPayload, buildSummaryPayload } = require("../jira/views");

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Cache-Control": "private, max-age=60, s-maxage=60",
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  },
  body: JSON.stringify(payload),
});

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, {});
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "Use GET for jiraDashboard." });
  }

  const mode = String(event.queryStringParameters?.mode || "summary");

  try {
    if (shouldUseMockData()) {
      if (mode === "summary") {
        return json(200, buildMockSummaryPayload());
      }

      if (mode === "details") {
        return json(200, buildMockDetailPayload(String(event.queryStringParameters?.view || "")));
      }

      return json(400, { error: "Unknown Jira dashboard mode." });
    }

    const missingKeys = getMissingConfigKeys();
    if (missingKeys.length > 0) {
      return json(500, {
        error: `Netlify Jira configuration is incomplete: ${missingKeys.join(", ")}`,
      });
    }

    if (mode === "summary") {
      return json(200, await buildSummaryPayload());
    }

    if (mode === "details") {
      return json(200, await buildDetailPayload(String(event.queryStringParameters?.view || "")));
    }

    return json(400, { error: "Unknown Jira dashboard mode." });
  } catch (error) {
    const status = error?.code === "jira/unknown-view" ? 400 : error?.status || 500;
    return json(status, {
      error:
        status === 500
          ? error?.message || "Failed to load Jira dashboard data."
          : error?.message || "Jira dashboard request failed.",
    });
  }
};

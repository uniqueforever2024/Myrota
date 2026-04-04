const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const { getJiraConfig } = require("./jira/client");
const { buildDetailPayload, buildSummaryPayload } = require("./jira/views");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.jiraDashboard = onRequest(
  {
    region: "us-central1",
    cors: true,
  },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Use GET for jiraDashboard." });
      return;
    }

    const missingKeys = getMissingConfigKeys();
    if (missingKeys.length > 0) {
      res.status(500).json({
        error: `Jira server configuration is incomplete: ${missingKeys.join(", ")}`,
      });
      return;
    }

    const mode = String(req.query.mode || "summary");

    try {
      res.set("Cache-Control", "private, max-age=60, s-maxage=60");
      await getJiraConfig();

      if (mode === "summary") {
        const payload = await buildSummaryPayload();
        res.status(200).json(payload);
        return;
      }

      if (mode === "details") {
        const viewId = String(req.query.view || "");
        const payload = await buildDetailPayload(viewId);
        res.status(200).json(payload);
        return;
      }

      res.status(400).json({ error: "Unknown Jira dashboard mode." });
    } catch (error) {
      logger.error("jiraDashboard failed", error);
      const status = error?.code === "jira/unknown-view" ? 400 : error?.status || 500;
      res.status(status).json({
        error:
          status === 500
            ? "Failed to load Jira dashboard data."
            : error?.message || "Jira dashboard request failed.",
      });
    }
  }
);

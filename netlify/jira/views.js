const { getJiraConfig, normalizeIssue, searchJira } = require("./client");
const { DASHBOARD_VIEWS, DETAIL_FIELDS, getViewDefinition } = require("./viewDefinitions");

const buildSummaryPayload = async () => {
  const jiraConfig = getJiraConfig();
  const [
    mappingInProgress,
    mappingOpenEpic,
    supportInProgress,
    supportOnHold,
    changesThisWeek,
  ] = await Promise.all([
    searchJira({
      jql: DASHBOARD_VIEWS.mappingInProgress.countJql,
      maxResults: 0,
    }),
    searchJira({
      jql: DASHBOARD_VIEWS.mappingOpenEpic.countJql,
      maxResults: 0,
    }),
    searchJira({
      jql: DASHBOARD_VIEWS.supportInProgress.countJql,
      maxResults: 0,
    }),
    searchJira({
      jql: DASHBOARD_VIEWS.supportOnHold.countJql,
      maxResults: 0,
    }),
    searchJira({
      jql: DASHBOARD_VIEWS.changesThisWeek.detailJql,
      maxResults: 6,
      fields: DETAIL_FIELDS,
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    mapping: {
      title: "EDI_MAPPING",
      subtitle: "In Progress stories and open epics from project EDI",
      inProgress: {
        label: "In Progress",
        count: mappingInProgress?.total || 0,
        viewId: DASHBOARD_VIEWS.mappingInProgress.id,
      },
      openEpic: {
        label: "Open Epic",
        count: mappingOpenEpic?.total || 0,
        viewId: DASHBOARD_VIEWS.mappingOpenEpic.id,
      },
    },
    support: {
      title: "EDI_SUPPORT",
      subtitle: "In Progress and ON-HOLD issues for team HCL-EDI in HCLSM",
      inProgress: {
        label: "In Progress",
        count: supportInProgress?.total || 0,
        viewId: DASHBOARD_VIEWS.supportInProgress.id,
      },
      onHold: {
        label: "On Hold",
        count: supportOnHold?.total || 0,
        viewId: DASHBOARD_VIEWS.supportOnHold.id,
      },
    },
    changes: {
      title: "CHANGE_REQUEST",
      subtitle: "Assigned HCLCR change requests for the selected team members",
      totalCount: changesThisWeek?.total || 0,
      viewId: DASHBOARD_VIEWS.changesThisWeek.id,
      issues: Array.isArray(changesThisWeek?.issues)
        ? changesThisWeek.issues.map((issue) => normalizeIssue(issue, jiraConfig.baseUrl))
        : [],
    },
  };
};

const buildDetailPayload = async (viewId) => {
  const jiraConfig = getJiraConfig();
  const view = getViewDefinition(viewId);
  if (!view) {
    const error = new Error("Unknown Jira dashboard view.");
    error.code = "jira/unknown-view";
    throw error;
  }

  const results = await searchJira({
    jql: view.detailJql,
    maxResults: 100,
    fields: DETAIL_FIELDS,
  });

  const issues = Array.isArray(results?.issues)
    ? results.issues.map((issue) => normalizeIssue(issue, jiraConfig.baseUrl))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    view: view.id,
    title: view.title,
    subtitle: view.subtitle,
    emptyState: view.emptyState,
    totalCount: results?.total || 0,
    visibleCount: issues.length,
    truncated: Number(results?.total || 0) > issues.length,
    issues,
  };
};

module.exports = {
  buildDetailPayload,
  buildSummaryPayload,
};

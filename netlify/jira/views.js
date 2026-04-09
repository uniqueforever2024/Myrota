const {
  fetchLatestIssueComment,
  getJiraConfig,
  normalizeIssue,
  searchJira,
} = require("./client");
const { DASHBOARD_VIEWS, DETAIL_FIELDS, getViewDefinition } = require("./viewDefinitions");

const getTimeValue = (value) => {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildStatusCommentPayload = async (view, jiraConfig) => {
  const results = await searchJira({
    jql: view.detailJql,
    maxResults: 100,
    fields: DETAIL_FIELDS,
  });

  const normalizedIssues = Array.isArray(results?.issues)
    ? results.issues.map((issue) => normalizeIssue(issue, jiraConfig.baseUrl))
    : [];

  const issuesWithComments = await Promise.all(
    normalizedIssues.map(async (issue) => {
      try {
        const lastComment = await fetchLatestIssueComment(issue.key, jiraConfig);
        return { ...issue, lastComment };
      } catch {
        return { ...issue, lastComment: null };
      }
    })
  );

  const groupsByStatus = issuesWithComments.reduce((groupMap, issue) => {
    const status = issue.status || "Unknown";
    if (!groupMap.has(status)) {
      groupMap.set(status, []);
    }
    groupMap.get(status).push(issue);
    return groupMap;
  }, new Map());

  const statusRank = new Map(
    (view.statusOrder || []).map((status, index) => [String(status), index])
  );

  const statusGroups = Array.from(groupsByStatus.entries())
    .sort(([leftStatus], [rightStatus]) => {
      const leftRank = statusRank.has(leftStatus)
        ? statusRank.get(leftStatus)
        : Number.MAX_SAFE_INTEGER;
      const rightRank = statusRank.has(rightStatus)
        ? statusRank.get(rightStatus)
        : Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return leftStatus.localeCompare(rightStatus);
    })
    .map(([status, issues]) => ({
      status,
      count: issues.length,
      issues: issues.sort((left, right) => {
        const rightDate = getTimeValue(right.lastComment?.updated || right.updated);
        const leftDate = getTimeValue(left.lastComment?.updated || left.updated);
        return rightDate - leftDate;
      }),
    }));

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    view: view.id,
    title: view.title,
    subtitle: view.subtitle,
    emptyState: view.emptyState,
    totalCount: results?.total || 0,
    visibleCount: issuesWithComments.length,
    truncated: Number(results?.total || 0) > issuesWithComments.length,
    statusGroups,
  };
};

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

  if (view.mode === "status-comments") {
    return buildStatusCommentPayload(view, jiraConfig);
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

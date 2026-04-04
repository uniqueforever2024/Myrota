const { normalizeIssue, searchJira } = require("./client");

const DETAIL_FIELDS = [
  "summary",
  "status",
  "assignee",
  "reporter",
  "priority",
  "project",
  "issuetype",
  "updated",
  "customfield_17170",
  "customfield_17172",
];

const DASHBOARD_VIEWS = {
  mappingInProgress: {
    id: "mappingInProgress",
    title: "EDI Mapping In Progress",
    subtitle: "Project EDI",
    emptyState: "No mapping issues are currently in progress.",
    countJql: 'project = EDI AND issuetype = Story AND status = "In Progress"',
    detailJql: 'project = EDI AND issuetype = Story AND status = "In Progress" ORDER BY updated DESC',
  },
  mappingOpenEpic: {
    id: "mappingOpenEpic",
    title: "EDI Mapping Open Epic",
    subtitle: "Project EDI | Assignees MudigoNa and naveen.mudigonda",
    emptyState: "No open epics matched the selected Jira filter.",
    countJql: "project = EDI AND issuetype = Epic AND status = Open AND assignee in (MudigoNa, naveen.mudigonda)",
    detailJql: "project = EDI AND issuetype = Epic AND status = Open AND assignee in (MudigoNa, naveen.mudigonda) ORDER BY updated DESC",
  },
  supportInProgress: {
    id: "supportInProgress",
    title: "EDI Support In Progress",
    subtitle: "Project HCLSM | Team HCL-EDI",
    emptyState: "No support issues are currently in progress.",
    countJql: 'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "In Progress"',
    detailJql: 'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "In Progress" ORDER BY updated DESC',
  },
  supportOnHold: {
    id: "supportOnHold",
    title: "EDI Support On Hold",
    subtitle: "Project HCLSM | Team HCL-EDI",
    emptyState: "No support issues are currently on hold.",
    countJql: 'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "ON-HOLD"',
    detailJql: 'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "ON-HOLD" ORDER BY updated DESC',
  },
  changesThisWeek: {
    id: "changesThisWeek",
    title: "Assigned Change Requests",
    subtitle: "Project HCLCR | Selected assignees and active statuses",
    emptyState: "No change requests matched the selected Jira filter.",
    countJql: 'project = HCLCR AND issuetype in (Change, Sub-task) AND status in (Open, "IN PROGRESS", Scheduled, "UNDER REVIEW", Testing, Implementation, "Waiting CAT Approval", "INTERNAL APPROVAL", "SDM APPROVAL") AND assignee in (AkashSA, RawatYas, MudigoNa, GehlotPi, ChandVij, GargAkas, ShikhDee, DeepthCh, KumarSou, AneesAs, SinghHar, TasavvurAN)',
    detailJql: 'project = HCLCR AND issuetype in (Change, Sub-task) AND status in (Open, "IN PROGRESS", Scheduled, "UNDER REVIEW", Testing, Implementation, "Waiting CAT Approval", "INTERNAL APPROVAL", "SDM APPROVAL") AND assignee in (AkashSA, RawatYas, MudigoNa, GehlotPi, ChandVij, GargAkas, ShikhDee, DeepthCh, KumarSou, AneesAs, SinghHar, TasavvurAN) ORDER BY updated DESC',
  },
};

const getViewDefinition = (viewId) => DASHBOARD_VIEWS[viewId] || null;

const buildSummaryPayload = async () => {
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
        ? changesThisWeek.issues.map(normalizeIssue)
        : [],
    },
  };
};

const buildDetailPayload = async (viewId) => {
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
    ? results.issues.map(normalizeIssue)
    : [];

  return {
    generatedAt: new Date().toISOString(),
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
  getViewDefinition,
};

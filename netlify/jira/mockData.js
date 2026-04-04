const { DASHBOARD_VIEWS, getViewDefinition } = require("./viewDefinitions");

const makeIssue = ({
  key,
  summary,
  status,
  assignee,
  project,
  issueType,
  updated,
  scheduledStart,
  scheduledEnd,
}) => ({
  id: key,
  key,
  summary,
  status,
  assignee,
  reporter: "Mock Preview",
  priority: "Medium",
  project,
  issueType,
  updated,
  scheduledStart,
  scheduledEnd,
  url: "#",
});

const MOCK_ISSUES = {
  mappingInProgress: [
    makeIssue({
      key: "EDI-1201",
      summary: "Preview mapping story for inbound order validation",
      status: "In Progress",
      assignee: "MudigoNa",
      project: "EDI",
      issueType: "Story",
      updated: "2026-04-04T07:30:00.000Z",
    }),
    makeIssue({
      key: "EDI-1202",
      summary: "Preview mapping story for outbound invoice enrichment",
      status: "In Progress",
      assignee: "naveen.mudigonda",
      project: "EDI",
      issueType: "Story",
      updated: "2026-04-03T14:10:00.000Z",
    }),
  ],
  mappingOpenEpic: [
    makeIssue({
      key: "EDI-EPIC-17",
      summary: "Preview epic for Q2 mapping automation cleanup",
      status: "Open",
      assignee: "MudigoNa",
      project: "EDI",
      issueType: "Epic",
      updated: "2026-04-02T10:00:00.000Z",
    }),
  ],
  supportInProgress: [
    makeIssue({
      key: "HCLSM-901",
      summary: "Preview support ticket for failed ASN feed",
      status: "In Progress",
      assignee: "AkashSA",
      project: "HCLSM",
      issueType: "Incident",
      updated: "2026-04-04T09:45:00.000Z",
    }),
    makeIssue({
      key: "HCLSM-915",
      summary: "Preview support ticket for partner connection recovery",
      status: "In Progress",
      assignee: "TasavvurAN",
      project: "HCLSM",
      issueType: "Incident",
      updated: "2026-04-04T08:05:00.000Z",
    }),
  ],
  supportOnHold: [
    makeIssue({
      key: "HCLSM-877",
      summary: "Preview on-hold issue waiting for customer sample file",
      status: "ON-HOLD",
      assignee: "ShikhDee",
      project: "HCLSM",
      issueType: "Incident",
      updated: "2026-04-01T13:15:00.000Z",
    }),
  ],
  changesThisWeek: [
    makeIssue({
      key: "HCLCR-210",
      summary: "Preview change request for production partner onboarding",
      status: "Scheduled",
      assignee: "AkashSA",
      project: "HCLCR",
      issueType: "Change",
      updated: "2026-04-04T10:20:00.000Z",
      scheduledStart: "2026-04-06T05:30:00.000Z",
      scheduledEnd: "2026-04-06T07:00:00.000Z",
    }),
    makeIssue({
      key: "HCLCR-214",
      summary: "Preview sub-task for change validation and smoke checks",
      status: "Testing",
      assignee: "DeepthCh",
      project: "HCLCR",
      issueType: "Sub-task",
      updated: "2026-04-03T16:00:00.000Z",
      scheduledStart: "2026-04-07T08:00:00.000Z",
      scheduledEnd: "2026-04-07T09:15:00.000Z",
    }),
    makeIssue({
      key: "HCLCR-218",
      summary: "Preview change request awaiting CAT approval",
      status: "Waiting CAT Approval",
      assignee: "MudigoNa",
      project: "HCLCR",
      issueType: "Change",
      updated: "2026-04-02T11:40:00.000Z",
      scheduledStart: "2026-04-08T06:00:00.000Z",
      scheduledEnd: "2026-04-08T07:30:00.000Z",
    }),
  ],
};

const buildMockSummaryPayload = () => ({
  generatedAt: new Date().toISOString(),
  source: "mock",
  mapping: {
    title: "EDI_MAPPING",
    subtitle: "Preview mode | Sample mapping stories and epics",
    inProgress: {
      label: "In Progress",
      count: MOCK_ISSUES.mappingInProgress.length,
      viewId: DASHBOARD_VIEWS.mappingInProgress.id,
    },
    openEpic: {
      label: "Open Epic",
      count: MOCK_ISSUES.mappingOpenEpic.length,
      viewId: DASHBOARD_VIEWS.mappingOpenEpic.id,
    },
  },
  support: {
    title: "EDI_SUPPORT",
    subtitle: "Preview mode | Sample HCL-EDI queue",
    inProgress: {
      label: "In Progress",
      count: MOCK_ISSUES.supportInProgress.length,
      viewId: DASHBOARD_VIEWS.supportInProgress.id,
    },
    onHold: {
      label: "On Hold",
      count: MOCK_ISSUES.supportOnHold.length,
      viewId: DASHBOARD_VIEWS.supportOnHold.id,
    },
  },
  changes: {
    title: "CHANGE_REQUEST",
    subtitle: "Preview mode | Sample change request schedule",
    totalCount: MOCK_ISSUES.changesThisWeek.length,
    viewId: DASHBOARD_VIEWS.changesThisWeek.id,
    issues: MOCK_ISSUES.changesThisWeek,
  },
});

const buildMockDetailPayload = (viewId) => {
  const view = getViewDefinition(viewId);
  if (!view) {
    const error = new Error("Unknown Jira dashboard view.");
    error.code = "jira/unknown-view";
    throw error;
  }

  const issues = MOCK_ISSUES[viewId] || [];

  return {
    generatedAt: new Date().toISOString(),
    source: "mock",
    view: view.id,
    title: `${view.title} (Preview)`,
    subtitle: `${view.subtitle} | Mock data`,
    emptyState: view.emptyState,
    totalCount: issues.length,
    visibleCount: issues.length,
    truncated: false,
    issues,
  };
};

module.exports = {
  buildMockDetailPayload,
  buildMockSummaryPayload,
};

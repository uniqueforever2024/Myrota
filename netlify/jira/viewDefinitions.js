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

const EDI_EPIC_COMMENT_STATUSES = [
  "Open",
  "IN PROGRESS",
  "To Do",
  "Backlog",
  "In Review",
  "Testing",
  "UAT Testing/Validation",
  "Ready for release",
];

const DASHBOARD_VIEWS = {
  ediEpicLastComments: {
    id: "ediEpicLastComments",
    mode: "status-comments",
    title: "EDI Epic Last Comments",
    subtitle: "Project EDI | Updated in the last 2 weeks | Assignees naveen.mudigonda and MudigoNa",
    emptyState: "No EDI epics matched the selected Jira filter.",
    statusOrder: EDI_EPIC_COMMENT_STATUSES,
    detailJql:
      'project = EDI AND issuetype = Epic AND status in (Open, "IN PROGRESS", "To Do", Backlog, "In Review", Testing, "UAT Testing/Validation", "Ready for release") AND updated >= -2w AND assignee in (naveen.mudigonda, MudigoNa) ORDER BY updated DESC',
  },
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
    countJql:
      "project = EDI AND issuetype = Epic AND status = Open AND assignee in (MudigoNa, naveen.mudigonda)",
    detailJql:
      "project = EDI AND issuetype = Epic AND status = Open AND assignee in (MudigoNa, naveen.mudigonda) ORDER BY updated DESC",
  },
  supportInProgress: {
    id: "supportInProgress",
    title: "EDI Support In Progress",
    subtitle: "Project HCLSM | Team HCL-EDI",
    emptyState: "No support issues are currently in progress.",
    countJql: 'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "In Progress"',
    detailJql:
      'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "In Progress" ORDER BY updated DESC',
  },
  supportOnHold: {
    id: "supportOnHold",
    title: "EDI Support On Hold",
    subtitle: "Project HCLSM | Team HCL-EDI",
    emptyState: "No support issues are currently on hold.",
    countJql: 'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "ON-HOLD"',
    detailJql:
      'project = HCLSM AND cf[19172] = "HCL-EDI" AND status = "ON-HOLD" ORDER BY updated DESC',
  },
  changesThisWeek: {
    id: "changesThisWeek",
    title: "Assigned Change Requests",
    subtitle: "Project HCLCR | Selected assignees and active statuses",
    emptyState: "No change requests matched the selected Jira filter.",
    countJql:
      'project = HCLCR AND issuetype in (Change, Sub-task) AND status in (Open, "IN PROGRESS", Scheduled, "UNDER REVIEW", Testing, Implementation, "Waiting CAT Approval", "INTERNAL APPROVAL", "SDM APPROVAL") AND assignee in (AkashSA, RawatYas, MudigoNa, GehlotPi, ChandVij, GargAkas, ShikhDee, DeepthCh, KumarSou, AneesAs, SinghHar, TasavvurAN)',
    detailJql:
      'project = HCLCR AND issuetype in (Change, Sub-task) AND status in (Open, "IN PROGRESS", Scheduled, "UNDER REVIEW", Testing, Implementation, "Waiting CAT Approval", "INTERNAL APPROVAL", "SDM APPROVAL") AND assignee in (AkashSA, RawatYas, MudigoNa, GehlotPi, ChandVij, GargAkas, ShikhDee, DeepthCh, KumarSou, AneesAs, SinghHar, TasavvurAN) ORDER BY updated DESC',
  },
};

const getViewDefinition = (viewId) => DASHBOARD_VIEWS[viewId] || null;

module.exports = {
  DASHBOARD_VIEWS,
  DETAIL_FIELDS,
  getViewDefinition,
};

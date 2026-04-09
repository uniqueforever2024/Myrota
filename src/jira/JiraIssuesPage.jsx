import { useEffect, useState } from "react";
import { fetchJiraIssueDetails, formatJiraDateTime } from "./api";

const detailShellClass =
  "rounded-[30px] border border-sky-200/15 bg-gradient-to-br from-slate-950/75 via-slate-900/65 to-white/[0.04] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.4)] backdrop-blur-2xl";

const DetailSkeleton = () => (
  <div className="grid gap-4">
    <div className="h-28 animate-pulse rounded-3xl bg-white/10" />
    <div className="h-28 animate-pulse rounded-3xl bg-white/10" />
    <div className="h-28 animate-pulse rounded-3xl bg-white/10" />
  </div>
);

const renderCommentText = (issue) => {
  if (!issue?.lastComment) return "No comments yet on this issue.";
  return issue.lastComment.body || "Latest comment body is empty.";
};

const formatLastCommentAuthor = (issue) => {
  if (!issue?.lastComment) return "No comments yet";
  return issue.lastComment.author || "Unknown";
};

const formatLastCommentTime = (issue) => {
  if (!issue?.lastComment?.updated) return "No comment timestamp";
  return formatJiraDateTime(issue.lastComment.updated);
};

const formatLastCommentMeta = (issue) => {
  if (!issue?.lastComment) return "No comments yet";
  return `Added ${formatLastCommentTime(issue)}`;
};

const STATUS_STYLE_MAP = {
  Open: {
    section: "border-sky-300/25 bg-gradient-to-br from-sky-500/[0.14] via-cyan-400/[0.10] to-slate-950/50",
    header: "border-sky-200/20 bg-sky-300/[0.10]",
    badge: "border-sky-200/30 bg-sky-300/[0.16] text-sky-50",
    tableHead: "bg-sky-300/[0.10] text-sky-50/85",
    key: "text-sky-100 hover:text-white",
    meta: "text-sky-100/80",
    action: "border-sky-200/35 bg-sky-300/[0.14] text-sky-50 hover:border-sky-200/50 hover:bg-sky-300/[0.22]",
    row: "hover:bg-sky-300/[0.05]",
  },
  "IN PROGRESS": {
    section: "border-amber-300/25 bg-gradient-to-br from-amber-500/[0.15] via-orange-400/[0.10] to-slate-950/50",
    header: "border-amber-200/20 bg-amber-300/[0.10]",
    badge: "border-amber-200/30 bg-amber-300/[0.16] text-amber-50",
    tableHead: "bg-amber-300/[0.10] text-amber-50/85",
    key: "text-amber-100 hover:text-white",
    meta: "text-amber-100/80",
    action: "border-amber-200/35 bg-amber-300/[0.14] text-amber-50 hover:border-amber-200/50 hover:bg-amber-300/[0.22]",
    row: "hover:bg-amber-300/[0.05]",
  },
  "To Do": {
    section: "border-blue-300/25 bg-gradient-to-br from-blue-500/[0.14] via-indigo-400/[0.10] to-slate-950/50",
    header: "border-blue-200/20 bg-blue-300/[0.10]",
    badge: "border-blue-200/30 bg-blue-300/[0.16] text-blue-50",
    tableHead: "bg-blue-300/[0.10] text-blue-50/85",
    key: "text-blue-100 hover:text-white",
    meta: "text-blue-100/80",
    action: "border-blue-200/35 bg-blue-300/[0.14] text-blue-50 hover:border-blue-200/50 hover:bg-blue-300/[0.22]",
    row: "hover:bg-blue-300/[0.05]",
  },
  Backlog: {
    section: "border-slate-300/20 bg-gradient-to-br from-slate-400/[0.12] via-slate-300/[0.08] to-slate-950/55",
    header: "border-slate-200/15 bg-slate-300/[0.08]",
    badge: "border-slate-200/20 bg-slate-300/[0.12] text-slate-100",
    tableHead: "bg-slate-300/[0.08] text-slate-100/80",
    key: "text-slate-100 hover:text-white",
    meta: "text-slate-200/70",
    action: "border-slate-200/25 bg-slate-300/[0.10] text-slate-100 hover:border-slate-200/40 hover:bg-slate-300/[0.18]",
    row: "hover:bg-slate-300/[0.04]",
  },
  "In Review": {
    section: "border-violet-300/25 bg-gradient-to-br from-violet-500/[0.14] via-fuchsia-400/[0.10] to-slate-950/50",
    header: "border-violet-200/20 bg-violet-300/[0.10]",
    badge: "border-violet-200/30 bg-violet-300/[0.16] text-violet-50",
    tableHead: "bg-violet-300/[0.10] text-violet-50/85",
    key: "text-violet-100 hover:text-white",
    meta: "text-violet-100/80",
    action: "border-violet-200/35 bg-violet-300/[0.14] text-violet-50 hover:border-violet-200/50 hover:bg-violet-300/[0.22]",
    row: "hover:bg-violet-300/[0.05]",
  },
  Testing: {
    section: "border-rose-300/25 bg-gradient-to-br from-rose-500/[0.14] via-pink-400/[0.10] to-slate-950/50",
    header: "border-rose-200/20 bg-rose-300/[0.10]",
    badge: "border-rose-200/30 bg-rose-300/[0.16] text-rose-50",
    tableHead: "bg-rose-300/[0.10] text-rose-50/85",
    key: "text-rose-100 hover:text-white",
    meta: "text-rose-100/80",
    action: "border-rose-200/35 bg-rose-300/[0.14] text-rose-50 hover:border-rose-200/50 hover:bg-rose-300/[0.22]",
    row: "hover:bg-rose-300/[0.05]",
  },
  "UAT Testing/Validation": {
    section: "border-pink-300/25 bg-gradient-to-br from-pink-500/[0.14] via-fuchsia-400/[0.10] to-slate-950/50",
    header: "border-pink-200/20 bg-pink-300/[0.10]",
    badge: "border-pink-200/30 bg-pink-300/[0.16] text-pink-50",
    tableHead: "bg-pink-300/[0.10] text-pink-50/85",
    key: "text-pink-100 hover:text-white",
    meta: "text-pink-100/80",
    action: "border-pink-200/35 bg-pink-300/[0.14] text-pink-50 hover:border-pink-200/50 hover:bg-pink-300/[0.22]",
    row: "hover:bg-pink-300/[0.05]",
  },
  "Ready for release": {
    section: "border-emerald-300/30 bg-gradient-to-br from-emerald-400/[0.16] via-lime-300/[0.12] to-emerald-950/45",
    header: "border-emerald-200/20 bg-emerald-300/[0.12]",
    badge: "border-emerald-200/35 bg-emerald-300/[0.18] text-emerald-50",
    tableHead: "bg-emerald-300/[0.12] text-emerald-50/85",
    key: "text-emerald-100 hover:text-white",
    meta: "text-emerald-100/80",
    action: "border-emerald-200/35 bg-emerald-300/[0.16] text-emerald-50 hover:border-emerald-200/55 hover:bg-emerald-300/[0.24]",
    row: "hover:bg-emerald-300/[0.06]",
  },
  default: {
    section: "border-white/12 bg-white/[0.04]",
    header: "border-white/10 bg-white/[0.05]",
    badge: "border-white/15 bg-white/10 text-white/90",
    tableHead: "bg-white/[0.05] text-white/75",
    key: "text-sky-100 hover:text-white",
    meta: "text-slate-200/75",
    action: "border-sky-300/20 bg-sky-400/10 text-sky-100 hover:border-sky-300/40 hover:bg-sky-400/16",
    row: "hover:bg-white/[0.04]",
  },
};

const getStatusStyles = (status) => STATUS_STYLE_MAP[status] || STATUS_STYLE_MAP.default;

export function JiraIssuesPage({ view }) {
  const [details, setDetails] = useState(null);
  const [expandedStatus, setExpandedStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDetails = async ({ silent = false } = {}) => {
    if (!view) return;
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchJiraIssueDetails(view);
      setDetails(data);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load Jira issue details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setDetails(null);
    setError("");
    setLoading(true);
    loadDetails();
  }, [view]);

  useEffect(() => {
    if (!details?.statusGroups?.length) {
      setExpandedStatus("");
      return;
    }

    setExpandedStatus((currentStatus) =>
      details.statusGroups.some((group) => group.status === currentStatus)
        ? currentStatus
        : details.statusGroups[0].status
    );
  }, [details]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-sky-100">
            {details?.title || "Jira Last Comments"}
          </h2>
          <p className="mt-2 text-sm text-slate-300/85">
            {details?.subtitle || "Loading the selected Jira epic list."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDetails({ silent: true })}
          className="self-start rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-bold text-white/85 backdrop-blur-md transition hover:border-sky-300/35 hover:bg-sky-400/10 hover:text-white"
        >
          {refreshing ? "Refreshing..." : "Refresh Jira"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 backdrop-blur-xl">
          {error}
        </div>
      )}

      <section className={detailShellClass}>
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-sky-100/65">Project EDI Issues</div>
            <div className="mt-3 text-4xl font-black text-white">
              {loading && !details ? "..." : details?.totalCount || 0}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-300/80">
              {details?.totalCount === 1 ? "issue found" : "issues found"}
            </div>
          </div>
          <div className="space-y-2 text-sm font-medium text-slate-300/70">
            <div>{details?.statusGroups?.length || 0} status groups</div>
            {details?.statusGroups?.length > 0 && (
              <div>{expandedStatus ? `Open panel: ${expandedStatus}` : "Select a status panel to view issues"}</div>
            )}
            {details?.generatedAt && <div>Updated {formatJiraDateTime(details.generatedAt)}</div>}
          </div>
        </div>

        <div className="mt-6">
          {loading && !details ? (
            <DetailSkeleton />
          ) : details?.statusGroups?.length ? (
            <div className="space-y-6">
              {details.statusGroups.map((group) => {
                const statusStyles = getStatusStyles(group.status);
                const isExpanded = expandedStatus === group.status;

                return (
                  <section
                    key={group.status}
                    className={`overflow-hidden rounded-3xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl ${statusStyles.section}`}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedStatus(group.status)}
                      className={`flex w-full flex-col gap-3 border-b px-5 py-4 text-left transition md:flex-row md:items-center md:justify-between ${statusStyles.header} ${
                        isExpanded ? "" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/60">
                          Status
                        </div>
                        <h3 className="mt-2 text-2xl font-black text-white">{group.status}</h3>
                        <div className={`mt-2 text-xs font-bold ${statusStyles.meta}`}>
                          {isExpanded ? "Showing issues for this status" : "Click to open issues"}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-start md:self-auto">
                        <span className={`rounded-full border px-4 py-2 text-sm font-bold ${statusStyles.badge}`}>
                          {group.count} {group.count === 1 ? "issue" : "issues"}
                        </span>
                        <span
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${statusStyles.badge}`}
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          >
                            <path d="m5 8 5 5 5-5" />
                          </svg>
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[1080px] border-collapse">
                          <thead className={statusStyles.tableHead}>
                            <tr>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">
                                Issue
                              </th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">
                                Last Comment Added By
                              </th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">
                                Latest Comment
                              </th>
                              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.22em]">
                                Updated
                              </th>
                              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.22em]">
                                Jira
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.issues.map((issue) => (
                              <tr
                                key={issue.key}
                                className={`border-t border-white/10 align-top transition ${statusStyles.row}`}
                              >
                                <td className="px-4 py-4">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <a
                                        href={issue.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`text-sm font-black tracking-[0.18em] transition ${statusStyles.key}`}
                                      >
                                        {issue.key}
                                      </a>
                                      <span
                                        className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${statusStyles.badge}`}
                                      >
                                        {issue.issueType || "Epic"}
                                      </span>
                                    </div>
                                    <h4 className="mt-3 text-base font-bold leading-6 text-white">
                                      {issue.summary}
                                    </h4>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm font-semibold text-white/88">
                                    {formatLastCommentAuthor(issue)}
                                  </div>
                                  <div className={`mt-1 text-xs font-bold ${statusStyles.meta}`}>
                                    {formatLastCommentTime(issue)}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                                    <div className={`text-xs font-bold ${statusStyles.meta}`}>
                                      {formatLastCommentMeta(issue)}
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/85">
                                      {renderCommentText(issue)}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm font-semibold text-white/80">
                                  {formatJiraDateTime(issue.updated)}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <a
                                    href={issue.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex rounded-full border px-4 py-2 text-sm font-bold transition ${statusStyles.action}`}
                                  >
                                    Open in Jira
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-5 text-sm font-semibold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
              {details?.emptyState || "No issues matched this Jira dashboard filter."}
            </div>
          )}
        </div>

        {details?.truncated && (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-50">
            Showing the first {details.visibleCount} issues. There are {details.totalCount} issues in total.
          </div>
        )}
      </section>
    </div>
  );
}

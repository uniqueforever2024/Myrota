import { useEffect, useState } from "react";
import {
  fetchJiraIssueDetails,
  formatJiraDateTime,
  formatJiraScheduleWindow,
} from "./api";

const detailShellClass =
  "rounded-[30px] border border-sky-200/15 bg-gradient-to-br from-slate-950/75 via-slate-900/65 to-white/[0.04] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.4)] backdrop-blur-2xl";

const DetailSkeleton = () => (
  <div className="grid gap-4">
    <div className="h-28 animate-pulse rounded-3xl bg-white/10" />
    <div className="h-28 animate-pulse rounded-3xl bg-white/10" />
    <div className="h-28 animate-pulse rounded-3xl bg-white/10" />
  </div>
);

export function JiraIssuesPage({ view }) {
  const [details, setDetails] = useState(null);
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

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-sky-100">
            {details?.title || "Jira Issue Details"}
          </h2>
          <p className="mt-2 text-sm text-slate-300/85">
            {details?.subtitle || "Loading the selected Jira issue list."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDetails({ silent: true })}
          className="self-start rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-bold text-white/85 backdrop-blur-md transition hover:border-sky-300/35 hover:bg-sky-400/10 hover:text-white"
        >
          {refreshing ? "Refreshing..." : "Refresh List"}
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
            <div className="text-xs font-black uppercase tracking-[0.24em] text-sky-100/65">
              Live Jira Feed
            </div>
            <div className="mt-3 text-4xl font-black text-white">
              {loading && !details ? "..." : details?.totalCount || 0}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-300/80">
              {details?.totalCount === 1 ? "issue found" : "issues found"}
            </div>
          </div>
          {details?.generatedAt && (
            <div className="text-sm font-medium text-slate-300/70">
              Updated {formatJiraDateTime(details.generatedAt)}
            </div>
          )}
        </div>

        <div className="mt-6">
          {loading && !details ? (
            <DetailSkeleton />
          ) : details?.issues?.length ? (
            <div className="grid gap-4">
              {details.issues.map((issue) => (
                <article
                  key={issue.key}
                  className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-black tracking-[0.18em] text-sky-200 transition hover:text-sky-100"
                        >
                          {issue.key}
                        </a>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                          {issue.status}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-bold text-white">{issue.summary}</h3>
                    </div>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-100 transition hover:border-sky-300/40 hover:bg-sky-400/16"
                    >
                      Open in Jira
                    </a>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Assignee
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/90">{issue.assignee}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Priority
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/90">{issue.priority}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Updated
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/90">
                        {formatJiraDateTime(issue.updated)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Schedule
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white/90">
                        {formatJiraScheduleWindow(issue)}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
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

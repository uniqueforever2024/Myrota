import { useEffect, useState } from "react";
import {
  fetchJiraSummary,
  formatJiraDateTime,
  formatJiraScheduleWindow,
} from "./api";

const countButtonBaseClass =
  "group rounded-2xl border px-4 py-4 text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.28)]";

const panelShellClass =
  "rounded-[28px] border p-6 shadow-[0_28px_90px_rgba(15,23,42,0.34)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1";

const SkeletonBlock = ({ className }) => (
  <div className={`animate-pulse rounded-2xl bg-white/10 ${className}`} />
);

const CountButton = ({ label, count, accentClassName, onClick }) => (
  <button type="button" className={`${countButtonBaseClass} ${accentClassName}`} onClick={onClick}>
    <div className="text-xs font-black uppercase tracking-[0.24em] text-white/70">{label}</div>
    <div className="mt-3 text-4xl font-black text-white">{count}</div>
    <div className="mt-2 text-sm font-semibold text-white/65 transition group-hover:text-white/85">
      Open details
    </div>
  </button>
);

export function JiraDashboardSection({ onOpenView }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const countOrUnavailable = (value) => (value ?? (error ? "--" : 0));

  const loadSummary = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchJiraSummary();
      setSummary(data);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load Jira dashboard right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <section className="space-y-6 rounded-[34px] border border-amber-200/20 bg-gradient-to-br from-amber-300/[0.10] via-yellow-200/[0.08] to-orange-300/[0.06] p-6 shadow-[0_30px_90px_rgba(245,158,11,0.16)] backdrop-blur-2xl md:p-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-sky-100">Jira Dashboard (Testing Phase)</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300/85">
            Live issue counts for EDI support, EDI mapping, and the tracked HCLCR change request queue.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadSummary({ silent: true })}
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

      <div className="grid gap-6 xl:grid-cols-2">
        <article
          className={`${panelShellClass} border-cyan-200/15 bg-gradient-to-br from-cyan-950/65 via-sky-950/45 to-white/[0.04]`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/65">
                EDI_MAPPING
              </div>
              <h3 className="mt-3 text-2xl font-extrabold text-cyan-50">Mapping Queue</h3>
              <p className="mt-2 text-sm text-cyan-100/75">Project EDI | In Progress stories and open epics</p>
            </div>
            <span className="rounded-full border border-cyan-200/15 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">
              Live
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {loading && !summary ? (
              <>
                <SkeletonBlock className="h-36 w-full" />
                <SkeletonBlock className="h-36 w-full" />
              </>
            ) : (
              <>
                <CountButton
                  label={summary?.mapping?.inProgress?.label || "In Progress"}
                  count={countOrUnavailable(summary?.mapping?.inProgress?.count)}
                  accentClassName="border-cyan-200/15 bg-cyan-400/10 hover:border-cyan-300/35 hover:bg-cyan-400/14"
                  onClick={() => onOpenView(summary?.mapping?.inProgress?.viewId)}
                />
                <CountButton
                  label={summary?.mapping?.openEpic?.label || "Open Epic"}
                  count={countOrUnavailable(summary?.mapping?.openEpic?.count)}
                  accentClassName="border-teal-200/15 bg-teal-400/10 hover:border-teal-300/35 hover:bg-teal-400/14"
                  onClick={() => onOpenView(summary?.mapping?.openEpic?.viewId)}
                />
              </>
            )}
          </div>
        </article>

        <article
          className={`${panelShellClass} border-violet-200/15 bg-gradient-to-br from-indigo-950/65 via-violet-950/45 to-white/[0.04]`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-violet-100/65">
                EDI_SUPPORT
              </div>
              <h3 className="mt-3 text-2xl font-extrabold text-violet-50">Support Queue</h3>
              <p className="mt-2 text-sm text-violet-100/75">HCLSM | Team HCL-EDI</p>
            </div>
            <span className="rounded-full border border-violet-200/15 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-violet-100">
              Live
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {loading && !summary ? (
              <>
                <SkeletonBlock className="h-36 w-full" />
                <SkeletonBlock className="h-36 w-full" />
              </>
            ) : (
              <>
                <CountButton
                  label={summary?.support?.inProgress?.label || "In Progress"}
                  count={countOrUnavailable(summary?.support?.inProgress?.count)}
                  accentClassName="border-violet-200/15 bg-violet-400/10 hover:border-violet-300/35 hover:bg-violet-400/14"
                  onClick={() => onOpenView(summary?.support?.inProgress?.viewId)}
                />
                <CountButton
                  label={summary?.support?.onHold?.label || "On Hold"}
                  count={countOrUnavailable(summary?.support?.onHold?.count)}
                  accentClassName="border-rose-200/15 bg-rose-400/10 hover:border-rose-300/35 hover:bg-rose-400/14"
                  onClick={() => onOpenView(summary?.support?.onHold?.viewId)}
                />
              </>
            )}
          </div>
        </article>
      </div>

      <article
        className={`${panelShellClass} border-amber-200/15 bg-gradient-to-br from-amber-950/65 via-orange-950/45 to-white/[0.04]`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-amber-100/65">
              CHANGE_REQUEST
            </div>
            <h3 className="mt-3 text-2xl font-extrabold text-amber-50">Assigned Change Requests</h3>
            <p className="mt-2 text-sm text-amber-100/75">HCLCR | Selected assignees and active statuses</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenView(summary?.changes?.viewId)}
            className="rounded-2xl border border-amber-200/20 bg-amber-400/10 px-4 py-3 text-left text-white transition hover:-translate-y-1 hover:border-amber-300/35 hover:bg-amber-400/14"
          >
            <div className="text-xs font-black uppercase tracking-[0.24em] text-amber-100/70">Tracked Queue</div>
            <div className="mt-2 text-3xl font-black text-amber-50">
              {loading && !summary ? "..." : countOrUnavailable(summary?.changes?.totalCount)}
            </div>
            <div className="mt-1 text-sm font-semibold text-amber-100/80">Open details</div>
          </button>
        </div>

        <div className="mt-6">
          {loading && !summary ? (
            <div className="grid gap-3">
              <SkeletonBlock className="h-24 w-full" />
              <SkeletonBlock className="h-24 w-full" />
            </div>
          ) : summary?.changes?.issues?.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {summary.changes.issues.map((issue) => (
                <button
                  key={issue.key}
                  type="button"
                  onClick={() => onOpenView(summary?.changes?.viewId)}
                  className="rounded-2xl border border-amber-100/15 bg-white/[0.07] px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-white/[0.1]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black tracking-[0.18em] text-amber-100">{issue.key}</span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                      {issue.status}
                    </span>
                  </div>
                  <div className="mt-3 line-clamp-2 text-base font-bold text-white">{issue.summary}</div>
                  <div className="mt-4 text-sm font-semibold text-amber-50/85">
                    {formatJiraScheduleWindow(issue)}
                  </div>
                  <div className="mt-2 text-xs font-medium text-amber-100/60">
                    Updated {formatJiraDateTime(issue.updated)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-100/15 bg-white/[0.06] px-4 py-4 text-sm font-semibold text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
              No change requests matched the selected Jira filter.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

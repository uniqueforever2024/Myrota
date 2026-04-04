// App.jsx — Blue Neon SaaS + Glass • Welcome Dashboard
// + Robust dropdowns + preserved scroll + admin-managed rota updates
// -----------------------------------------------------------------------------------
// What’s included:
// 1) Home opens directly with the live status dashboard.
// 2) Admin mode is available from the MyRota logo.
// 3) Employees have view-only access; admin can change shifts and leave on Dashboard.
// 4) Fix: native <select> menus no longer disappear (stopPropagation + stable DOM).
// 5) Fix: horizontal scroll position preserved per week on mobile (no jump to first day).
// 6) A shift = Blue, C shift = Yellow. Sticky employee column readable on mobile.
// -----------------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import myrotaLogo from "./myrotalogo.svg";
import "./App.css";
import { JiraDashboardSection } from "./jira/JiraDashboardSection";
import { JiraIssuesPage } from "./jira/JiraIssuesPage";

const BrandLogo = ({ className = "h-10 w-10" }) => (
  <img src={myrotaLogo} alt="MyRota logo" className={className} />
);
import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

// Excel export
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* ------------------ CONSTANTS ------------------ */
const BASE_YEAR = 2025;
const FULL_YEAR_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const BASE_YEAR_MONTHS = ["November", "December"];

const MONTH_INDEX = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

const getAvailableYears = (currentDate) => {
  const currentYear = currentDate.getFullYear();
  const includeNextYear = currentDate.getMonth() === MONTH_INDEX.December;
  const lastYear = currentYear + (includeNextYear ? 1 : 0);

  return Array.from(
    { length: Math.max(lastYear - BASE_YEAR + 1, 1) },
    (_, index) => BASE_YEAR + index
  );
};

const getMonthsForYear = (year) =>
  year === BASE_YEAR ? BASE_YEAR_MONTHS : FULL_YEAR_MONTHS;

const SHIFTS = [
  { code: "A", label: "Morning Shift (5AM - 12PM)" },
  { code: "B", label: "Normal Shift (12PM - 9PM)" },
  { code: "C", label: "Night Shift (10PM - 5AM)" },
  { code: "PL", label: "Personal Leave" },
  { code: "RH", label: "Restricted Holiday" },
  { code: "CH", label: "Company Holiday" },
  { code: "HD", label: "Half Day Leave (taken by Employee)" },
  { code: "WS", label: "Weekend Shift" },
  { code: "W",  label: "Weekend Off" },
];

// uniform badge size
const CELL = "w-16 h-8 text-center";

// Badge color map (A = Blue, C = Yellow)
const badgeColor = (code) => {
  const map = {
    A: `bg-blue-400 text-black ${CELL}`,
    B: `bg-white text-black border border-gray-400 ${CELL}`,
    C: `bg-yellow-300 text-black ${CELL}`,
    PL: `bg-red-700 text-white ${CELL}`,
    WS: `bg-green-600 text-white ${CELL}`,
    W:  `bg-sky-200 text-black ${CELL}`,
    RH: `bg-purple-300 text-black ${CELL}`,
    CH: `bg-purple-700 text-white ${CELL}`,
    HD: `bg-orange-400 text-black ${CELL}`,
  };
  return map[code] || `bg-gray-300 text-black ${CELL}`;
};

const WEEK_COLOR_CLASSES = [
  "week-pill-color-blue",
  "week-pill-color-green",
  "week-pill-color-yellow",
  "week-pill-color-red",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPLOYEE_NAME_REPLACEMENTS = {
  Asutosh: "Komal",
};

const getEmployeeDisplayName = (name) =>
  EMPLOYEE_NAME_REPLACEMENTS[name] ?? name;

const getPositionSortValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.MAX_SAFE_INTEGER;
};

const buildEmployeeList = (names) => {
  const orderedNames = [];
  names.map(getEmployeeDisplayName).forEach((name) => {
    if (!orderedNames.includes(name)) orderedNames.push(name);
  });

  return orderedNames;
};

const MONTH_NAMES = Object.keys(MONTH_INDEX);
const LEAVE_CODES = ["PL", "CH", "RH", "HD"];

/* ------------------ Helpers ------------------ */
const getKey = (year, month, week, emp, day) =>
  `${year}-${month}-${week}-${emp}-${day}`;

const getDefaultShift = (dayLabel) =>
  ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(dayLabel) ? "B" : "W";

/* ✅ IST utilities */
const IST = "Asia/Kolkata";
const todayIST = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
};
const fmtIST = (d) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);

/* ✅ Calendar generator */
function generateWeeks(year, month) {
  const monthIndex = MONTH_INDEX[month];
  const firstDate = new Date(year, monthIndex, 1);
  const toMonIndex = (d) => (d + 6) % 7;
  const weeks = [];
  let cursor = new Date(firstDate);

  const firstWeek = [];
  for (let p = 0; p < toMonIndex(firstDate.getDay()); p++)
    firstWeek.push({ isPadding: true });

  while (firstWeek.length < 7 && cursor.getMonth() === monthIndex) {
    firstWeek.push({
      label: WEEKDAYS[toMonIndex(cursor.getDay())],
      day: cursor.getDate(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  weeks.push(firstWeek);

  while (cursor.getMonth() === monthIndex) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      if (cursor.getMonth() !== monthIndex) break;
      week.push({
        label: WEEKDAYS[toMonIndex(cursor.getDay())],
        day: cursor.getDate(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    while (week.length < 7) week.push({ isPadding: true });
    weeks.push(week);
  }
  return weeks;
}

/* ------------------ MAIN APP ------------------ */
export default function App() {
  const prefersDark = true; // default dark
  const [page, setPage] = useState("home"); // home | dashboard | logs | report | notifications | jira-details
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode] = useState(prefersDark);

  // Simple nav history stack to support Back
  const navStackRef = useRef(["home"]);
  useEffect(() => {
    const stack = navStackRef.current;
    if (stack[stack.length - 1] !== page) {
      stack.push(page);
      if (stack.length > 100) stack.shift();
    }
  }, [page]);

  // Auto-set dropdown defaults (IST)
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const currentYear = istNow.getFullYear();
  const currentMonthName = FULL_YEAR_MONTHS[istNow.getMonth()];
  const YEARS = getAvailableYears(istNow);
  const defaultYear = YEARS.includes(currentYear) ? currentYear : YEARS[0];
  const defaultMonth = getMonthsForYear(defaultYear).includes(currentMonthName)
    ? currentMonthName
    : getMonthsForYear(defaultYear)[0];

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Ensure favicon uses branded SVG both in dev and build
  useEffect(() => {
    const ensureFavicon = (rel) => {
      let link = document.querySelector(`link[rel='${rel}']`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        document.head.appendChild(link);
      }
      link.setAttribute("type", "image/svg+xml");
      link.setAttribute("href", myrotaLogo);
    };
    ensureFavicon("icon");
    ensureFavicon("apple-touch-icon");
  }, []);

  // Firestore state
  const [EMPLOYEES, setEMPLOYEES] = useState([]);
  const [employeeView, setEmployeeView] = useState(null);
  const [rota, setRota] = useState({});
  const weeks = useMemo(
    () => generateWeeks(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [isWholeMonthView, setIsWholeMonthView] = useState(false);

  // Scroll preservation for each week's overflow container
  const scrollRefs = useRef({});     // { [weekIndex]: HTMLElement }

  // Prevent auto-collapsing while native select is open
  const [isPicking, setIsPicking] = useState(false);

  const rememberScroll = (weekIndex, el) => {
    if (!el) return;
    scrollRefs.current[weekIndex] = el;
  };

  const isPickingRef = useRef(false);
  useEffect(() => { isPickingRef.current = isPicking; }, [isPicking]);
  const lastRotaRef = useRef({});

  useEffect(() => {
    if (!weeks.length) return;
    const today = todayIST();
    if (
      today.getFullYear() === selectedYear &&
      today.getMonth() === MONTH_INDEX[selectedMonth]
    ) {
      const todayDate = today.getDate();
      const foundIndex = weeks.findIndex((week) =>
        week.some((cell) => cell && !cell.isPadding && cell.day === todayDate)
      );
      setActiveWeekIndex(foundIndex >= 0 ? foundIndex : 0);
    } else {
      setActiveWeekIndex(0);
    }
    setIsWholeMonthView(false);
  }, [weeks, selectedYear, selectedMonth]);

  // Admin login modal fields
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState("");

  const [logs, setLogs] = useState([]);
  const [finalReport, setFinalReport] = useState([]);
  const [adminSettings, setAdminSettings] = useState(null);
  const [jiraDetailView, setJiraDetailView] = useState(null);

  /* ✅ LISTEN: employees + rota */
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const sortedUserIds = snap.docs
        .map((userDoc) => ({
          id: userDoc.id,
          position: getPositionSortValue(userDoc.data()?.position),
        }))
        .sort((left, right) => {
          if (left.position !== right.position) return left.position - right.position;
          return left.id.localeCompare(right.id);
        })
        .map((user) => user.id);

      const names = buildEmployeeList(sortedUserIds);
      setEMPLOYEES(names);
    });

    const unsubRota = onSnapshot(doc(db, "rota", "master"), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      lastRotaRef.current = data || {};
      if (!isPickingRef.current) {
        setRota(lastRotaRef.current);
      }
    });

    return () => {
      unsubUsers && unsubUsers();
      unsubRota && unsubRota();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    const adminRef = doc(db, "config", "admin");
    const unsub = onSnapshot(adminRef, (snap) => {
      setAdminSettings(snap.exists() ? snap.data() : null);
    });
    return () => unsub && unsub();
  }, []);

  // When select closes, reconcile latest snapshot
  useEffect(() => {
    if (!isPicking) setRota(lastRotaRef.current || {});
  }, [isPicking]);

  /* ✅ Subscribe logs when admin is on logs */
  useEffect(() => {
    if (!(isAdmin && page === "logs")) return;
    const qLogs = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(qLogs, (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setLogs(rows);
    });
    return () => unsub && unsub();
  }, [isAdmin, page]);

  /* ✅ Admin update (preserve leave) + log */
  const updateShift = async (emp, week, day, code) => {
    const key = getKey(selectedYear, selectedMonth, week, emp, day);
    const defaultShift = getDefaultShift(WEEKDAYS[day]);
    const stored = rota[key];

    const prevShift =
      typeof stored === "object" ? stored?.shift ?? defaultShift : stored ?? defaultShift;
    const prevLeave =
      typeof stored === "object" ? stored?.leave ?? null : null;

    const nextVal = { shift: code, leave: prevLeave };

    setRota((prev) => ({ ...prev, [key]: nextVal }));
    await setDoc(doc(db, "rota", "master"), { [key]: nextVal }, { merge: true });

    if (prevShift !== code) {
      try {
        const dayNum = weeks[week][day]?.day;
        const dateObj = new Date(selectedYear, MONTH_INDEX[selectedMonth], dayNum);
        const dateText = dateObj.toLocaleDateString(undefined, {
          year: "numeric", month: "short", day: "numeric",
        });
        await addDoc(collection(db, "logs"), {
          timestamp: serverTimestamp(),
          employee: EMPLOYEES[emp],
          year: selectedYear,
          month: selectedMonth,
          day: dayNum,
          week,
          weekDay: WEEKDAYS[day],
          date: dateText,
          shiftBefore: prevShift,
          shiftAfter: code,
          leaveApplied: prevLeave,
          action: `Shift changed ${prevShift} → ${code}`,
        });
      } catch (e) {
        console.error("Failed to write shift-change log:", e);
      }
    }
  };

  /* Auto-collapse weeks */
  /* NAV */
  const goHome = () => {
    setEmployeeView(null);
    setJiraDetailView(null);
    setPage("home");
  };

  const openJiraDetailView = (viewId) => {
    if (!viewId) return;
    setEmployeeView(null);
    setJiraDetailView(viewId);
    setPage("jira-details");
  };

  const handleLogoClick = () => {
    if (isAdmin) {
      goHome();
      return;
    }
    setAdminPass("");
    setShowAdminModal(true);
  };

  const goBack = () => {
    const stack = navStackRef.current;
    if (stack.length > 1) {
      // Pop current and navigate to previous
      stack.pop();
      const prev = stack[stack.length - 1] || "home";
      setPage(prev);
    } else {
      setPage("home");
    }
  };

  /* Report build */
  const rebuildReport = () => {
    const report = [];
    weeks.forEach((week, weekIndex) => {
      week.forEach((cell, dayIndex) => {
        if (cell.isPadding) return;
        EMPLOYEES.forEach((emp, empIndex) => {
          const key = getKey(selectedYear, selectedMonth, weekIndex, empIndex, dayIndex);
          const stored = rota[key];
          const defaultShift = getDefaultShift(WEEKDAYS[dayIndex]);
          const realShift = typeof stored === "object"
            ? (stored?.shift ?? defaultShift)
            : (stored ?? defaultShift);
          if (realShift === "C" || realShift === "WS") {
            const dateStr = `${String(cell.day).padStart(2, "0")}-${selectedMonth}-${selectedYear}`;
            report.push({
              employee: emp,
              shift: realShift,
              date: dateStr,
              day: WEEKDAYS[dayIndex],
            });
          }
        });
      });
    });
    setFinalReport(report);
  };

  useEffect(() => {
    if (page === "report") rebuildReport();
  }, [page, rota, selectedYear, selectedMonth, EMPLOYEES]); // eslint-disable-line

  const exportReportAsExcel = () => {
    const reportData = finalReport.map((r, index) => ({
      "S.No": index + 1,
      Date: r.date,
      Day: r.day,
      Employee: r.employee,
      Shift: r.shift,
    }));

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([excelBuffer]), `Shift_Report_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const toUpperCode = (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : undefined;

  const isLeaveCode = (value) => LEAVE_CODES.includes(toUpperCode(value));
  const isShiftCode = (value) => ["A", "B", "C", "WS", "W"].includes(toUpperCode(value));

  const getMonthNameFromDate = (date) =>
    MONTH_NAMES.find((month) => MONTH_INDEX[month] === date.getMonth());

  const getCalendarPosition = (date) => {
    const year = date.getFullYear();
    const monthName = getMonthNameFromDate(date);
    if (!monthName) return null;

    const calendar = generateWeeks(year, monthName);
    const dayNum = date.getDate();
    let weekIndex = -1;
    let dayIndex = -1;

    outer: for (let week = 0; week < calendar.length; week++) {
      for (let day = 0; day < 7; day++) {
        const cell = calendar[week][day];
        if (cell && !cell.isPadding && cell.day === dayNum) {
          weekIndex = week;
          dayIndex = day;
          break outer;
        }
      }
    }

    if (weekIndex < 0 || dayIndex < 0) return null;

    const weekdayLabel = date
      .toLocaleDateString("en-US", { weekday: "short", timeZone: IST })
      .slice(0, 3);
    const dayLabel = WEEKDAYS.includes(weekdayLabel) ? weekdayLabel : WEEKDAYS[dayIndex];

    return {
      year,
      monthName,
      weekIndex,
      dayIndex,
      dayLabel,
      defaultShift: getDefaultShift(dayLabel),
    };
  };

  const getDayAssignment = ({ year, monthName, weekIndex, dayIndex, defaultShift, emp, empIndex }) => {
    const keyByName = getKey(year, monthName, weekIndex, emp, dayIndex);
    const keyByIndex = getKey(year, monthName, weekIndex, empIndex, dayIndex);
    const stored = rota[keyByName] !== undefined ? rota[keyByName] : rota[keyByIndex];
    const isObj = typeof stored === "object" && stored !== null;
    const raw = !isObj && typeof stored === "string" ? stored : undefined;
    const leaveApplied = isObj
      ? toUpperCode(
          (isLeaveCode(stored?.leave) && stored?.leave) ||
          (isLeaveCode(stored?.leaveApplied) && stored?.leaveApplied) ||
          (isLeaveCode(stored?.shift) && stored?.shift) ||
          undefined
        )
      : (raw && isLeaveCode(raw) ? toUpperCode(raw) : undefined);
    const realShift = isObj
      ? toUpperCode(stored?.shift ?? defaultShift)
      : (raw && isShiftCode(raw) ? toUpperCode(raw) : toUpperCode(defaultShift));

    return { leaveApplied, realShift };
  };

  const getLeaveEntriesForDate = (date) => {
    const position = getCalendarPosition(date);
    if (!position) return [];

    const leaveEntries = [];

    (EMPLOYEES || []).forEach((emp, empIndex) => {
      const { leaveApplied } = getDayAssignment({ ...position, emp, empIndex });
      if (LEAVE_CODES.includes(leaveApplied)) {
        leaveEntries.push(emp);
      }
    });

    if (leaveEntries.length === 0) {
      try {
        Object.entries(rota || {}).forEach(([key, value]) => {
          const parts = (key || "").split("-");
          if (parts.length < 5) return;

          const [yy, mm, wk, empPart, dy] = parts;
          if (String(yy) !== String(position.year) || String(mm) !== String(position.monthName)) return;
          if (Number(wk) !== Number(position.weekIndex) || Number(dy) !== Number(position.dayIndex)) return;

          const leaveCode = typeof value === "object" && value !== null
            ? toUpperCode(value?.leave)
            : toUpperCode(value);

          if (!isLeaveCode(leaveCode)) return;

          const empName = Number.isNaN(Number(empPart))
            ? getEmployeeDisplayName(empPart)
            : (EMPLOYEES[Number(empPart)] || String(empPart));

          if (!leaveEntries.includes(empName)) leaveEntries.push(empName);
        });
      } catch {}
    }

    return leaveEntries;
  };

  /* AUTH */
  const handleAdminLogin = async () => {
    const typed = adminPass.trim();
    if (!typed) {
      alert("Please enter password");
      return;
    }
    let configured =
      typeof adminSettings?.password === "string" && adminSettings.password.trim().length
        ? adminSettings.password.trim()
        : null;
    if (!configured) {
      try {
        const adminUserSnap = await getDoc(doc(db, "users", "admin"));
        if (adminUserSnap.exists()) {
          const adminDocData = adminUserSnap.data();
          if (typeof adminDocData?.password === "string" && adminDocData.password.trim().length) {
            configured = adminDocData.password.trim();
          }
        }
      } catch (err) {
        console.error("Failed to read admin user password fallback:", err);
      }
    }
    if (!configured) {
      alert("Admin password is not configured. Add it under config/admin or users/admin.");
      return;
    }
    if (typed === configured) {
      setIsAdmin(true);
      setPage("dashboard");
      setShowAdminModal(false);
      setAdminPass("");
    } else {
      alert("Incorrect password");
    }
  };
  /* ------------------ RENDERERS ------------------ */
  const TopNav = (
    <div className="flex items-center gap-3 md:gap-6 top-nav-actions">
      <div className="nav-featured-item">
        <span className="nav-feature-ribbon">NEW</span>
        <button
          onClick={() => setPage("dashboard")}
          title="ROTA"
          className={`nav-rota-button rounded-xl px-3 py-2 text-xs font-black tracking-[0.24em] transition md:text-sm ${
            page === "dashboard"
              ? "nav-rota-button--active"
              : "nav-rota-button--idle"
          }`}
        >
          ROTA
        </button>
      </div>

      {/* REPORT */}
      <button
        onClick={() => setPage("report")}
        title="ONCALL"
        className={`rounded-xl px-3 py-2 text-xs font-black tracking-[0.24em] transition md:text-sm ${
          page === "report"
            ? "btn-glass text-white"
            : "glass-chip hover:scale-105"
        }`}
      >
        ONCALL
      </button>

      {/* LOGS (admin only) */}
      {isAdmin && (
        <button
          onClick={() => setPage("logs")}
          title="Logs"
          className="text-2xl hover:scale-110 transition text-white/90"
        >
          📄
        </button>
      )}

      {/* HOME (white) */}
      <button
        onClick={goHome}
        title="Home"
        className="text-2xl hover:scale-110 transition text-white"
      >
        🏠
      </button>
    </div>
  );

  const DashboardHeader = (
    <div className="flex flex-col gap-3 mb-6">
      <h2 className="text-2xl font-normal text-white tracking-wide" style={{ fontFamily: "Arial, sans-serif" }}>
        ROTA {selectedMonth} {selectedYear}
      </h2>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex-1 min-w-[260px]">
          <div className="week-pill-row w-full">
            <div className="week-pill-row-inner">
              {weeks.map((_, idx) => {
                const isActive = !isWholeMonthView && idx === activeWeekIndex;
                const weekLabel = `Week ${idx + 1}`;
                const shortLabel = `W${idx + 1}`;
                return (
                  <button
                    type="button"
                    key={`week-pill-${idx}`}
                    aria-pressed={isActive}
                    className={`week-pill ${
                      isActive ? "week-pill--active week-pill--active-week" : "week-pill--inactive"
                    } ${WEEK_COLOR_CLASSES[idx % WEEK_COLOR_CLASSES.length]}`}
                    onClick={() => {
                      setIsWholeMonthView(false);
                      setActiveWeekIndex(idx);
                    }}
                  >
                    <span className="hidden sm:inline">{weekLabel}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`week-pill week-pill--whole ${isWholeMonthView ? "week-pill--active" : "week-pill--inactive"}`}
                onClick={() => setIsWholeMonthView(true)}
              >
                <span className="hidden sm:inline">Whole Month</span>
                <span className="sm:hidden">WM</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-nowrap overflow-x-auto pb-1">
          <select
            className="px-4 py-2 rounded-lg text-white bg-slate-900/60 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400 shrink-0"
            value={selectedYear}
            onChange={(e) => {
              const yr = Number(e.target.value);
              setSelectedYear(yr);
              setSelectedMonth(getMonthsForYear(yr)[0]);
            }}
          >
            {YEARS.map((yr) => (
              <option key={yr} value={yr} className="text-black">
                {yr}
              </option>
            ))}
          </select>

          <select
            className="px-4 py-2 rounded-lg text-white bg-slate-900/60 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400 shrink-0"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {getMonthsForYear(selectedYear).map((m) => (
              <option key={m} value={m} className="text-black">
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const GlassCard = ({ children, weekIndex }) => (
    <div className="mb-8 p-4 rounded-2xl bg-white/[0.04] border border-white/10 shadow-xl glass">
      <div
        ref={(el) => rememberScroll(weekIndex ?? -1, el)}
        className="overflow-x-auto overflow-y-visible relative"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>
    </div>
  );

  const WeekCard = ({ week, weekIndex }) => {
    if (!week) return null;
    const firstActiveDay = week.find((cell) => !cell.isPadding)?.day ?? "-";
    const lastActiveDay = [...week].reverse().find((cell) => !cell.isPadding)?.day ?? "-";

    return (
      <GlassCard weekIndex={weekIndex}>
        <div className="week-card-header mb-4 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-2xl font-black text-sky-200 drop-shadow">Week {weekIndex + 1}</h3>
          <span className="week-range-badge text-sm text-white/80">
            {selectedMonth} {firstActiveDay} - {selectedMonth} {lastActiveDay}
          </span>
        </div>

        <table className="week-table min-w-full w-max text-center border-collapse text-sm whitespace-nowrap">
          <thead className="sticky top-0 z-[110]">
                <tr className="week-head-row text-sky-100 font-bold">
                  <th className="sticky-name sticky left-0 top-0 text-left min-w-[160px]">
                    Employee
                  </th>
                  {WEEKDAYS.map((wd, idx) => (
                    <th key={idx} className="week-head-cell min-w-[64px] sticky top-0 z-[120]">
                      {wd} {week[idx]?.day ?? ""}
                    </th>
                  ))}
                </tr>
          </thead>

          <tbody>
            {EMPLOYEES.map((emp, empIndex) => (
              <tr key={emp} className="even:bg-white/[0.02] odd:bg-white/[0.04]">
                <td
                  className="sticky-name cursor-pointer"
                  onClick={() => setEmployeeView(empIndex)}
                >
                  <span className="sticky-pill">{emp}</span>
                </td>

                {week.map((cell, dayIndex) =>
                  cell.isPadding ? (
                    <td key={dayIndex} className="p-1">
                      <span className={`inline-flex opacity-30 ${badgeColor("")}`} />
                    </td>
                  ) : (
                    <td key={dayIndex} className="p-1 min-w-[64px]">
                      {(() => {
                        const defaultShift = getDefaultShift(WEEKDAYS[dayIndex]);
                        const key = getKey(selectedYear, selectedMonth, weekIndex, empIndex, dayIndex);
                        const stored = rota[key];

                        const realShift =
                          typeof stored === "object" ? stored?.shift ?? defaultShift : stored ?? defaultShift;
                        const leaveApplied = typeof stored === "object" ? stored?.leave : undefined;
                        const displayCodeForColor = leaveApplied ?? realShift;
                        const displayText = leaveApplied ? leaveApplied : realShift;
                        const adminTextColor = displayCodeForColor === "B" ? "text-black" : "text-white";

                        return isAdmin ? (
                          <div className={`${badgeColor(displayCodeForColor)} rounded-md relative z-20 overflow-hidden`}>
                            <select
                              value={realShift}
                              className={`appearance-none w-full h-full bg-transparent text-xs font-extrabold tracking-wide text-center cursor-pointer py-1 pr-5 focus:text-slate-900 focus:bg-white focus:rounded-md focus:outline-none ${adminTextColor}`}
                              onFocus={() => setIsPicking(true)}
                              onBlur={() => setTimeout(() => setIsPicking(false), 200)}
                              onChange={(e) => updateShift(empIndex, weekIndex, dayIndex, e.target.value)}
                              style={{ WebkitAppearance: "none" }}
                            >
                              {SHIFTS.map((s) => (
                                <option key={s.code} value={s.code} title={s.label}>
                                  {s.code}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-1 top-1 text-[10px] opacity-80">
                              v
                            </span>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold ${badgeColor(displayCodeForColor)}`}>
                            {displayText}
                          </span>
                        );
                      })()}
                    </td>
                  )
                )}
              </tr>
            ))}
            {EMPLOYEES.length === 0 && (
              <tr>
                <td className="p-4 text-left text-white/70" colSpan={8}>
                  No employees yet. Add docs under <b>users</b> collection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    );
  };

  const WeeksTableAllEmployees = (() => {
    if (!weeks.length) return null;
    const safeActiveWeek = Math.min(activeWeekIndex, weeks.length - 1);
    const activeWeek = weeks[safeActiveWeek];
    const legend = (
      <GlassCard weekIndex={-1}>
        <h3 className="text-xl font-extrabold mb-4 text-sky-200">Shift Definitions</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="font-bold text-sky-100 bg-sky-700/30">
              <th className="p-2">Code</th>
              <th className="p-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map(({ code, label }) => (
              <tr key={code} className="border-b border-white/10">
                <td className="p-2">
                  <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold ${badgeColor(code)}`}>
                    {code}
                  </span>
                </td>
                <td className="p-2 text-white/90">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    );

    return (
      <>
        {isWholeMonthView
          ? weeks.map((week, idx) => <WeekCard key={`week-card-${idx}`} week={week} weekIndex={idx} />)
          : <WeekCard week={activeWeek} weekIndex={safeActiveWeek} key={`week-card-${safeActiveWeek}`} />}
        {legend}
      </>
    );
  })();

  /* LOGS PAGE */
  const LogsPage = (
    <div className="p-6 pb-20">
      <h2 className="text-4xl font-extrabold mb-6 flex items-center gap-3 text-sky-200">
        📄 Change Logs
      </h2>

      <div className="rounded-2xl bg-white/[0.04] border border-white/10 shadow-xl p-4 overflow-x-auto glass">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-700/40 to-sky-700/40 text-sky-100 font-bold">
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Weekday</th>
              <th className="p-2 text-left">Shift (before→after)</th>
              <th className="p-2 text-left">Leave</th>
              <th className="p-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.id} className="border-b border-white/10 text-white/90">
                <td className="p-2">
                  {row.timestamp?.toDate ? fmtIST(row.timestamp.toDate()) : "—"}
                </td>
                <td className="p-2">{row.employee}</td>
                <td className="p-2">{row.date}</td>
                <td className="p-2">{row.weekDay}</td>
                <td className="p-2">
                  {row.shiftAfter ? `${row.shiftBefore} → ${row.shiftAfter}` : row.shiftBefore ?? "—"}
                </td>
                <td className="p-2">{row.leaveApplied ?? "—"}</td>
                <td className="p-2">{row.action}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="p-4 text-center text-white/70" colSpan={7}>
                  No logs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* REPORT PAGE */
  const ReportPage = (
    <div className="p-6 pb-20">
      <h2 className="text-4xl font-extrabold mb-6 flex items-center gap-3 text-sky-200">
        📞 ON CALL ROTA
      </h2>

      <div className="rounded-2xl bg-white/[0.04] border border-white/10 shadow-xl p-4 overflow-x-auto glass">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-700/40 to-sky-700/40 text-sky-100 font-bold">
              <th className="p-2 text-left">S.No</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Day</th>
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Shift</th>
            </tr>
          </thead>
          <tbody>
            {finalReport.map((r, i) => (
              <tr key={`${r.date}-${r.employee}-${i}`} className="border-b border-white/10 text-white/90">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.day}</td>
                <td className="p-2">{r.employee}</td>
                <td className="p-2">{r.shift}</td>
              </tr>
            ))}
            {finalReport.length === 0 && (
              <tr>
                <td className="p-4 text-center text-white/70" colSpan={5}>
                  No C/WS shifts found for {selectedMonth} {selectedYear}.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <button onClick={exportReportAsExcel} className="btn-primary" title="Export as Excel">
            ⬇ Export as Excel
          </button>
        </div>
      </div>
    </div>
  );

  /* NOTIFICATIONS PANEL */
  const NotificationsPanel = (() => {
    const today = todayIST();
    const currentPosition = getCalendarPosition(today);
    if (!currentPosition) return null;

    const { year, monthName, weekIndex, dayIndex, dayLabel, defaultShift } = currentPosition;
    const isWeekend = dayLabel === "Sat" || dayLabel === "Sun";
    const onLeave = [];
    const wsAvailable = [];
    const shiftA = [];
    const shiftC = [];

    (EMPLOYEES || []).forEach((emp, empIndex) => {
      const { leaveApplied, realShift } = getDayAssignment({
        year,
        monthName,
        weekIndex,
        dayIndex,
        defaultShift,
        emp,
        empIndex,
      });
      if (LEAVE_CODES.includes(leaveApplied)) {
        onLeave.push(emp);
        return; // skip shift buckets if on leave
      }
      if (realShift === 'A') shiftA.push(emp);
      if (realShift === 'C') shiftC.push(emp);
      if (isWeekend && realShift === 'WS') wsAvailable.push(emp);
    });

    // Fallback: scan rota keys directly in case of mismatched key format
    if (onLeave.length === 0) {
      try {
        Object.entries(rota || {}).forEach(([k, v]) => {
          const parts = (k || '').split('-');
          if (parts.length < 5) return;
          const [yy, mm, wk, empPart, dy] = parts;
          if (String(yy) !== String(year) || String(mm) !== String(monthName)) return;
          if (Number(wk) !== Number(weekIndex) || Number(dy) !== Number(dayIndex)) return;
          const isObj = typeof v === 'object' && v !== null;
          const raw = !isObj && typeof v === 'string' ? v : undefined;
          const leaveCode = isObj ? toUpperCode(v?.leave) : toUpperCode(raw);
          if (isLeaveCode(leaveCode)) {
            const empName = isNaN(Number(empPart))
              ? getEmployeeDisplayName(empPart)
              : (EMPLOYEES[Number(empPart)] || String(empPart));
            if (!onLeave.includes(empName)) onLeave.push(empName);
          }
        });
      } catch {}
    }

    const dateText = today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const todayShiftDetails = (EMPLOYEES || []).flatMap((emp, empIndex) => {
      const { leaveApplied, realShift } = getDayAssignment({
        year,
        monthName,
        weekIndex,
        dayIndex,
        defaultShift,
        emp,
        empIndex,
      });
      if (LEAVE_CODES.includes(leaveApplied)) return [];
      if (!(realShift === 'A' || realShift === 'C')) return [];
      const friendly = realShift === 'A' ? 'morning shift' : 'night shift';
      return [{
        key: emp,
        message: `${emp} will do the ${friendly} today (Shift ${realShift}).`,
      }];
    });

    const statusItemClass = "rounded-xl border border-emerald-100/15 bg-white/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl";

    return (
      <div className="rounded-2xl border border-emerald-200/15 bg-gradient-to-br from-emerald-950/50 via-green-950/30 to-white/[0.03] shadow-[0_22px_60px_rgba(6,78,59,0.32)] p-6 glass transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(6,95,70,0.38)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-emerald-200/80 text-sm">{dateText} (IST)</div>
          <span className="rounded-full border border-emerald-200/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-100 backdrop-blur-md">
            Live Team Status
          </span>
        </div>
        <div className="space-y-2 sm:space-y-3 text-emerald-50">
          {(onLeave.length > 0 || !isWeekend) && (
            <div className={statusItemClass}>
              {onLeave.length > 0 ? (
                <span className="font-semibold">
                  {onLeave.join(', ')} {onLeave.length > 1 ? 'are' : 'is'} on leave today
                </span>
              ) : (
                <span className="font-semibold">Your whole team is working today no one is on leave</span>
              )}
            </div>
          )}

          {shiftA.length > 0 && (
            <div className={statusItemClass}>
              {shiftA.map((emp) => (
                <div key={`A-${emp}`} className="text-sm font-semibold">{emp} is doing morning shift today</div>
              ))}
            </div>
          )}

          {shiftC.length > 0 && (
            <div className={statusItemClass}>
              {shiftC.map((emp) => (
                <div key={`C-${emp}`} className="text-sm font-semibold">{emp} is doing night shift today</div>
              ))}
            </div>
          )}

          {isWeekend && wsAvailable.length > 0 && (
            <div className={statusItemClass}>
              {wsAvailable.map((emp) => (
                <div key={`WS-${emp}`} className="text-sm font-semibold">{emp} is available on weekend</div>
              ))}
            </div>
          )}

          {todayShiftDetails.length > 0 && (
            <div className={statusItemClass}>
              {todayShiftDetails.map(({ key, message }) => (
                <div key={key} className="text-sm font-semibold">
                  {message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  })();

  const LeavePlanPanel = (() => {
    const today = todayIST();
    const leavePlanItems = [1, 2, 3].flatMap((offset) => {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + offset);

      const relativeLabel = offset === 1
        ? "tomorrow"
        : offset === 2
          ? "day after tomorrow"
          : "in 3 days";
      const dateLabel = targetDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return getLeaveEntriesForDate(targetDate).map((employee) => ({
        key: `${offset}-${employee}`,
        message: `${employee} is on leave ${relativeLabel} (${dateLabel})`,
      }));
    });

    return (
      <div className="rounded-2xl border border-rose-200/15 bg-gradient-to-br from-rose-950/55 via-red-950/35 to-white/[0.03] shadow-[0_22px_60px_rgba(127,29,29,0.35)] p-6 glass transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_72px_rgba(127,29,29,0.42)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-2xl font-extrabold text-rose-100">Leave Plan</h3>
          <span className="rounded-full border border-rose-200/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-rose-100 backdrop-blur-md">
            Next 3 Days
          </span>
        </div>
        <div className="space-y-2 text-rose-50">
          {leavePlanItems.length > 0 ? (
            leavePlanItems.map(({ key, message }) => (
              <div
                key={key}
                className="rounded-xl border border-rose-100/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
              >
                {message}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-rose-100/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
              No leave planned for the next 3 days.
            </div>
          )}
        </div>
      </div>
    );
  })();

  const NotificationsPage = (
    <div className="p-6 pb-20">
      <h2 className="text-4xl font-extrabold mb-6 flex items-center gap-3 text-sky-200">Notifications</h2>
      {NotificationsPanel}
    </div>
  );

  const HomePage = (
    <div className="pb-20">
      <section className="mb-8">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-sky-200">What about Today?</h2>
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
          <div className="min-w-0">
            {NotificationsPanel}
          </div>
          <div className="min-w-0">
            {LeavePlanPanel}
          </div>
        </div>
      </section>

      <section>
        <JiraDashboardSection onOpenView={openJiraDetailView} />
      </section>
    </div>
  );

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        {/* HEADER */}
        <header className="sticky top-0 z-40 px-4 py-3 flex justify-between items-center glass-nav">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleLogoClick} title={isAdmin ? "Back to home" : "Open admin mode"}>
            <BrandLogo className="h-10 w-10 md:h-11 md:w-11 drop-shadow" />
            <h1 className="text-3xl font-black tracking-wide logo-title">
              My<span className="logo-blue">R</span>
              <span className="logo-green">o</span>
              <span className="logo-yellow">t</span>
              <span className="logo-red">a</span>+
            </h1>
          </div>
          {TopNav}
        </header>

        <main className="flex-grow px-4 md:px-6 lg:px-10 py-8">
          {/* Back button below navbar (not on dashboard) */}
          {["dashboard", "report", "logs", "notifications", "jira-details"].includes(page) && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={goBack}
                className="glass-chip px-3 py-2 rounded-lg text-sm font-bold"
                title="Back"
              >
                ⬅️ Back
              </button>
            </div>
          )}

          {/* HOME */}
          {page === "home" && HomePage}

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <div className="pb-20">
              {DashboardHeader}
              {WeeksTableAllEmployees}
            </div>
          )}

          {/* LOGS */}
          {page === "logs" && isAdmin && LogsPage}

          {/* NOTIFICATIONS */}
          {page === "notifications" && NotificationsPage}

          {/* REPORT */}
          {page === "report" && ReportPage}

          {/* JIRA ISSUE DETAILS */}
          {page === "jira-details" && <JiraIssuesPage view={jiraDetailView} />}

          {/* ADMIN LOGIN MODAL (landing -> Admin) */}
          {showAdminModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="rounded-2xl shadow-2xl text-white p-6 w-full max-w-md border border-white/15 bg-slate-900/80 backdrop-blur">
                <h2 className="text-2xl font-extrabold mb-4 text-sky-200">Admin Login</h2>

                <label className="block text-sm font-semibold mb-1">Username</label>
                <input
                  type="text"
                  className="w-full rounded-lg p-2 mb-4 bg-slate-800/80 ring-1 ring-white/10 text-gray-300"
                  value="admin"
                  readOnly
                />

                <label className="block text-sm font-semibold mb-1">Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg p-2 bg-slate-800/80 ring-1 ring-white/10"
                  placeholder="Enter admin password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdminLogin(); } }}
                />

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 rounded-lg glass-chip"
                    onClick={() => { setShowAdminModal(false); setAdminPass(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleAdminLogin}
                  >
                    Login
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EMPLOYEE VIEW MODAL */}
          {employeeView !== null && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-xl text-black p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">
                  {EMPLOYEES[employeeView]}'s Plan — {selectedMonth} {selectedYear}
                </h2>

                <table className="plan-table w-full text-sm">
                  <thead>
                    <tr className="font-bold bg-gray-200">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Day</th>
                      <th className="p-2 text-left">Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.flat().map((cell, i) => {
                      if (cell.isPadding) return null;
                      const week = Math.floor(i / 7);
                      const day = i % 7;
                      const defaultShift = getDefaultShift(WEEKDAYS[day]);
                      const key = getKey(selectedYear, selectedMonth, week, employeeView, day);
                      const stored = rota[key];
                      const realShift = typeof stored === "object" ? stored?.shift ?? defaultShift : stored ?? defaultShift;
                      const leaveApplied = typeof stored === "object" ? stored?.leave : undefined;
                      const display = leaveApplied ? leaveApplied : realShift;
                      const colorCode = leaveApplied ?? realShift;

                      return (
                        <tr key={i} className="border-b">
                          <td className="p-2">{cell.day}</td>
                          <td className="p-2">{cell.label}</td>
                          <td className="p-2 font-bold">
                            <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold ${badgeColor(colorCode)}`}>
                              {display}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <button className="mt-4 btn-primary" onClick={() => setEmployeeView(null)}>
                  Close
                </button>
              </div>
            </div>
          )}

        </main>

        {/* FOOTER */}
        <footer className="simple-footer glass-footer">
          <p className="text-sm tracking-wide footer-copy">
            &copy; 2025 HCL | All Rights Reserved
          </p>
        </footer>

        {/* local styles (keyframes & utilities) */}
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeInUp { animation: fadeInUp 1.2s ease-out; }
          .landing-no-scroll { overflow: hidden; }

          .glass-nav {
            background: rgba(13, 17, 48, 0.65);
            border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 10px 25px rgba(2, 6, 23, 0.55);
            backdrop-filter: blur(18px);
          }
          .nav-featured-item {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            padding-top: 0.6rem;
          }
          .nav-feature-ribbon {
            position: absolute;
            top: -0.2rem;
            left: 50%;
            transform: translateX(-50%);
            border-radius: 999px;
            padding: 0.18rem 0.55rem;
            font-size: 0.58rem;
            font-weight: 900;
            letter-spacing: 0.22em;
            color: #fff7ed;
            background: linear-gradient(135deg, rgba(244, 63, 94, 0.95), rgba(245, 158, 11, 0.95));
            border: 1px solid rgba(255,255,255,0.22);
            box-shadow: 0 10px 24px rgba(244, 63, 94, 0.28);
            pointer-events: none;
            z-index: 2;
          }
          .nav-rota-button {
            min-width: 88px;
            color: #f8fbff !important;
            border: 1px solid rgba(255,255,255,0.22);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            animation: rotaBlinkGlow 1.8s ease-in-out infinite;
          }
          .nav-rota-button--idle {
            background: linear-gradient(135deg, rgba(8, 47, 73, 0.72), rgba(17, 94, 89, 0.6)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.2),
              0 10px 26px rgba(13, 148, 136, 0.2);
          }
          .nav-rota-button--active {
            background: linear-gradient(135deg, rgba(5, 46, 22, 0.82), rgba(21, 128, 61, 0.72)) !important;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 10px 26px rgba(34, 197, 94, 0.26);
          }
          .nav-rota-button:hover {
            transform: translateY(-1px) scale(1.04);
          }
          @keyframes rotaBlinkGlow {
            0%, 100% {
              border-color: rgba(52, 211, 153, 0.55);
              box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.18),
                0 0 0 1px rgba(16, 185, 129, 0.18),
                0 0 18px rgba(16, 185, 129, 0.34);
              filter: saturate(1);
            }
            50% {
              border-color: rgba(253, 224, 71, 0.72);
              box-shadow:
                inset 0 1px 0 rgba(255,255,255,0.24),
                0 0 0 1px rgba(245, 158, 11, 0.24),
                0 0 24px rgba(245, 158, 11, 0.46);
              filter: saturate(1.14);
            }
          }
          @media (max-width: 640px) {
            .top-nav-actions {
              gap: 0.35rem !important;
            }
            .nav-featured-item {
              padding-top: 0.72rem;
            }
            .nav-rota-button {
              min-width: 78px;
            }
          }
          .simple-footer {
            margin-top: 32px;
            padding: 12px 0;
            text-align: center;
            color: #e0edff;
            font-weight: 600;
            letter-spacing: 0.05em;
          }
          .glass-footer {
            background: rgba(8, 18, 46, 0.55);
            border-top: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 -6px 18px rgba(2, 6, 23, 0.35);
            backdrop-filter: blur(12px);
          }

          /* Glass helpers */
          .glass { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
          .glass-chip {
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.16);
            color: #e8f0ff;
          }

          /* Button */
          .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #60a5fa);
            color: white;
            padding: 10px 18px;
            border-radius: 12px;
            font-weight: 800;
            border: none;
            cursor: pointer;
            transition: 0.2s ease;
            box-shadow: 0 0 12px rgba(59,130,246,.45);
          }
          .btn-primary:hover {
            transform: translateY(-1px) scale(1.02);
            box-shadow: 0 0 22px rgba(59,130,246,.75);
          }

          /* Glass button (for landing login) */
          .btn-glass {
            background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06)) !important;
            color: #e6f0ff !important;
            padding: 10px 18px;
            border-radius: 14px;
            font-weight: 800;
            border: 1px solid rgba(255,255,255,0.18);
            cursor: pointer;
            transition: 0.25s ease;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.25),
              0 8px 20px rgba(15, 23, 42, 0.45),
              0 0 18px rgba(56, 189, 248, 0.35);
          }
          .btn-glass:hover {
            transform: translateY(-1px) scale(1.03);
            background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10));
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.35),
              0 12px 28px rgba(15, 23, 42, 0.55),
              0 0 26px rgba(56, 189, 248, 0.55);
          }

          .logo-title {
            font-weight: 1000;
            font-variation-settings: "wght" 980;
            letter-spacing: 0.08em;
          }
          .logo-blue { color: #60a5fa; }
          .logo-green { color: #34d399; }
          .logo-yellow { color: #facc15; }
          .logo-red { color: #f87171; }

          /* Mobile sticky employee column - match dashboard */
          @media (max-width: 768px) {
            .sticky-name {
              position: sticky;
              left: 0;
              min-width: 140px;
              z-index: 4000;
              background: rgba(8, 23, 60, 0.98) !important;
              color: #f8fbff !important;
              border-right: 2px solid #3b82f6;
              box-shadow: 10px 0 18px rgba(3, 7, 18, 0.65);
              backdrop-filter: blur(14px);
            }
            td.sticky-name::after,
            th.sticky-name::after {
              content: "";
              position: absolute;
              top: 0;
              right: -18px;
              width: 18px;
              height: 100%;
              pointer-events: none;
              background: linear-gradient(90deg, rgba(8, 23, 60, 0.98), rgba(8, 23, 60, 0));
            }
          }
        `}</style>
      </div>
    </div>
  );
}






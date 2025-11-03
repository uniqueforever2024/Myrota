// ✅ App.jsx - Final with working Logs (Firestore) & clean nav + REPORT EXPORT
// - Employee self-edit stores {shift, leave} without overwriting real shift
// - Block A/C/WS edits with centered modal + Close button
// - Display only leave code (PL/RH/CH) if applied (NOT "B (PL Applied)")
// - Dropdown allows PL, RH, CH, B (B removes leave and restores display to real shift)
// - Auto-collapse past weeks (when today's date is after that week's last date)
// - Admin: Logs page (separate tab). Logs are stored in Firestore collection "logs" (newest first).
// - Clean header icons (🏠 Home → ALWAYS Landing, 📞 Report, 🌙 Theme, 📄 Logs).
//   Home ALWAYS navigates to Landing and closes any open modals/popups.

import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

// ✅ Excel export libs
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* ------------------ CONSTANTS ------------------ */

const YEARS = [2025, 2026];

const MONTHS_BY_YEAR = {
  2025: ["November", "December"],
  2026: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

const MONTH_INDEX = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

const SHIFTS = [
  { code: "A", label: "Morning Shift (5AM - 12PM)" },
  { code: "B", label: "Normal Shift (12PM - 9PM)" },
  { code: "C", label: "Night Shift (10PM - 5AM)" },
  { code: "PL", label: "Personal Leave" },
  { code: "RH", label: "Restricted Holiday" },
  { code: "CH", label: "Company Holiday" },
  { code: "WS", label: "Weekend Shift" },
  { code: "W",  label: "Weekend Off" },
];

const EMPLOYEES = [
  "Tasavuur", "Astitva", "Piyush", "Shikha", "Akash",
  "Sourav", "Ashraf", "Deepthi", "Naveen",
  "Arun", "Prasanna", "Raju", "Vishnu", "Siddharth"
];

// ✅ Consistent cell size
const CELL = "w-16 h-8 text-center";

/* ✅ Color rendering */
const badgeColor = (code) => {
  const map = {
    A: `bg-blue-300 text-black ${CELL}`,          // Morning Shift
    B: `bg-white text-black border border-gray-400 ${CELL}`,         // Normal Shift
    C: `bg-yellow-300 text-black ${CELL}`,        // Night Shift
    PL: `bg-red-700 text-white ${CELL}`,          // PL → DARK RED
    WS: `bg-green-500 text-white ${CELL}`,        // WS → GREEN
    W:  `bg-red-300 text-black ${CELL}`,          // W → LIGHT RED
    RH: `bg-purple-300 text-black ${CELL}`,       // Restricted Holiday
    CH: `bg-purple-600 text-white ${CELL}`,       // Company Holiday
  };
  return map[code] || `bg-gray-300 text-black ${CELL}`;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------ Helpers ------------------ */
const getKey = (year, month, week, emp, day) =>
  `${year}-${month}-${week}-${emp}-${day}`;

const getDefaultShift = (dayLabel) =>
  ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(dayLabel) ? "B" : "W";

/* ✅ IST utilities (for correct India timezone handling) */
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

/* ✅ Calendar generator (weeks as arrays of days) */
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
  const [page, setPage] = useState("landing"); // landing | login | dashboard | selfEdit | logs | report
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState("November");

  const [employeeView, setEmployeeView] = useState(null);
  const [collapsedWeeks, setCollapsedWeeks] = useState([]); // array of indexes

  const [rota, setRota] = useState({});
  const weeks = useMemo(
    () => generateWeeks(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  /* ✅ Update Leave modal + single-user edit */
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [loginUser, setLoginUser] = useState(EMPLOYEES[0]);
  const [loginPass, setLoginPass] = useState("");
  const [loggedEmployee, setLoggedEmployee] = useState(null); // self-edit context
  const allowedLeaveCodes = ["B", "PL", "CH", "RH"]; // B means "remove leave / revert"

  /* ✅ Shift Restriction Modal */
  const [showShiftBlockModal, setShowShiftBlockModal] = useState(false);

  /* ✅ Logs state (Admin logs page) */
  const [logs, setLogs] = useState([]);

  /* ✅ Report state (for C + WS shifts) */
  const [finalReport, setFinalReport] = useState([]);

  /* ✅ Firebase realtime listener for rota */
  useEffect(() => {
    return onSnapshot(doc(db, "rota", "master"), (snap) => {
      setRota(snap.data() || {});
    });
  }, []);

  /* ✅ Subscribe logs whenever admin is viewing logs tab */
  useEffect(() => {
    if (!(isAdmin && page === "logs")) return;
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      setLogs(rows);
    });
    return () => unsub && unsub();
  }, [isAdmin, page]);

  /* ✅ Update Firebase (admin) — preserve leave and normalize object model + LOG SHIFT */
  const updateShift = async (emp, week, day, code) => {
    const key = getKey(selectedYear, selectedMonth, week, emp, day);
    const defaultShift = getDefaultShift(WEEKDAYS[day]);
    const stored = rota[key];

    const prevShift = typeof stored === "object"
      ? (stored?.shift ?? defaultShift)
      : (stored ?? defaultShift);
    const prevLeave = typeof stored === "object" ? stored?.leave ?? null : null;

    // Always store object, preserving leave
    const nextVal = { shift: code, leave: prevLeave };

    // Update UI
    setRota((prev) => ({ ...prev, [key]: nextVal }));

    // Persist
    await setDoc(doc(db, "rota", "master"), { [key]: nextVal }, { merge: true });

    // Log only if actually changed
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

  /* ✅ Save leave WITHOUT overwriting real shift (self-edit only) + LOG (idempotent) */
  const saveLeave = async (emp, week, day, leaveCode, currentShift) => {
    const key = getKey(selectedYear, selectedMonth, week, emp, day);
    const stored = rota[key];
    const prev = typeof stored === "object" ? stored : { shift: currentShift, leave: null };
    const next = { shift: prev.shift ?? currentShift, leave: leaveCode ?? null };

    // No-op if nothing changed
    if ((prev.leave ?? null) === (leaveCode ?? null) && (prev.shift ?? currentShift) === next.shift) {
      return;
    }

    // Update rota
    setRota((prevState) => ({ ...prevState, [key]: next }));
    await setDoc(doc(db, "rota", "master"), { [key]: next }, { merge: true });

    // Create human date string
    const dayNum = weeks[week][day]?.day;
    const dateObj = new Date(selectedYear, MONTH_INDEX[selectedMonth], dayNum);
    const dateText = dateObj.toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });

    // ✅ Write to logs
    try {
      await addDoc(collection(db, "logs"), {
        timestamp: serverTimestamp(),
        employee: EMPLOYEES[emp],
        year: selectedYear,
        month: selectedMonth,
        day: dayNum,
        week,
        weekDay: WEEKDAYS[day],
        date: dateText,
        shiftBefore: currentShift,
        leaveApplied: leaveCode, // PL/RH/CH or null when removed
        action: leaveCode ? `Applied ${leaveCode}` : "Leave removed",
      });
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  };

  /* ✅ Landing rotating text */
  const rotatingWords = ["MyRota", "MyPlans", "MyTeam", "MyTime"];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setCurrentWordIndex((i) => (i + 1) % rotatingWords.length),
      1500
    );
    return () => clearInterval(interval);
  }, []);

  /* ✅ Auto-collapse weeks */
  useEffect(() => {
    const today = todayIST();
    const monthIdx = MONTH_INDEX[selectedMonth];
    let currentWeekIndex = -1;
    const todayDate = new Date(today);
    const isSameMonthYear =
      todayDate.getFullYear() === selectedYear &&
      todayDate.getMonth() === monthIdx;

    if (isSameMonthYear) {
      weeks.forEach((week, wIdx) => {
        week.forEach((cell, dIdx) => {
          if (!cell.isPadding && cell.day) {
            const cellDate = new Date(selectedYear, monthIdx, cell.day);
            if (cellDate.getTime() === todayDate.getTime()) {
              currentWeekIndex = wIdx;
            }
          }
        });
      });
    }

    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(max-width: 768px)").matches;

    let indexes = [];

    if (isMobile && currentWeekIndex >= 0) {
      indexes = weeks
        .map((_, i) => i)
        .filter((i) => i !== currentWeekIndex);
    } else {
      const autoCollapsed = weeks.map((week) => {
        const last = [...week].reverse().find((c) => !c.isPadding);
        if (!last) return false;
        const lastDate = new Date(selectedYear, monthIdx, last.day);
        return lastDate < today;
      });
      indexes = autoCollapsed.reduce((acc, v, i) => (v ? [...acc, i] : acc), []);
    }

    setCollapsedWeeks(indexes);
  }, [weeks, selectedMonth, selectedYear]);

  /* ------------------ NAV UTILS ------------------ */
  const goHome = () => {
    // Close any modals/popups and ALWAYS go to landing
    setEmployeeView(null);
    setShowUpdateModal(false);
    setShowShiftBlockModal(false);
    setLoggedEmployee(null);
    setPage("landing");
  };

  /* ------------------ REPORT (C + WS) ------------------ */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rota, selectedYear, selectedMonth]);

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

  /* ------------------ RENDERERS ------------------ */

  // ✅ NEW TopNav: 🏠  📞  🌙  (📄 only if admin)
  const TopNav = (
    <div className="flex items-center gap-8">

      {/* LEFT — HOME */}
      <button
        onClick={goHome}
        title="Home (Landing)"
        className="px-4 py-2 text-white text-2xl hover:scale-110 transition"
      >
        🏠
      </button>

      {/* MIDDLE — REPORT */}
      <button
        onClick={() => setPage("report")}
        title="ON CALL ROTA"
        className="px-4 py-2 text-yellow-300 text-3xl hover:scale-110 transition"
      >
        📞
      </button>

      {/* RIGHT — THEME */}
      <button onClick={() => setDarkMode(!darkMode)} className="text-2xl hover:scale-110 transition">
        {darkMode ? "☀" : "🌙"}
      </button>

      {/* ADMIN — LOGS */}
      {isAdmin && (
        <button
          onClick={() => setPage("logs")}
          title="Logs"
          className="px-4 py-2 text-white text-2xl hover:scale-110 transition"
        >
          📄
        </button>
      )}
    </div>
  );

  const DashboardHeader = (
    <div className="flex flex-col gap-2 md:flex-row justify-between items-center mb-6">
      <h2 className="text-3xl font-extrabold">
        ROTA {selectedMonth} {selectedYear}
      </h2>

      <div className="flex gap-3 items-center">
        <select
          className="px-4 py-2 bg-white/20 rounded-lg text-black"
          value={selectedYear}
          onChange={(e) => {
            const yr = Number(e.target.value);
            setSelectedYear(yr);
            setSelectedMonth(MONTHS_BY_YEAR[yr][0]);
          }}
        >
          {YEARS.map((yr) => (
            <option key={yr} value={yr} className="text-black">
              {yr}
            </option>
          ))}
        </select>

        <select
          className="px-4 py-2 bg-white/20 rounded-lg text-black"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {MONTHS_BY_YEAR[selectedYear].map((m) => (
            <option key={m} value={m} className="text-black">
              {m}
            </option>
          ))}
        </select>

        {/* ✅ Update Leave: visible for non-admin on dashboard */}
        {!isAdmin && page === "dashboard" && (
          <button
            onClick={() => setShowUpdateModal(true)}
            className="px-4 py-2 bg-yellow-400 text-black rounded-lg font-bold"
          >
            Update Leave
          </button>
        )}
      </div>
    </div>
  );

  const WeeksTableAllEmployees = (
    <>
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="mb-8 p-4 rounded-xl shadow-xl bg-white/20 backdrop-blur-xl overflow-x-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-bold">Week {weekIndex + 1}</h3>
            <button
              className="px-2 py-1 bg-white/40 rounded-md text-black text-xl font-bold hover:bg-white"
              onClick={() =>
                setCollapsedWeeks((prev) =>
                  prev.includes(weekIndex)
                    ? prev.filter((w) => w !== weekIndex)
                    : [...prev, weekIndex]
                )
              }
            >
              {collapsedWeeks.includes(weekIndex) ? "+" : "−"}
            </button>
          </div>

          {!collapsedWeeks.includes(weekIndex) && (
            <table className="min-w-full text-center border-collapse text-sm">
              <thead>
                <tr className="bg-white/30 text-black font-bold">
                  <th className="p-2 sticky left-0 bg-white/30 z-10 text-left min-w-[120px]">
                    Employee
                  </th>
                  {WEEKDAYS.map((wd, idx) => (
                    <th key={idx} className="p-2">
                      {wd} {week[idx]?.day ?? ""}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {EMPLOYEES.map((emp, empIndex) => (
                  <tr key={emp} className="even:bg-white/5">
                    <td
                      className="sticky-name font-semibold text-left p-2 min-w-[120px] cursor-pointer hover:text-yellow-300"
                      onClick={() => setEmployeeView(empIndex)}
                    >
                      {emp}
                    </td>

                    {week.map((cell, dayIndex) =>
                      cell.isPadding ? (
                        <td key={dayIndex} className="p-1">
                          <span className={`inline-flex opacity-40 ${badgeColor("")}`} />
                        </td>
                      ) : (
                        <td key={dayIndex} className="p-1">
                          {(() => {
                            const defaultShift = getDefaultShift(WEEKDAYS[dayIndex]);
                            const key = getKey(selectedYear, selectedMonth, weekIndex, empIndex, dayIndex);
                            const stored = rota[key];
                            // Backward compatibility: stored may be string or object
                            const realShift = typeof stored === "object"
                              ? (stored?.shift ?? defaultShift)
                              : (stored ?? defaultShift);
                            const leaveApplied = typeof stored === "object" ? stored?.leave : undefined;
                            const displayCodeForColor = leaveApplied ?? realShift;
                            const displayText = leaveApplied ? leaveApplied : realShift;

                            // Admin retains full edit
                            return isAdmin ? (
                              <div className={`${badgeColor(displayCodeForColor)} rounded-md flex items-center justify-center`}>
                                <select
                                  value={realShift}
                                  className="w-full bg-transparent font-bold text-xs cursor-pointer p-1 outline-none"
                                  onChange={(e) => updateShift(empIndex, weekIndex, dayIndex, e.target.value)}
                                >
                                  {SHIFTS.map((s) => (
                                    <option key={s.code} value={s.code}>{s.code}</option>
                                  ))}
                                </select>
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
              </tbody>
            </table>
          )}
        </div>
      ))}

      {/* ✅ Shift legend */}
      <div className="mt-10 p-6 rounded-xl shadow-xl bg-white/20 backdrop-blur-xl border border-white/30">
        <h3 className="text-xl font-extrabold mb-4">Shift Definitions</h3>

        <table className="w-full text-sm text-left">
          <thead>
            <tr className="font-bold text-black bg-white/40">
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
                <td className="p-2 text-white">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const SingleUserEditHeader = (
    <div className="flex flex-col gap-2 md:flex-row justify-between items-center mb-6">
      <h2 className="text-3xl font-extrabold">
        {loggedEmployee}'s Leave — {selectedMonth} {selectedYear}
      </h2>

      <div className="flex gap-3 items-center">
        <select
          className="px-4 py-2 bg-white/20 rounded-lg text-black"
          value={selectedYear}
          onChange={(e) => {
            const yr = Number(e.target.value);
            setSelectedYear(yr);
            setSelectedMonth(MONTHS_BY_YEAR[yr][0]);
          }}
        >
          {YEARS.map((yr) => (
            <option key={yr} value={yr} className="text-black">
              {yr}
            </option>
          ))}
        </select>

        <select
          className="px-4 py-2 bg-white/20 rounded-lg text-black"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {MONTHS_BY_YEAR[selectedYear].map((m) => (
            <option key={m} value={m} className="text-black">
              {m}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setLoggedEmployee(null);
            setShowUpdateModal(false);
            setPage("dashboard");
          }}
          className="px-4 py-2 bg-white/20 text-white rounded-lg font-bold"
        >
          ← Back
        </button>
      </div>
    </div>
  );

  const SingleUserEditTable = (
    <>
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="mb-8 p-4 rounded-xl shadow-xl bg-white/20 backdrop-blur-xl overflow-x-auto">
          <h3 className="text-xl font-bold mb-3">Week {weekIndex + 1}</h3>

          <table className="min-w-full text-center border-collapse text-sm">
            <thead>
              <tr className="bg-white/30 text-black font-bold">
                <th className="p-2 sticky left-0 bg-white/30 z-10 text-left min-w-[140px]">
                  {loggedEmployee}
                </th>
                {WEEKDAYS.map((wd, idx) => (
                  <th key={idx} className="p-2">
                    {wd} {week[idx]?.day ?? ""}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="even:bg-white/5">
                <td className="font-semibold text-left p-2 sticky left-0 bg-transparent z-10 min-w-[140px]">
                  {loggedEmployee}
                </td>

                {week.map((cell, dayIndex) =>
                  cell.isPadding ? (
                    <td key={dayIndex} className="p-1">
                      <span className={`inline-flex opacity-40 ${badgeColor("")}`} />
                    </td>
                  ) : (
                    <td key={dayIndex} className="p-1">
                      {(() => {
                        const empIndex = EMPLOYEES.indexOf(loggedEmployee);
                        const defaultShift = getDefaultShift(WEEKDAYS[dayIndex]);
                        const key = getKey(selectedYear, selectedMonth, weekIndex, empIndex, dayIndex);
                        const stored = rota[key];

                        // Backward compatible: might be string or object
                        const realShift = typeof stored === "object"
                          ? (stored?.shift ?? defaultShift)
                          : (stored ?? defaultShift);
                        const leaveApplied = typeof stored === "object" ? stored?.leave : undefined;

                        const displayCodeForColor = leaveApplied ?? realShift;
                        const displayText = leaveApplied ? leaveApplied : realShift;

                        return (
                          <div className={`${badgeColor(displayCodeForColor)} rounded-md flex items-center justify-center`}>
                            {/* Value shows leave code if set; otherwise placeholder */}
                            <select
                              value={leaveApplied ?? ""}
                              className="w-full bg-transparent font-bold text-xs cursor-pointer p-1 outline-none"
                              onChange={async (e) => {
                                const newLeave = e.target.value;

                                // ❌ Prevent leave placement if current shift is A / C / WS
                                if (["A", "C", "WS"].includes(realShift)) {
                                  setShowShiftBlockModal(true);
                                  return;
                                }

                                // If user selects B = remove applied leave
                                if (newLeave === "B") {
                                  await saveLeave(empIndex, weekIndex, dayIndex, null, realShift);
                                  return;
                                }

                                // ✅ Save leave without overwriting real shift
                                await saveLeave(empIndex, weekIndex, dayIndex, newLeave, realShift);
                              }}
                            >
                              {/* Placeholder when no leave chosen yet */}
                              <option value="" disabled>
                                {displayText}
                              </option>
                              {allowedLeaveCodes.map((code) => (
                                <option key={code} value={code}>
                                  {code}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </td>
                  )
                )}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </>
  );

  /* ------------------ LOGS PAGE (Admin) ------------------ */
  const LogsPage = (
    <div className="p-6 pb-20">
      <h2 className="text-4xl font-extrabold mb-6 flex items-center gap-3">
        📄 Change Logs
      </h2>

      <div className="rounded-xl shadow-xl bg-white/20 backdrop-blur-xl border border-white/30 p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-white/30 text-black font-bold">
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
              <tr key={row.id} className="border-b border-white/10 text-white">
                <td className="p-2">
                  {row.timestamp?.toDate
                    ? fmtIST(row.timestamp.toDate())
                    : "—"}
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
                <td className="p-4 text-center text-white/80" colSpan={7}>
                  No logs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ------------------ REPORT PAGE ------------------ */
  const ReportPage = (
    <div className="p-6 pb-20">
      <h2 className="text-4xl font-extrabold mb-6 flex items-center gap-3">
        📞 ON CALL ROTA
      </h2>

      <div className="rounded-xl shadow-xl bg-white/20 backdrop-blur-xl border border-white/30 p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-white/30 text-black font-bold">
              <th className="p-2 text-left">S.No</th>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Day</th>
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-left">Shift</th>
            </tr>
          </thead>
          <tbody>
            {finalReport.map((r, i) => (
              <tr key={`${r.date}-${r.employee}-${i}`} className="border-b border-white/10 text-white">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.day}</td>
                <td className="p-2">{r.employee}</td>
                <td className="p-2">{r.shift}</td>
              </tr>
            ))}
            {finalReport.length === 0 && (
              <tr>
                <td className="p-4 text-center text-white/80" colSpan={5}>
                  No C/WS shifts found for {selectedMonth} {selectedYear}.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <button
            onClick={exportReportAsExcel}
            className="px-6 py-3 bg-green-500 text-white rounded-lg font-bold"
            title="Export as Excel"
          >
            ⬇ Export as Excel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-black dark:to-gray-900 text-white">

        {/* HEADER */}
        <header className="p-4 flex justify-between items-center bg-white/10 backdrop-blur-xl shadow-xl">
          <h1 className="text-3xl font-extrabold cursor-pointer" onClick={goHome}>
            MyRota+
          </h1>
          {TopNav}
        </header>

        <main className="flex-grow">

          {/* ✅ LANDING PAGE WITH ROTATING TEXT */}
          {page === "landing" && (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6 animate-fadeInUp">

              <h1 className="text-6xl font-extrabold">
                <span className="text-white">Welcome to </span>
                <span className="text-yellow-400">{rotatingWords[currentWordIndex]}</span>
              </h1>

              <button
                onClick={() => setPage("login")}
                className="mt-6 px-10 py-3 bg-white rounded-full text-purple-700 font-bold hover:scale-110 transition"
              >
                Get Started →
              </button>
            </div>
          )}

          {/* LOGIN */}
          {page === "login" && (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
              <h2 className="text-4xl font-extrabold">Choose Role</h2>

              <div className="flex gap-6">
                <button
                  className="px-8 py-3 bg-white text-purple-700 font-bold rounded-lg"
                  onClick={() => {
                    const pass = prompt("Enter Admin Password:");
                    if (pass === "password") {
                      setIsAdmin(true);
                      setPage("dashboard");
                    } else alert("❌ Incorrect password");
                  }}
                >
                  Admin
                </button>

                {/* ✅ Employee now goes straight to dashboard (no username yet) */}
                <button
                  className="px-8 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:scale-110 transition"
                  onClick={() => {
                    setIsAdmin(false);
                    setLoggedEmployee(null); // not picked yet
                    setPage("dashboard");
                  }}
                >
                  Employee
                </button>
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <div className="p-6 pb-20">
              {DashboardHeader}
              {WeeksTableAllEmployees}
            </div>
          )}

          {/* SELF EDIT PAGE */}
          {page === "selfEdit" && loggedEmployee && (
            <div className="p-6 pb-20">
              {SingleUserEditHeader}
              {SingleUserEditTable}
            </div>
          )}

          {/* LOGS PAGE (Admin) */}
          {page === "logs" && isAdmin && LogsPage}

          {/* REPORT PAGE */}
          {page === "report" && ReportPage}

          {/* ✅ EMPLOYEE LOGIN MODAL for Update Leave */}
          {showUpdateModal && !isAdmin && page === "dashboard" && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl text-black p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Update Leave — Login</h2>

                <label className="block text-sm font-semibold mb-1">Select User</label>
                <select
                  className="w-full border rounded-lg p-2 mb-4"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                >
                  {EMPLOYEES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                <label className="block text-sm font-semibold mb-1">Password</label>
                <input
                  type="password"
                  className="w-full border rounded-lg p-2 mb-4"
                  placeholder="username in lowercase"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                />

                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-200"
                    onClick={() => {
                      setShowUpdateModal(false);
                      setLoginPass("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white font-bold"
                    onClick={() => {
                      if (!loginUser) {
                        alert("Please select a user");
                        return;
                      }
                      if (loginPass !== loginUser.toLowerCase()) {
                        alert("❌ Incorrect password");
                        return;
                      }
                      setLoggedEmployee(loginUser);
                      setLoginPass("");
                      setShowUpdateModal(false);
                      setPage("selfEdit"); // switch to single-user page
                    }}
                  >
                    Login
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ✅ EMPLOYEE VIEW MODAL */}
          {employeeView !== null && page !== "selfEdit" && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-xl text-black p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">

                <h2 className="text-2xl font-bold mb-4">
                  {EMPLOYEES[employeeView]}'s Plan — {selectedMonth} {selectedYear}
                </h2>

                <table className="w-full text-sm">
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
                      const realShift = typeof stored === "object"
                        ? (stored?.shift ?? defaultShift)
                        : (stored ?? defaultShift);
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

                <button
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg"
                  onClick={() => setEmployeeView(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* ✅ Shift Block Modal (centered) */}
          {showShiftBlockModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white text-black rounded-xl shadow-xl p-6 max-w-sm w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-red-600">🚫 Action Not Allowed</h2>
                <p className="mb-6 font-semibold">
                  You have been assigned to a shift on this day.
                  <br />
                  <span className="text-purple-600 font-bold">You cannot place a leave. Contact Admin.</span>
                </p>
                <button
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold"
                  onClick={() => setShowShiftBlockModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </main>

        {/* FOOTER */}
        <footer className="text-center py-3 bg-black/40 text-xs text-white">
          © 2025 HCL | All Rights Reserved
        </footer>

        {/* Animations */}
        <style>{`
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeInUp {
    animation: fadeInUp 1.2s ease-out;
  }

  /* Alternating sticky employee column colors */
@media (max-width: 768px) {
  /* Pattern A */
  td.sticky-name:nth-child(odd),
  tr:nth-child(odd) td.sticky-name {
    background: #6B5AED !important; /* Color A */
    color: white !important;
  }

  /* Pattern B (light faded version of A) */
  td.sticky-name:nth-child(even),
  tr:nth-child(even) td.sticky-name {
    background: #7d6ffe !important; /* Color B */
    color: white !important;
  }

  /* Sticky behavior */
  .sticky-name {
    position: sticky;
    left: 0;
    z-index: 100;
    padding-left: 10px;
    padding-right: 10px;
    white-space: nowrap;
  }
}
`}</style>

      </div>
    </div>
  );
}

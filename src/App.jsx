// App.jsx — Blue Neon SaaS + Glass • Typewriter Landing
// + Robust dropdowns + preserved scroll + employee-only leave edits
// -----------------------------------------------------------------------------------
// What’s included:
// 1) Landing page with typewriter headline (static under title).
// 2) "Login as Admin" (password prompt) + "Login as Employee" (no password) on landing.
// 3) Employee can update ONLY leave (PL/RH/CH) from Self Edit page; Admin can change shifts on Dashboard.
// 4) Fix: native <select> menus no longer disappear (stopPropagation + stable DOM).
// 5) Fix: horizontal scroll position preserved per week on mobile (no jump to first day).
// 6) A shift = Blue, C shift = Yellow. Sticky employee column readable on mobile.
// 7) Password is asked ONLY when employee clicks “Update Leave” (to enter Self Edit).
// -----------------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import myrotaLogo from "./myrotalogo.svg";

const BrandLogo = ({ className = "h-10 w-10" }) => (
  <img src={myrotaLogo} alt="MyRota logo" className={className} />
);
import { db, auth } from "./firebase";
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
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";

// Excel export
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
  };
  return map[code] || `bg-gray-300 text-black ${CELL}`;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TEAM_MEMBERS = [
  "Naveen",
  "Prasanna",
  "Raju",
  "Vishnu",
  "Tasavur",
  "Piyush",
  "Akash",
  "Astitva",
  "Sourav",
  "Ashraf",
  "Shikha",
  "Deepthi",
  "Arun",
  "Siddharth",
];

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

/* ------------------ Typewriter Hook ------------------ */
function useTypewriter(words, typeSpeed = 80, pause = 900, eraseSpeed = 35, active = true) {
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);       // which word
  const [phase, setPhase] = useState("typing"); // typing | pausing | deleting

  useEffect(() => {
    if (!active) return; // pause updates when not active (prevents global re-renders)
    const word = words[index];

    if (phase === "typing") {
      if (text.length < word.length) {
        const timeout = setTimeout(() => setText(word.slice(0, text.length + 1)), typeSpeed);
        return () => clearTimeout(timeout);
      }
      const timeout = setTimeout(() => setPhase("pausing"), pause);
      return () => clearTimeout(timeout);
    }

    if (phase === "pausing") {
      const timeout = setTimeout(() => setPhase("deleting"), pause / 2);
      return () => clearTimeout(timeout);
    }

    if (phase === "deleting") {
      if (text.length > 0) {
        const timeout = setTimeout(() => setText(word.slice(0, text.length - 1)), eraseSpeed);
        return () => clearTimeout(timeout);
      }
      setPhase("typing");
      setIndex((i) => (i + 1) % words.length);
    }
  }, [text, phase, index, words, typeSpeed, pause, eraseSpeed, active]);

  return text;
}

/* ------------------ MAIN APP ------------------ */
export default function App() {
  const prefersDark = true; // default dark
  const [page, setPage] = useState("landing"); // landing | dashboard | selfEdit | logs | report
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode] = useState(prefersDark);

  // Simple nav history stack to support Back
  const navStackRef = useRef(["landing"]);
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
  const currentMonthName = Object.keys(MONTH_INDEX).find(
    (m) => MONTH_INDEX[m] === istNow.getMonth()
  );
  const defaultYear = YEARS.includes(currentYear) ? currentYear : YEARS[0];
  const defaultMonth = MONTHS_BY_YEAR[defaultYear].includes(currentMonthName)
    ? currentMonthName
    : MONTHS_BY_YEAR[defaultYear][0];

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
  const [collapsedWeeks, setCollapsedWeeks] = useState([]);
  const [rota, setRota] = useState({});
  const weeks = useMemo(
    () => generateWeeks(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  // Scroll preservation for each week's overflow container
  const scrollRefs = useRef({});     // { [weekIndex]: HTMLElement }
  const [scrollMap, setScrollMap] = useState({}); // { [weekIndex]: number }

  const rememberScroll = (weekIndex, el) => {
    if (!el) return;
    scrollRefs.current[weekIndex] = el;
    // Apply saved scrollLeft if present
    if (scrollMap[weekIndex] != null) {
      el.scrollLeft = scrollMap[weekIndex];
    }
  };

  // Disable state updates during scroll to keep UI responsive on mobile
  const onWeekScroll = null;

  // Note: rely on native horizontal scroll; custom drag removed for reliability

  // Note: native horizontal scrolling is enabled on the week scroller
  // via overflow-x-auto + touchAction: 'pan-x' and table width rules.

  // Prevent auto-collapsing while native select is open
  const [isPicking, setIsPicking] = useState(false);
  const isPickingRef = useRef(false);
  useEffect(() => { isPickingRef.current = isPicking; }, [isPicking]);
  const lastRotaRef = useRef({});

  // Stop event bubbling without preventing default (so select can open)
  const stopEvent = (e) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    const ne = e && e.nativeEvent;
    if (ne && typeof ne.stopImmediatePropagation === "function") ne.stopImmediatePropagation();
  };

  // Employee login modal fields (used for "Update Leave" only)
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loggedEmployee, setLoggedEmployee] = useState(null);
  const allowedLeaveCodes = ["B", "PL", "CH", "RH"]; // B = remove leave

  // Admin login modal fields
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState("");

  const [showShiftBlockModal, setShowShiftBlockModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [finalReport, setFinalReport] = useState([]);

  /* ✅ LISTEN: employees + rota */
  useEffect(() => {
    const uq = query(collection(db, "users"), orderBy("position", "asc"));
    const unsubUsers = onSnapshot(uq, (snap) => {
      const names = snap.docs.map((d) => d.id);
      setEMPLOYEES(names);
      if (!loginUser && names.length > 0) setLoginUser(names[0]);
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

  /* ✅ Save leave without overwriting real shift — FIXED binding & behavior */
  const saveLeave = async (emp, week, day, leaveCode, currentShift) => {
    const key = getKey(selectedYear, selectedMonth, week, emp, day);
    const stored = rota[key];
    const prev = typeof stored === "object" ? stored : { shift: currentShift, leave: null };
    const next = { shift: prev.shift ?? currentShift, leave: leaveCode ?? null };

    // No-op check
    if ((prev.leave ?? null) === (leaveCode ?? null) && (prev.shift ?? currentShift) === next.shift) {
      return;
    }

    // Block: if real shift is A/C/WS, employee cannot place leave
    const realShift = prev.shift ?? currentShift;
    if (["A", "C", "WS"].includes(realShift) && leaveCode) {
      setShowShiftBlockModal(true);
      return;
    }

    setRota((p) => ({ ...p, [key]: next }));
    await setDoc(doc(db, "rota", "master"), { [key]: next }, { merge: true });

    // Log
    const dayNum = weeks[week][day]?.day;
    const dateObj = new Date(selectedYear, MONTH_INDEX[selectedMonth], dayNum);
    const dateText = dateObj.toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });

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
        shiftBefore: realShift,
        leaveApplied: leaveCode,
        action: leaveCode ? `Applied ${leaveCode}` : "Leave removed",
      });
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  };

  /* Typewriter for landing */
  const teamFallback = TEAM_MEMBERS[0];
  const [hasTyped, setHasTyped] = useState(false);
  const typewriterText = useTypewriter(
    TEAM_MEMBERS,
    85,
    900,
    35,
    page === "landing",
  );
  useEffect(() => {
    if (!hasTyped && typewriterText) {
      setHasTyped(true);
    }
  }, [hasTyped, typewriterText]);
  const displayTypewriterText = typewriterText || (!hasTyped ? teamFallback : "\u00A0");

  /* Auto-collapse weeks */
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
        week.forEach((cell) => {
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
      indexes = weeks.map((_, i) => i).filter((i) => i !== currentWeekIndex);
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

  /* NAV */
  const goHome = () => {
    setEmployeeView(null);
    setShowUpdateModal(false);
    setShowShiftBlockModal(false);
    setLoggedEmployee(null);
    setPage("landing");
  };

  const goBack = () => {
    const stack = navStackRef.current;
    if (stack.length > 1) {
      // Pop current and navigate to previous
      stack.pop();
      const prev = stack[stack.length - 1] || "dashboard";
      setPage(prev);
    } else {
      setPage("dashboard");
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

  /* AUTH */
  const handleAdminLogin = () => {
    if (!adminPass) { alert("Please enter password"); return; }
    if (adminPass === "password") {
      setIsAdmin(true);
      setPage("dashboard");
      setShowAdminModal(false);
      setAdminPass("");
    } else {
      alert("Incorrect password");
    }
  };
  const handleEmployeeLogin = async () => {
    try {
      if (!loginUser) { alert("Please select a user"); return; }
      if (!loginPass) { alert("Please enter password"); return; }

      // Hardcoded fallback allowed for now (you asked to keep it simple first)
      if (loginPass === "password") {
        setLoggedEmployee(loginUser);
        setLoginPass("");
        setShowUpdateModal(false);
        setIsAdmin(false);
        setPage("selfEdit");
        return;
      }

      // Real Firebase path (kept for production)
      const uref = doc(db, "users", loginUser);
      const usnap = await getDoc(uref);
      if (!usnap.exists()) { alert("❌ User not found in Firestore"); return; }
      const { email } = usnap.data();
      if (!email) { alert("❌ Email missing for this user"); return; }

      await signInWithEmailAndPassword(auth, email, loginPass);

      setLoggedEmployee(loginUser);
      setLoginPass("");
      setShowUpdateModal(false);
      setIsAdmin(false);
      setPage("selfEdit");
    } catch (err) {
      alert("❌ Login failed: " + err.message);
    }
  };

  const handleForgotPassword = async () => {
    try {
      if (!loginUser) { alert("Please select a user"); return; }
      const ref = doc(db, "users", loginUser);
      const snap = await getDoc(ref);
      if (!snap.exists()) { alert("User not found"); return; }
      const { email } = snap.data();
      if (!email) { alert("No email saved for this user"); return; }
      await sendPasswordResetEmail(auth, email);
      alert(`✅ Password reset link sent to: ${email}`);
    } catch (e) {
      alert("❌ Failed to send reset link: " + e.message);
    }
  };

  /* ------------------ RENDERERS ------------------ */
  const TopNav = (
    <div className="flex items-center gap-3 md:gap-6">
      {/* REPORT */}
      <button
        onClick={() => setPage("report")}
        title="On-call report"
        className="text-2xl md:text-3xl hover:scale-110 transition text-white"
      >
        📞
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

      {/* NOTIFICATIONS (admin only) */}
      
        <button
          onClick={() => setPage("notifications")}
          title="Notifications"
          className="hidden"
        >
          🔔
      </button>

      {/* NOTIFICATIONS (all users) */}
      <button onClick={() => setPage("notifications")} title="Notifications" className="text-2xl hover:scale-110 transition text-white/90">🔔</button>

      
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
    <div className="flex flex-col gap-3 md:flex-row justify-between items-center mb-6">
      <h2 className="text-3xl font-black text-sky-200 neon-text">
        ROTA {selectedMonth} {selectedYear}
      </h2>

      <div className="flex gap-3 items-center">
        <select
          className="px-4 py-2 rounded-lg text-white bg-slate-900/60 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
          className="px-4 py-2 rounded-lg text-white bg-slate-900/60 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {MONTHS_BY_YEAR[selectedYear].map((m) => (
            <option key={m} value={m} className="text-black">
              {m}
            </option>
          ))}
        </select>

        {/* Update Leave entry: requires password only here */}
        {!isAdmin && page === "dashboard" && (
          <button
            onClick={() => setShowUpdateModal(true)}
            className="btn-primary"
          >
            Update Leave
          </button>
        )}

        {/* Admin: persist all visible shifts into Firestore */}
        {isAdmin && (
          <button
            onClick={async () => {
              try {
                let updates = {};
                let count = 0;
                weeks.forEach((week, wIdx) => {
                  week.forEach((cell, dIdx) => {
                    if (cell.isPadding) return;
                    EMPLOYEES.forEach((_, eIdx) => {
                      const key = getKey(selectedYear, selectedMonth, wIdx, eIdx, dIdx);
                      const stored = rota[key];
                      const defaultShift = getDefaultShift(WEEKDAYS[dIdx]);
                      let shift, leave;
                      if (typeof stored === 'object') {
                        shift = stored.shift ?? defaultShift;
                        leave = stored.leave ?? null;
                      } else if (typeof stored === 'string') {
                        shift = stored;
                        leave = null;
                      } else {
                        shift = defaultShift;
                        leave = null;
                      }
                      const normalized = { shift, leave };
                      if (typeof stored !== 'object' || stored.shift !== shift || (stored.leave ?? null) !== leave) {
                        updates[key] = normalized;
                        count++;
                      }
                    });
                  });
                });
                if (count > 0) {
                  await setDoc(doc(db, 'rota', 'master'), updates, { merge: true });
                  alert(`✅ Saved ${count} cells for ${selectedMonth} ${selectedYear}.`);
                } else {
                  alert('All cells already normalized.');
                }
              } catch (e) {
                alert('Failed to persist shifts: ' + e.message);
              }
            }}
            className="btn-primary"
            title="Persist default shifts to Firestore"
          >
            Save Shifts
          </button>
        )}
      
      </div>
    </div>
  );

  const GlassCard = ({ children, weekIndex }) => (
    <div className="mb-8 p-4 rounded-2xl bg-white/[0.04] border border-white/10 shadow-xl glass">
      <div
        ref={(el) => rememberScroll(weekIndex ?? -1, el)}
        className="overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch', overflowY: 'visible' }}
      >
        {children}
      </div>
    </div>
  );

  const WeeksTableAllEmployees = (
    <>
      {weeks.map((week, weekIndex) => (
        <GlassCard key={weekIndex} weekIndex={weekIndex}>
          <div className="mb-3 relative">
            <h3 className="text-xl font-bold text-sky-200">Week {weekIndex + 1}</h3>
            <button
              className="px-3 py-1 text-sm rounded-md bg-sky-500/20 text-sky-100 font-semibold hover:bg-sky-500/30 ring-1 ring-sky-400/30 absolute right-0 top-0 z-50"
              onClick={() =>
                setCollapsedWeeks((prev) =>
                  prev.includes(weekIndex) ? prev.filter((w) => w !== weekIndex) : [...prev, weekIndex]
                )
              }
              title={collapsedWeeks.includes(weekIndex) ? "Expand" : "Collapse"}
            >
              {collapsedWeeks.includes(weekIndex) ? "+" : "−"}
            </button>
          </div>

          {!collapsedWeeks.includes(weekIndex) && (
            <table className="min-w-full w-max text-center border-collapse text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-[110]">
                <tr className="bg-gradient-to-r from-indigo-700/40 to-sky-700/40 text-sky-100 font-bold backdrop-blur">
                  <th className="p-2 sticky left-0 top-0 bg-indigo-700/40 z-[130] text-left min-w-[160px]">
                    Employee
                  </th>
                  {WEEKDAYS.map((wd, idx) => (
                    <th key={idx} className="p-2 min-w-[64px] sticky top-0 z-[120] bg-indigo-700/40 backdrop-blur">{wd} {week[idx]?.day ?? ""}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {EMPLOYEES.map((emp, empIndex) => (
                  <tr key={emp} className="even:bg-white/[0.02] odd:bg-white/[0.04]">
                    <td
                      className="sticky-name z-[120] font-semibold text-left p-2 min-w-[160px] cursor-pointer text-white bg-sky-600/30 ring-1 ring-sky-400/30 rounded-md hover:bg-sky-500/30"
                      onClick={() => setEmployeeView(empIndex)}
                    >
                      {emp}
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

                            return isAdmin ? (
                              <div
                                className={`${badgeColor(displayCodeForColor)} rounded-md flex items-center justify-center relative z-20 px-1`}
                                onClick={stopEvent}
                              >
                                <span className="text-xs font-extrabold tracking-wide select-none">{realShift}</span>
                                <span className="absolute right-1 bottom-1 text-[10px] opacity-80 pointer-events-none">▾</span>
                                <select
                                  value={realShift}
                                  className="absolute right-0 top-0 h-full w-8 opacity-0 cursor-pointer z-30"
                                  onFocus={() => setIsPicking(true)}
                                  onBlur={() => setTimeout(() => setIsPicking(false), 200)}
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
                {EMPLOYEES.length === 0 && (
                  <tr>
                    <td className="p-4 text-left text-white/70" colSpan={8}>
                      No employees yet. Add docs under <b>users</b> collection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </GlassCard>
      ))}

      {/* Legend */}
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
    </>
  );

  const SingleUserEditHeader = (
    <div className="flex flex-col gap-2 md:flex-row justify-between items-center mb-6">
      <h2 className="text-3xl font-extrabold text-sky-200">
        {loggedEmployee}'s Leave — {selectedMonth} {selectedYear}
      </h2>

      <div className="flex gap-3 items-center">
        <select
          className="px-4 py-2 rounded-lg text-white bg-slate-900/60 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
          className="px-4 py-2 rounded-lg text-white bg-slate-900/60 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
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
          className="px-4 py-2 rounded-lg font-bold glass-chip"
        >
          ← Back
        </button>
      </div>
    </div>
  );

  const SingleUserEditTable = (
    <>
      {weeks.map((week, weekIndex) => (
        <GlassCard key={weekIndex} weekIndex={weekIndex}>
          <h3 className="text-xl font-bold mb-3 text-sky-100">Week {weekIndex + 1}</h3>

            <table className="min-w-full w-max text-center border-collapse text-sm whitespace-nowrap">
            <thead className="sticky top-0 z-[110]">
              <tr className="bg-gradient-to-r from-indigo-700/40 to-sky-700/40 text-sky-100 font-bold">
                <th className="p-2 sticky left-0 top-0 bg-indigo-700/40 z-[120] text-left min-w-[160px]">
                  Employee
                </th>
                {WEEKDAYS.map((wd, idx) => (
                  <th key={idx} className="p-2 min-w-[64px] sticky top-0 z-[110] bg-indigo-700/40">
                    {wd} {week[idx]?.day ?? ""}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="even:bg-white/[0.02]">
                <td className="font-semibold text-left p-2 sticky left-0 z-[120] min-w-[160px] text-white bg-sky-600/30 ring-1 ring-sky-400/30 rounded-md">
                  {loggedEmployee}
                </td>

                {week.map((cell, dayIndex) =>
                  cell.isPadding ? (
                    <td key={dayIndex} className="p-1">
                      <span className={`inline-flex opacity-30 ${badgeColor("")}`} />
                    </td>
                  ) : (
                    <td key={dayIndex} className="p-1 min-w-[64px]">
                      {(() => {
                        const empIndex = EMPLOYEES.indexOf(loggedEmployee);
                        const dayLabel = WEEKDAYS[dayIndex];
                        const isWeekend = dayLabel === "Sat" || dayLabel === "Sun";
                        const defaultShift = getDefaultShift(dayLabel);
                        const key = getKey(selectedYear, selectedMonth, weekIndex, empIndex, dayIndex);
                        const stored = rota[key];

                        const realShift = typeof stored === "object" ? stored?.shift ?? defaultShift : stored ?? defaultShift;
                        const leaveApplied = typeof stored === "object" ? stored?.leave : null;

                        // Bind value: on weekends, bind to realShift when no leave so W is selected
                        const selectValue = leaveApplied ?? (isWeekend ? realShift : "B");
                        const leaveOptions = isWeekend ? ["W", "WS", "PL", "CH", "RH"] : allowedLeaveCodes;

                        return (
                          <div
                            className={`${badgeColor(leaveApplied ?? realShift)} rounded-md flex items-center justify-center relative z-20`}
                            onClick={stopEvent}
                          >
                            <span className="text-xs font-extrabold tracking-wide select-none">
                              {leaveApplied ?? realShift}
                            </span>
                            <span className="absolute right-1 bottom-1 text-[10px] opacity-80 pointer-events-none">▾</span>
                            <select
                              value={selectValue}
                              className="absolute right-0 top-0 h-full w-7 opacity-0 cursor-pointer z-30"
                              onFocus={() => setIsPicking(true)}
                              onBlur={() => setTimeout(() => setIsPicking(false), 200)}
                              onChange={async (e) => {
                                const chosen = e.target.value; // "B" | "PL" | "CH" | "RH"
                                if (["A", "C", "WS"].includes(realShift) && chosen !== "B") {
                                  setShowShiftBlockModal(true);
                                  return;
                                }
                                const codeToSave = chosen === "B" ? null : chosen; // null removes leave
                                await saveLeave(empIndex, weekIndex, dayIndex, codeToSave, realShift);
                              }}
                            >
                              {leaveOptions.map((code) => (
                                <option key={code} value={code}>{code}</option>
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
        </GlassCard>
      ))}
    </>
  );

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

  /* NOTIFICATIONS PAGE */
  const NotificationsPage = (() => {
    const today = todayIST();
    const year = selectedYear;
    const monthName = selectedMonth;
    const dayNum = today.getDate();

    const calendar = generateWeeks(year, monthName);
    let weekIndex = 0;
    let dayIndex = 0;
    outer: for (let w = 0; w < calendar.length; w++) {
      for (let d = 0; d < 7; d++) {
        const cell = calendar[w][d];
        if (cell && !cell.isPadding && cell.day === dayNum) { weekIndex = w; dayIndex = d; break outer; }
      }
    }
    const dayLabel = WEEKDAYS[dayIndex];
    const isWeekend = dayLabel === 'Sat' || dayLabel === 'Sun';
    const defaultShift = getDefaultShift(dayLabel);

    const leaveCodes = ["PL", "CH", "RH"];
    const onLeave = [];
    const wsAvailable = [];
    const shiftA = [];
    const shiftC = [];

    const toUpper = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : undefined);
    const isLeaveCode = (v) => ['PL','CH','RH'].includes(toUpper(v));
    const isShiftCode = (v) => ['A','B','C','WS','W'].includes(toUpper(v));

    (EMPLOYEES || []).forEach((emp, empIndex) => {
      const keyByName = getKey(year, monthName, weekIndex, emp, dayIndex);
      const keyByIndex = getKey(year, monthName, weekIndex, empIndex, dayIndex);
      const stored = (rota[keyByName] !== undefined ? rota[keyByName] : rota[keyByIndex]);
      const isObj = typeof stored === 'object' && stored !== null;
      const raw = !isObj && typeof stored === 'string' ? stored : undefined;
      const normalizedLeave = isObj
        ? toUpper(
            (isLeaveCode(stored?.leave) && stored?.leave) ||
            (isLeaveCode(stored?.leaveApplied) && stored?.leaveApplied) ||
            (isLeaveCode(stored?.shift) && stored?.shift) ||
            undefined
          )
        : (raw && isLeaveCode(raw) ? toUpper(raw) : undefined);
      const normalizedShift = isObj ? toUpper(stored?.shift ?? defaultShift) : (raw && isShiftCode(raw) ? toUpper(raw) : toUpper(defaultShift));
      const realShift = normalizedShift;
      const leaveApplied = normalizedLeave;
      if (leaveCodes.includes(leaveApplied)) {
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
          const leaveCode = isObj ? toUpper(v?.leave) : toUpper(raw);
          if (isLeaveCode(leaveCode)) {
            const empName = isNaN(Number(empPart)) ? empPart : (EMPLOYEES[Number(empPart)] || String(empPart));
            if (!onLeave.includes(empName)) onLeave.push(empName);
          }
        });
      } catch {}
    }

    const dateText = today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

    return (
      <div className="p-6 pb-20">
        <h2 className="text-4xl font-extrabold mb-6 flex items-center gap-3 text-sky-200">Notifications</h2>
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 shadow-xl p-6 glass">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sky-300/80 text-sm">{dateText} (IST)</div>
            <button className="text-xl hover:scale-110 transition" title="Notifications">
              🔔
            </button>
          </div>
          <div className="space-y-3 text-white">
            {/* Leave summary */}
            <div className="glass-chip px-4 py-3 rounded-xl">
              {onLeave.length > 0 ? (
                <span className="font-semibold">{onLeave.join(', ')} {onLeave.length > 1 ? 'are' : 'is'} on leave today</span>
              ) : (
                <span className="font-semibold">Your whole team is working today no one is on leave</span>
              )}
            </div>

            {/* A shift (separate box) */}
            {shiftA.length > 0 && (
              <div className="glass-chip px-4 py-3 rounded-xl">
                {shiftA.map((emp) => (
                  <div key={`A-${emp}`} className="text-sm font-semibold">{emp} is doing morning shift today</div>
                ))}
              </div>
            )}


            {/* C shift (separate box) */}
            {shiftC.length > 0 && (
              <div className="glass-chip px-4 py-3 rounded-xl">
                {shiftC.map((emp) => (
                  <div key={`C-${emp}`} className="text-sm font-semibold">{emp} is doing night shift today</div>
                ))}
              </div>
            )}

            {/* Weekend WS availability */}
            {isWeekend && wsAvailable.length > 0 && (
              <div className="glass-chip px-4 py-3 rounded-xl">
                {wsAvailable.map((emp) => (
                  <div key={`WS-${emp}`} className="text-sm font-semibold">{emp} is available on weekend</div>
                ))}
              </div>
            )}

            {/* Shift messages for today (excluding those on leave) */}
            <div className="glass-chip px-4 py-3 rounded-xl">
              {(EMPLOYEES || []).map((emp) => {
                const key = getKey(year, monthName, weekIndex, emp, dayIndex);
                const stored = rota[key];
                const realShift = typeof stored === 'object' ? (stored?.shift ?? defaultShift) : (stored ?? defaultShift);
                const leaveApplied = typeof stored === 'object' ? stored?.leave : undefined;
                if (["PL","CH","RH"].includes(leaveApplied)) return null;
                // Only show A and C shift lines; also show WS availability on weekends
                if (!(realShift === 'A' || realShift === 'C' || (isWeekend && realShift === 'WS'))) return null;
                if (isWeekend && realShift === 'WS') {
                  return (
                    <div key={emp} className="text-sm font-semibold">
                      For WS: {emp} is available today
                    </div>
                  );
                }
                const friendly = realShift === 'A' ? 'morning shift' : 'night shift';
                return (
                  <div key={emp} className="text-sm font-semibold">
                    {emp} will do the {friendly} today (Shift {realShift}).
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        {/* HEADER */}
        <header className="sticky top-0 z-40 px-4 py-3 flex justify-between items-center bg-gradient-to-r from-indigo-800/80 to-sky-800/80 border-b border-white/10 backdrop-blur">
          <div className="flex items-center gap-2 cursor-pointer" onClick={goHome}>
            <BrandLogo className="h-10 w-10 md:h-11 md:w-11 drop-shadow" />
            <h1 className="text-3xl font-black tracking-wide neon-text">MyRota+</h1>
          </div>
          {page !== "landing" && TopNav}
        </header>

        <main className="flex-grow px-4 md:px-6 lg:px-10 py-8">
          {/* Back button below navbar (not on dashboard) */}
          {page !== "landing" && ["report", "logs", "notifications"].includes(page) && (
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
          {/* LANDING */}
          {page === "landing" && (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeInUp gap-6">
              {/* Responsive title: mobile = 2 lines (static + typewriter), desktop = single line */}
              <div className="min-h-[130px] flex flex-col items-center justify-end">
                {/* Mobile: fixed "Welcome" on first line, only second line changes */}
                <h1 className="md:hidden text-4xl font-extrabold text-center leading-tight">
                  <span className="block text-sky-300">Welcome</span>
                  <span className="block neon-text">
                    <span className="inline-block">{displayTypewriterText}</span>
                    <span className="caret ml-1 align-middle inline-block" />
                  </span>
                </h1>

                {/* Desktop and larger: single line */}
                <h1 className="hidden md:block text-5xl md:text-6xl font-extrabold text-center">
                  <span className="text-sky-300">Welcome </span>
                  <span className="neon-text">{displayTypewriterText}</span>
                  <span className="caret ml-1" />
                </h1>
              </div>

              {/* Buttons stay in a fixed block below */}
                <div className="flex gap-4 md:gap-6 mt-4">
                <button
                  className="btn-glass"
                  onClick={() => {
                    setShowAdminModal(true);
                    return;
                    if (pass === "password") {
                      setIsAdmin(true);
                      setPage("dashboard");
                    } else alert("❌ Incorrect password");
                  }}
                >
                  Login as Admin
                </button>

                <button
                  className="btn-glass"
                  onClick={() => {
                    // Show dashboard without password as requested
                    setIsAdmin(false);
                    setLoggedEmployee(null);
                    setPage("dashboard");
                  }}
                >
                  Login as Employee
                </button>
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <div className="pb-20">
              {DashboardHeader}
              {WeeksTableAllEmployees}
            </div>
          )}

          {/* SELF EDIT */}
          {page === "selfEdit" && loggedEmployee && (
            <div className="pb-20">
              {SingleUserEditHeader}
              {SingleUserEditTable}
            </div>
          )}

          {/* LOGS */}
          {page === "logs" && isAdmin && LogsPage}

          {/* NOTIFICATIONS */}
          {page === "notifications" && NotificationsPage}

          {/* REPORT */}
          {page === "report" && ReportPage}

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

          {/* EMPLOYEE LOGIN MODAL (only when clicking Update Leave) */}
          {showUpdateModal && !isAdmin && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="rounded-2xl shadow-2xl text-white p-6 w-full max-w-md border border-white/15 bg-slate-900/80 backdrop-blur">
                <h2 className="text-2xl font-extrabold mb-4 text-sky-200">Employee Login</h2>

                <label className="block text-sm font-semibold mb-1">Select User</label>
                <select
                  className="w-full rounded-lg p-2 mb-4 bg-slate-800/80 ring-1 ring-white/10"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                >
                  {EMPLOYEES.map((name) => (
                    <option key={name} value={name} className="text-black">
                      {name}
                    </option>
                  ))}
                </select>

                <label className="block text-sm font-semibold mb-1">Password</label>
                <input
                  type="password"
                  className="w-full rounded-lg p-2 bg-slate-800/80 ring-1 ring-white/10"
                  placeholder="Enter your password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEmployeeLogin(); } }}
                />

                <button className="text-sky-400 underline text-sm mt-2" onClick={handleForgotPassword}>
                  Send password reset link
                </button>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    className="px-4 py-2 rounded-lg glass-chip"
                    onClick={() => { setShowUpdateModal(false); setLoginPass(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleEmployeeLogin}
                  >
                    Login
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EMPLOYEE VIEW MODAL */}
          {employeeView !== null && page !== "selfEdit" && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-xl text-black p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
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

          {/* Shift Block Modal */}
          {showShiftBlockModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white text-black rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-red-600">🚫 Action Not Allowed</h2>
                <p className="mb-6 font-semibold">
                  You have been assigned to a shift on this day.
                  <br />
                  <span className="text-indigo-700 font-bold">You cannot place a leave. Contact Admin.</span>
                </p>
                <button className="btn-primary" onClick={() => setShowShiftBlockModal(false)}>
                  Close
                </button>
              </div>
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer className="text-center py-3 bg-gradient-to-r from-indigo-900/80 to-sky-900/80 text-sm text-indigo-100 font-semibold tracking-wide border-t border-white/10 backdrop-blur">
          © 2025 HCL | All Rights Reserved
        </footer>

        {/* local styles (keyframes & utilities) */}
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeInUp { animation: fadeInUp 1.2s ease-out; }

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

          /* Neon text */
          .neon-text {
            color: #c7dfff;
            text-shadow: 0 0 8px rgba(99, 179, 237, 0.6), 0 0 20px rgba(99, 102, 241, 0.35);
          }

          /* Typewriter caret (thin) */
          @keyframes blink {
            0%, 49% { opacity: 1 }
            50%, 100% { opacity: 0 }
          }
          .caret {
            border-right: 2px solid #7dd3fc;
            animation: blink 1s infinite;
          }

          /* Mobile sticky employee column */
          @media (max-width: 768px) {
            .sticky-name {
              position: sticky;
              left: 0;
              z-index: 10;
              white-space: nowrap;
              background: rgba(2,132,199,0.3);
              backdrop-filter: blur(6px);
            }
          }
        `}</style>
      </div>
    </div>
  );
}





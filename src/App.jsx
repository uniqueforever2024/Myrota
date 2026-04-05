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

const PORTAL_LOGIN_STORAGE_KEY = "myrota.portal.login.v1";
const PORTAL_SHARED_LOGIN_STORAGE_KEY = "myrota.portal.login.shared.v1";
const PORTAL_LOGOUT_QUERY_KEY = "logout";
const PORTAL_DEFAULT_USERNAME = "admin";
const PORTAL_ALLOWED_PASSWORDS = new Set(["VeryGood2022", "VeryGood2019"]);
const CERTIFICATE_STORAGE_KEY = "certificate_new_records_v1";

const clearPortalLoginSession = () => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(PORTAL_LOGIN_STORAGE_KEY);
  } catch {}

  try {
    window.localStorage.removeItem(PORTAL_SHARED_LOGIN_STORAGE_KEY);
  } catch {}
};

const persistPortalLoginSession = (session) => {
  if (typeof window === "undefined") return;

  const serializedSession = JSON.stringify(session);

  try {
    window.sessionStorage.setItem(PORTAL_LOGIN_STORAGE_KEY, serializedSession);
  } catch {}

  try {
    window.localStorage.setItem(PORTAL_SHARED_LOGIN_STORAGE_KEY, serializedSession);
  } catch {}
};

const startOfLocalDay = (dateInput) => {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDaysUntilTargetDate = (dateInput) => {
  if (!dateInput) return Number.POSITIVE_INFINITY;
  const today = startOfLocalDay(new Date());
  const targetDate = startOfLocalDay(dateInput);
  return Math.ceil((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

const readCertificateExpiryAlerts = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(CERTIFICATE_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedRecords = JSON.parse(rawValue);
    if (!Array.isArray(parsedRecords)) {
      return [];
    }

    return parsedRecords
      .map((record, index) => {
        const partnerName = String(record?.partnerName || "").trim();
        const certificateType = String(record?.certificateType || "").trim();
        const expiryDate = String(record?.expiryDate || "").trim();
        const daysUntilExpiry = getDaysUntilTargetDate(expiryDate);

        return {
          id: String(record?.id || `certificate-${index}`),
          partnerName,
          certificateType,
          expiryDate,
          daysUntilExpiry,
        };
      })
      .filter(
        (record) =>
          record.partnerName &&
          record.expiryDate &&
          Number.isFinite(record.daysUntilExpiry) &&
          record.daysUntilExpiry >= 0 &&
          record.daysUntilExpiry <= 15
      )
      .sort((left, right) => {
        if (left.daysUntilExpiry !== right.daysUntilExpiry) {
          return left.daysUntilExpiry - right.daysUntilExpiry;
        }

        return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
      });
  } catch {
    return [];
  }
};

const readPortalLoginSession = () => {
  if (typeof window === "undefined") {
    return { isAuthenticated: false, isAdmin: false };
  }

  try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get(PORTAL_LOGOUT_QUERY_KEY) === "1") {
      clearPortalLoginSession();
      currentUrl.searchParams.delete(PORTAL_LOGOUT_QUERY_KEY);
      const cleanedUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` || "/";
      window.history.replaceState({}, "", cleanedUrl);
      return { isAuthenticated: false, isAdmin: false };
    }

    const rawSession =
      window.sessionStorage.getItem(PORTAL_LOGIN_STORAGE_KEY) ||
      window.localStorage.getItem(PORTAL_SHARED_LOGIN_STORAGE_KEY);

    if (!rawSession) {
      return { isAuthenticated: false, isAdmin: false };
    }

    try {
      window.sessionStorage.setItem(PORTAL_LOGIN_STORAGE_KEY, rawSession);
    } catch {}

    const parsedSession = JSON.parse(rawSession);
    const isAuthenticatedSession =
      parsedSession?.username === PORTAL_DEFAULT_USERNAME &&
      (parsedSession?.isAuthenticated === true || parsedSession?.isAdmin === true);
    const isAdminSession = isAuthenticatedSession && parsedSession?.isAdmin === true;

    return {
      isAuthenticated: isAuthenticatedSession,
      isAdmin: isAdminSession,
    };
  } catch {
    return { isAuthenticated: false, isAdmin: false };
  }
};

const AppGridIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-7 w-7"
  >
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <rect x="14" y="14" width="6" height="6" rx="1.5" />
  </svg>
);

const TransferIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-7 w-7"
  >
    <path d="M3 7h12l2 2h4" />
    <path d="M7 17h14" />
    <path d="m12 11 3-3 3 3" />
    <path d="m18 13-3 3-3-3" />
  </svg>
);

const CertificateIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-7 w-7"
  >
    <path d="M12 3 6.5 5v5.5c0 4 2.3 7.7 5.5 9.5 3.2-1.8 5.5-5.5 5.5-9.5V5L12 3Z" />
    <path d="m9.5 11.8 1.7 1.7 3.3-3.6" />
  </svg>
);

const DocumentationIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-7 w-7"
  >
    <path d="M8 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 7 19V5A1.5 1.5 0 0 1 8.5 3.5Z" />
    <path d="M14 3.5V8h4" />
    <path d="M9.5 11.5h5" />
    <path d="M9.5 15h5" />
  </svg>
);

const LogoutIcon = ({ className = "h-5 w-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M10 5.5H7.5A1.5 1.5 0 0 0 6 7v10a1.5 1.5 0 0 0 1.5 1.5H10" />
    <path d="M14 8.5 18 12l-4 3.5" />
    <path d="M9 12h8.5" />
  </svg>
);

const QUICK_ACCESS_ITEMS = [
  {
    id: "apf",
    label: "APF",
    href: "/APF/APF_NEW/build/index.html",
    Icon: AppGridIcon,
  },
  {
    id: "sftp",
    label: "SFTP",
    href: "/APF/SFTP_NEW/index.html",
    Icon: TransferIcon,
  },
  {
    id: "certificate",
    label: "CERTIFICATE",
    href: "/APF/CERTIFICATE_NEW/public/index.html",
    Icon: CertificateIcon,
  },
  {
    id: "documentation",
    label: "DOCUMENTATION",
    href: "/APF/DOCUMENTATION_NEW/index.html",
    Icon: DocumentationIcon,
  },
];

const QuickAccessRibbon = () => (
  <section className="quick-ribbon-wrap px-4 pb-2 pt-4 sm:px-6 lg:px-10" aria-label="Microsites">
    <div className="quick-ribbon relative overflow-hidden rounded-[28px] border border-white/12 px-4 py-5 sm:px-6 sm:py-6">
      <div className="quick-ribbon-glow quick-ribbon-glow-blue" />
      <div className="quick-ribbon-glow quick-ribbon-glow-green" />
      <div className="quick-ribbon-glow quick-ribbon-glow-yellow" />
      <div className="quick-ribbon-glow quick-ribbon-glow-red" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-2xl font-black tracking-[0.12em] text-white sm:text-3xl">
            LC EDI MICROSITES
          </h2>
          <p className="mt-2 text-sm font-semibold tracking-[0.08em] text-sky-100/78 sm:text-base">
            (Under Testing Phase :) )
          </p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {QUICK_ACCESS_ITEMS.map(({ id, label, href, Icon }) => (
            <a
              key={id}
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`quick-link-card quick-link-card--${id}`}
              aria-label={label}
            >
              <span className={`quick-link-icon quick-link-icon--${id}`}>
                <Icon />
              </span>
              <span className="quick-link-label">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  </section>
);

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

const HIDDEN_EMPLOYEE_IDS = new Set(["admin"]);

const isVisibleEmployeeName = (name) =>
  !HIDDEN_EMPLOYEE_IDS.has(String(name ?? "").trim().toLowerCase());

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
  names
    .filter(isVisibleEmployeeName)
    .map(getEmployeeDisplayName)
    .forEach((name) => {
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
  const initialPortalSession = readPortalLoginSession();
  const prefersDark = true; // default dark
  const [page, setPage] = useState("home"); // home | dashboard | logs | report | notifications | jira-details
  const [isAuthenticated, setIsAuthenticated] = useState(initialPortalSession.isAuthenticated);
  const [isAdmin, setIsAdmin] = useState(initialPortalSession.isAdmin);
  const [darkMode] = useState(prefersDark);
  const [loginForm, setLoginForm] = useState({
    username: PORTAL_DEFAULT_USERNAME,
    password: "",
  });
  const [loginError, setLoginError] = useState("");
  const [certificateExpiryAlerts, setCertificateExpiryAlerts] = useState(() =>
    readCertificateExpiryAlerts()
  );

  // Simple nav history stack to support Back
  const navStackRef = useRef(["home"]);
  useEffect(() => {
    const stack = navStackRef.current;
    if (stack[stack.length - 1] !== page) {
      stack.push(page);
      if (stack.length > 100) stack.shift();
    }
  }, [page]);

  useEffect(() => {
    const refreshCertificateAlerts = () => {
      setCertificateExpiryAlerts(readCertificateExpiryAlerts());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshCertificateAlerts();
      }
    };

    refreshCertificateAlerts();
    window.addEventListener("storage", refreshCertificateAlerts);
    window.addEventListener("focus", refreshCertificateAlerts);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", refreshCertificateAlerts);
      window.removeEventListener("focus", refreshCertificateAlerts);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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

          if (!isVisibleEmployeeName(empName)) return;
          if (!leaveEntries.includes(empName)) leaveEntries.push(empName);
        });
      } catch {}
    }

    return leaveEntries;
  };

  const handlePortalLogin = (event) => {
    event.preventDefault();

    const normalizedUsername = loginForm.username.trim().toLowerCase();
    const typedPassword = loginForm.password.trim();

    if (normalizedUsername !== PORTAL_DEFAULT_USERNAME || !PORTAL_ALLOWED_PASSWORDS.has(typedPassword)) {
      setLoginError("Invalid user ID or password.");
      return;
    }

    persistPortalLoginSession({
      username: PORTAL_DEFAULT_USERNAME,
      isAuthenticated: true,
      isAdmin: false,
      loggedInAt: Date.now(),
    });

    navStackRef.current = ["home"];
    setPage("home");
    setShowAdminModal(false);
    setAdminPass("");
    setIsAuthenticated(true);
    setIsAdmin(false);
    setLoginError("");
    setLoginForm({
      username: PORTAL_DEFAULT_USERNAME,
      password: "",
    });
  };

  const handlePortalLogout = () => {
    clearPortalLoginSession();

    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has(PORTAL_LOGOUT_QUERY_KEY)) {
        currentUrl.searchParams.delete(PORTAL_LOGOUT_QUERY_KEY);
        const cleanedUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` || "/";
        window.history.replaceState({}, "", cleanedUrl);
      }
    } catch {}

    navStackRef.current = ["home"];
    setEmployeeView(null);
    setJiraDetailView(null);
    setShowAdminModal(false);
    setAdminPass("");
    setLoginError("");
    setLoginForm({
      username: PORTAL_DEFAULT_USERNAME,
      password: "",
    });
    setPage("home");
    setIsAdmin(false);
    setIsAuthenticated(false);
  };

  const handleAdminLogout = () => {
    navStackRef.current = ["home"];
    setEmployeeView(null);
    setJiraDetailView(null);
    setShowAdminModal(false);
    setAdminPass("");
    setPage("home");
    setIsAdmin(false);
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
        <button
          onClick={() => setPage("dashboard")}
          title="ROTA"
          className={`top-nav-text-button nav-rota-button rounded-xl px-3 py-2 text-xs font-black tracking-[0.24em] transition md:text-sm ${
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
        className={`top-nav-text-button rounded-xl px-3 py-2 text-xs font-black tracking-[0.24em] transition md:text-sm ${
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
          className="top-nav-icon-button inline-flex items-center justify-center rounded-xl text-2xl transition text-white/90 hover:scale-110"
        >
          📄
        </button>
      )}

      {/* HOME (white) */}
      <button
        onClick={goHome}
        title="Home"
        className={`top-nav-text-button rounded-xl px-3 py-2 text-xs font-black tracking-[0.24em] transition md:text-sm ${
          page === "home"
            ? "btn-glass text-white"
            : "glass-chip hover:scale-105"
        }`}
      >
        HOME
      </button>

      {isAdmin && (
        <button
          type="button"
          onClick={handleAdminLogout}
          title="Logout from admin mode"
          aria-label="Logout from admin mode"
          className="top-nav-icon-button inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-100 transition hover:scale-105 hover:border-amber-300/35 hover:bg-amber-400/16 hover:text-white"
        >
          <LogoutIcon />
        </button>
      )}

      <button
        type="button"
        onClick={handlePortalLogout}
        title="Logout"
        aria-label="Logout"
        className="top-nav-icon-button inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rose-300/20 bg-rose-400/10 text-rose-100 transition hover:scale-105 hover:border-rose-300/35 hover:bg-rose-400/16 hover:text-white"
      >
        <LogoutIcon />
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
            if (!isVisibleEmployeeName(empName)) return;
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
      <div className="flex h-full w-full flex-col rounded-2xl border border-emerald-200/15 bg-gradient-to-br from-emerald-950/50 via-green-950/30 to-white/[0.03] p-6 shadow-[0_22px_60px_rgba(6,78,59,0.32)] glass transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(6,95,70,0.38)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-emerald-200/80 text-sm">{dateText} (IST)</div>
          <span className="rounded-full border border-emerald-200/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-100 backdrop-blur-md">
            Live Team Status
          </span>
        </div>
        <div className="flex-1 space-y-2 text-emerald-50 sm:space-y-3">
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
      <div className="flex h-full w-full flex-col rounded-2xl border border-rose-200/15 bg-gradient-to-br from-rose-950/55 via-red-950/35 to-white/[0.03] p-6 shadow-[0_22px_60px_rgba(127,29,29,0.35)] glass transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_72px_rgba(127,29,29,0.42)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-2xl font-extrabold text-rose-100">Leave Plan</h3>
          <span className="rounded-full border border-rose-200/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-rose-100 backdrop-blur-md">
            Next 3 Days
          </span>
        </div>
        <div className="flex-1 space-y-2 text-rose-50">
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

  const CertificateExpiryPanel = (() => {
    const formatExpiryDate = (expiryDate) =>
      new Date(`${expiryDate}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

    return (
      <div className="flex h-full w-full flex-col rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-950/55 via-orange-950/35 to-white/[0.03] p-6 shadow-[0_22px_60px_rgba(146,64,14,0.35)] glass transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_72px_rgba(180,83,9,0.42)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-2xl font-extrabold text-amber-100">Certificate Alert</h3>
          <span className="rounded-full border border-amber-200/20 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-amber-100 backdrop-blur-md">
            Next 15 Days
          </span>
        </div>
        <div className="flex-1 space-y-2 text-amber-50">
          {certificateExpiryAlerts.length > 0 ? (
            certificateExpiryAlerts.map((record) => {
              const dayMessage =
                record.daysUntilExpiry === 0
                  ? "expires today"
                  : record.daysUntilExpiry === 1
                    ? "expires in 1 day"
                    : `expires in ${record.daysUntilExpiry} days`;

              return (
                <div
                  key={record.id}
                  className="rounded-xl border border-amber-100/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
                >
                  <div>{record.partnerName} {dayMessage} ({formatExpiryDate(record.expiryDate)})</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-100/70">
                    {record.certificateType || "Certificate"}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-amber-100/15 bg-white/[0.06] px-4 py-3 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
              No certificates are expiring in the next 15 days.
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
        <div className="grid gap-6 xl:auto-rows-fr xl:grid-cols-3 xl:items-stretch">
          <div className="flex h-full min-w-0">
            {NotificationsPanel}
          </div>
          <div className="flex h-full min-w-0">
            {LeavePlanPanel}
          </div>
          <div className="flex h-full min-w-0">
            {CertificateExpiryPanel}
          </div>
        </div>
      </section>

      <section>
        <JiraDashboardSection onOpenView={openJiraDetailView} />
      </section>
    </div>
  );

  const PortalLoginPage = (
    <>
      <main className="login-shell relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-10">
        <div className="login-orb login-orb-blue" />
        <div className="login-orb login-orb-green" />
        <div className="login-orb login-orb-yellow" />
        <div className="login-orb login-orb-red" />

        <div className="relative grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center">
          <section className="login-hero rounded-[30px] border border-white/10 p-7 sm:p-10">
            <div className="login-hero-content">
              <div className="login-ribbon">
                <p className="text-xs font-black uppercase tracking-[0.36em] text-sky-200/80">
                  Secure Access
                </p>
              </div>

              <div className="login-brand-lockup">
                <div className="login-brand-mark">
                  <BrandLogo className="login-brand-logo" />
                  <h1 className="login-brand-title">
                    My<span className="logo-blue">R</span>
                    <span className="logo-green">o</span>
                    <span className="logo-yellow">t</span>
                    <span className="logo-red">a</span>+
                  </h1>
                </div>
              </div>

              <div className="login-powered-note">
                <span className="login-powered-label">Powered and maintained by</span>
                <span className="login-powered-logo" aria-label="HCLTech">
                  <span className="login-powered-logo-h">HCL</span>
                  <span className="login-powered-logo-tech">Tech</span>
                </span>
              </div>
            </div>
          </section>

          <section className="login-card rounded-[30px] border border-white/12 p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.34em] text-sky-200/80">
                Portal Login
              </p>
              <h3 className="mt-3 text-3xl font-black text-white">Sign in</h3>
              <p className="mt-2 text-sm font-medium text-slate-300/85">
                Enter the default admin credentials to continue to the MyRota home page.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handlePortalLogin}>
              <label className="block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.2em] text-slate-200/80">
                  User ID
                </span>
                <input
                  type="text"
                  value={loginForm.username}
                  readOnly
                  className="login-input"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.2em] text-slate-200/80">
                  Password
                </span>
                <input
                  type="password"
                  value={loginForm.password}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="login-input"
                  onChange={(event) =>
                    setLoginForm((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                />
                <span className="mt-2 block text-xs font-semibold tracking-[0.16em] text-sky-100/70">
                  LC B2Bi password
                </span>
              </label>

              {loginError ? (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
                  {loginError}
                </div>
              ) : null}

              <button type="submit" className="btn-primary w-full py-3 text-sm uppercase tracking-[0.26em]">
                Login
              </button>
            </form>
          </section>
        </div>
      </main>

      <footer className="simple-footer glass-footer">
        <p className="text-sm tracking-wide footer-copy">
          &copy; 2025 HCL | All Rights Reserved
        </p>
      </footer>
    </>
  );

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        {!isAuthenticated ? (
          PortalLoginPage
        ) : (
          <>
        {/* HEADER */}
        <header className="app-header sticky top-0 z-40 flex items-center justify-between gap-3 px-3 py-3 sm:px-4 glass-nav">
          <div
            className="app-brand flex min-w-0 items-center gap-1.5 sm:gap-2 cursor-pointer"
            onClick={handleLogoClick}
            title={isAdmin ? "Back to home" : "Open admin mode"}
          >
            <BrandLogo className="app-brand-logo h-8 w-8 shrink-0 sm:h-10 sm:w-10 md:h-11 md:w-11 drop-shadow" />
            <h1 className="text-3xl font-black leading-none logo-title">
              My<span className="logo-blue">R</span>
              <span className="logo-green">o</span>
              <span className="logo-yellow">t</span>
              <span className="logo-red">a</span>+
            </h1>
          </div>
          {TopNav}
        </header>

        {page === "home" && <QuickAccessRibbon />}

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
          </>
        )}

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
          .app-header {
            row-gap: 0.85rem;
          }
          .app-brand,
          .top-nav-actions {
            min-width: 0;
          }
          .top-nav-text-button,
          .top-nav-icon-button,
          .nav-featured-item {
            flex: 0 0 auto;
          }
          .top-nav-icon-button {
            min-height: 2.75rem;
            min-width: 2.75rem;
          }
          .login-shell {
            isolation: isolate;
          }
          .login-orb {
            position: absolute;
            border-radius: 999px;
            filter: blur(60px);
            opacity: 0.34;
            pointer-events: none;
          }
          .login-orb-blue {
            top: 5%;
            left: -4%;
            height: 240px;
            width: 240px;
            background: rgba(96, 165, 250, 0.34);
          }
          .login-orb-green {
            bottom: 10%;
            left: 20%;
            height: 220px;
            width: 220px;
            background: rgba(52, 211, 153, 0.22);
          }
          .login-orb-yellow {
            top: 16%;
            right: 12%;
            height: 220px;
            width: 220px;
            background: rgba(250, 204, 21, 0.18);
          }
          .login-orb-red {
            right: -3%;
            bottom: -2%;
            height: 240px;
            width: 240px;
            background: rgba(248, 113, 113, 0.18);
          }
          .login-hero,
          .login-card {
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(22px);
            -webkit-backdrop-filter: blur(22px);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.12),
              0 24px 60px rgba(2, 6, 23, 0.34);
          }
          .login-hero {
            background:
              radial-gradient(circle at top left, rgba(96, 165, 250, 0.14), transparent 34%),
              radial-gradient(circle at bottom right, rgba(52, 211, 153, 0.12), transparent 38%),
              rgba(255,255,255,0.05);
          }
          .login-card {
            background:
              radial-gradient(circle at top right, rgba(250, 204, 21, 0.12), transparent 32%),
              radial-gradient(circle at bottom left, rgba(248, 113, 113, 0.12), transparent 36%),
              rgba(7, 15, 36, 0.72);
          }
          .login-hero-content {
            display: flex;
            min-height: 100%;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            gap: 1.5rem;
            text-align: center;
            width: 100%;
          }
          .login-ribbon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            border: 1px solid rgba(125, 211, 252, 0.22);
            background: rgba(56, 189, 248, 0.08);
            padding: 0.75rem 1.2rem;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.12),
              0 16px 34px rgba(2, 6, 23, 0.2);
          }
          .login-brand-lockup {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 1;
            min-height: 260px;
            width: 100%;
          }
          .login-brand-mark {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            max-width: 420px;
            width: 100%;
          }
          .login-brand-logo {
            width: min(100%, 190px);
            height: auto;
            filter: drop-shadow(0 0 28px rgba(96,165,250,0.2));
          }
          .login-brand-title {
            margin: 0;
            font-size: clamp(2.15rem, 5.4vw, 3.8rem);
            font-weight: 1000;
            letter-spacing: 0.06em;
            line-height: 0.98;
            text-transform: none;
            color: #f8fbff;
            text-align: center;
            text-shadow: 0 16px 40px rgba(2, 6, 23, 0.34);
          }
          .login-powered-note {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.9rem;
            width: 100%;
            max-width: 360px;
            border-radius: 22px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.06);
            padding: 1.1rem 1.25rem;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
          }
          .login-powered-label {
            display: block;
            font-size: 0.72rem;
            font-weight: 900;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            color: rgba(186, 230, 253, 0.78);
          }
          .login-powered-logo {
            display: inline-flex;
            align-items: center;
            gap: 0.08em;
            font-size: clamp(1.7rem, 4vw, 2.2rem);
            font-weight: 900;
            letter-spacing: -0.04em;
            line-height: 1;
          }
          .login-powered-logo-h {
            background: linear-gradient(90deg, #2563eb, #10b981, #ef4444);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
          }
          .login-powered-logo-tech {
            color: #f8fbff;
          }
          .login-input {
            width: 100%;
            border-radius: 18px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.07);
            padding: 0.95rem 1rem;
            color: #f8fbff;
            font-size: 0.98rem;
            font-weight: 600;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.08),
              0 10px 24px rgba(2, 6, 23, 0.18);
            transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
          }
          .login-input:focus {
            border-color: rgba(96, 165, 250, 0.6);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.12),
              0 0 0 1px rgba(96,165,250,0.2),
              0 14px 28px rgba(14, 116, 144, 0.22);
            outline: none;
            transform: translateY(-1px);
          }
          .login-input[readonly] {
            color: rgba(226, 232, 240, 0.88);
            cursor: default;
          }
          .quick-ribbon-wrap {
            position: relative;
            z-index: 1;
          }
          .quick-ribbon {
            background:
              linear-gradient(135deg, rgba(8, 15, 40, 0.9), rgba(10, 25, 62, 0.76)),
              linear-gradient(90deg, rgba(96, 165, 250, 0.12), rgba(52, 211, 153, 0.12), rgba(250, 204, 21, 0.1), rgba(248, 113, 113, 0.12));
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.12),
              0 20px 48px rgba(2, 6, 23, 0.34);
            backdrop-filter: blur(22px);
            -webkit-backdrop-filter: blur(22px);
            isolation: isolate;
          }
          .quick-ribbon::before {
            content: "";
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(90deg, rgba(96,165,250,0.6), rgba(52,211,153,0.55), rgba(250,204,21,0.55), rgba(248,113,113,0.6));
            -webkit-mask:
              linear-gradient(#fff 0 0) content-box,
              linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            opacity: 0.65;
            pointer-events: none;
          }
          .quick-ribbon-glow {
            position: absolute;
            border-radius: 999px;
            filter: blur(42px);
            opacity: 0.34;
            pointer-events: none;
          }
          .quick-ribbon-glow-blue {
            top: -28px;
            left: 4%;
            height: 130px;
            width: 130px;
            background: rgba(96, 165, 250, 0.65);
          }
          .quick-ribbon-glow-green {
            top: 18%;
            left: 29%;
            height: 120px;
            width: 120px;
            background: rgba(52, 211, 153, 0.48);
          }
          .quick-ribbon-glow-yellow {
            right: 20%;
            top: -8px;
            height: 120px;
            width: 120px;
            background: rgba(250, 204, 21, 0.42);
          }
          .quick-ribbon-glow-red {
            right: -12px;
            bottom: -20px;
            height: 150px;
            width: 150px;
            background: rgba(248, 113, 113, 0.34);
          }
          .quick-link-card {
            position: relative;
            display: flex;
            min-height: 148px;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.95rem;
            overflow: hidden;
            border-radius: 22px;
            border: 1px solid rgba(255,255,255,0.14);
            background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05));
            color: #f8fbff;
            text-decoration: none;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.16),
              0 14px 34px rgba(15, 23, 42, 0.28);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            transition:
              transform 0.28s ease,
              box-shadow 0.28s ease,
              border-color 0.28s ease,
              background 0.28s ease;
          }
          .quick-link-card::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(255,255,255,0.08), transparent 38%);
            opacity: 0.9;
            pointer-events: none;
          }
          .quick-link-card:hover {
            transform: translateY(-4px);
            border-color: rgba(255,255,255,0.24);
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 18px 38px rgba(15, 23, 42, 0.34);
          }
          .quick-link-icon {
            position: relative;
            z-index: 1;
            display: inline-flex;
            height: 64px;
            width: 64px;
            align-items: center;
            justify-content: center;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.24);
            color: #f8fbff;
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 12px 28px rgba(15, 23, 42, 0.26);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
          }
          .quick-link-icon--apf {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.44), rgba(37, 99, 235, 0.24));
          }
          .quick-link-icon--sftp {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.42), rgba(13, 148, 136, 0.22));
          }
          .quick-link-icon--certificate {
            background: linear-gradient(135deg, rgba(250, 204, 21, 0.42), rgba(245, 158, 11, 0.2));
            color: #fff8db;
          }
          .quick-link-icon--documentation {
            background: linear-gradient(135deg, rgba(248, 113, 113, 0.42), rgba(244, 63, 94, 0.22));
          }
          .quick-link-label {
            position: relative;
            z-index: 1;
            text-align: center;
            font-size: 0.77rem;
            font-weight: 900;
            letter-spacing: 0.22em;
            color: #f8fbff;
          }
          .quick-link-card--apf:hover {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 20px 42px rgba(59, 130, 246, 0.2);
          }
          .quick-link-card--sftp:hover {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 20px 42px rgba(16, 185, 129, 0.2);
          }
          .quick-link-card--certificate:hover {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 20px 42px rgba(245, 158, 11, 0.2);
          }
          .quick-link-card--documentation:hover {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.22),
              0 20px 42px rgba(244, 63, 94, 0.2);
          }
          .nav-featured-item {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
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
          @media (max-width: 768px) {
            .app-header {
              flex-wrap: wrap;
              justify-content: center;
              align-items: center;
            }
            .app-brand {
              width: 100%;
              justify-content: center;
            }
            .top-nav-actions {
              width: 100%;
              justify-content: flex-start;
              flex-wrap: nowrap;
              overflow-x: auto;
              padding-bottom: 0.15rem;
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .top-nav-actions::-webkit-scrollbar {
              display: none;
            }
          }
          @media (max-width: 640px) {
            .app-header {
              gap: 0.7rem;
              padding-top: 0.8rem;
              padding-bottom: 0.8rem;
            }
            .app-brand-logo {
              height: 1.95rem !important;
              width: 1.95rem !important;
            }
            .logo-title {
              font-size: clamp(1.35rem, 6vw, 1.65rem);
              letter-spacing: 0.04em;
            }
            .login-shell {
              padding-top: 2rem;
              padding-bottom: 2rem;
            }
            .login-hero,
            .login-card {
              border-radius: 24px;
            }
            .login-hero-content {
              gap: 1.5rem;
            }
            .login-ribbon {
              padding: 0.7rem 1rem;
            }
            .login-brand-lockup {
              min-height: 200px;
            }
            .login-brand-mark {
              gap: 0.8rem;
            }
            .login-brand-logo {
              width: min(100%, 150px);
            }
            .login-brand-title {
              font-size: clamp(1.9rem, 9vw, 2.7rem);
              letter-spacing: 0.05em;
            }
            .login-powered-note {
              border-radius: 18px;
              padding: 1rem 1.05rem;
            }
            .login-input {
              border-radius: 16px;
              padding: 0.9rem 0.95rem;
            }
            .top-nav-actions {
              gap: 0.45rem !important;
            }
            .nav-featured-item {
              padding-top: 0;
            }
            .top-nav-text-button,
            .nav-rota-button {
              min-height: 2.55rem;
              padding: 0.68rem 0.82rem !important;
              font-size: 0.68rem !important;
              letter-spacing: 0.16em !important;
              white-space: nowrap;
            }
            .top-nav-icon-button {
              min-height: 2.55rem;
              min-width: 2.55rem;
              height: 2.55rem !important;
              width: 2.55rem !important;
              font-size: 1.2rem;
            }
            .nav-rota-button {
              min-width: 72px;
            }
            .quick-ribbon-wrap {
              padding-top: 0.85rem;
            }
            .quick-ribbon {
              border-radius: 24px;
              padding-inline: 1rem;
              padding-block: 1.05rem;
            }
            .quick-link-card {
              min-height: 128px;
              border-radius: 18px;
              gap: 0.8rem;
            }
            .quick-link-icon {
              height: 58px;
              width: 58px;
              border-radius: 18px;
            }
            .quick-link-label {
              font-size: 0.66rem;
              letter-spacing: 0.18em;
            }
          }
          @media (max-width: 420px) {
            .logo-title {
              font-size: 1.22rem;
            }
            .top-nav-text-button,
            .nav-rota-button {
              padding: 0.62rem 0.74rem !important;
              font-size: 0.62rem !important;
              letter-spacing: 0.14em !important;
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






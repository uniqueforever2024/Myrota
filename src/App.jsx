import { useState, useEffect } from "react";

/* ------------------ CONSTANTS ------------------ */

const YEARS = [2025, 2026];

const MONTHS_BY_YEAR = {
  2025: ["November", "December"],
  2026: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
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
  { code: "W", label: "Weekend Off" },
];

/* ✅ FIXED EMPLOYEE IDs */
const EMPLOYEES = [
  { id: "EMP001", name: "Tasavuur" },
  { id: "EMP002", name: "Astitva" },
  { id: "EMP003", name: "Piyush" },
  { id: "EMP004", name: "Shikha" },
  { id: "EMP005", name: "Akash" },
  { id: "EMP006", name: "Sourav" },
  { id: "EMP007", name: "Ashraf" },
  { id: "EMP008", name: "Deepthi" },
  { id: "EMP009", name: "Naveen" },
  { id: "EMP010", name: "Arun" },
  { id: "EMP011", name: "Prasanna" },
  { id: "EMP012", name: "Raju" },
  { id: "EMP013", name: "Vishnu" },
  { id: "EMP014", name: "Siddharth" },
];

const CELL_SIZE = "w-16 h-8";
const badgeColor = (code) => {
  const map = {
    A: `bg-blue-300 text-black ${CELL_SIZE}`,
    B: `bg-green-300 text-black ${CELL_SIZE}`,
    C: `bg-yellow-300 text-black ${CELL_SIZE}`,
    PL: `bg-pink-300 text-black ${CELL_SIZE}`,
    RH: `bg-violet-300 text-black ${CELL_SIZE}`,
    CH: `bg-violet-500 text-white ${CELL_SIZE}`,
    WS: `bg-red-500 text-white ${CELL_SIZE}`,
    W: `bg-green-800 text-white ${CELL_SIZE}`,
  };
  return map[code] || `bg-gray-300 text-black ${CELL_SIZE}`;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* Generate calendar weeks Monday → Sunday */
function generateWeeks(year, monthName) {
  const monthIndex = MONTH_INDEX[monthName];
  const firstDate = new Date(year, monthIndex, 1);
  const toMonIndex = (d) => (d + 6) % 7;

  const weeks = [];
  let cursor = new Date(firstDate);

  const firstWeek = [];
  const padStart = toMonIndex(firstDate.getDay());
  for (let i = 0; i < padStart; i++) firstWeek.push({ isPadding: true });

  while (firstWeek.length < 7 && cursor.getMonth() === monthIndex) {
    firstWeek.push({ label: WEEKDAYS[toMonIndex(cursor.getDay())], day: cursor.getDate() });
    cursor.setDate(cursor.getDate() + 1);
  }
  weeks.push(firstWeek);

  while (cursor.getMonth() === monthIndex) {
    const nextWeek = [];
    for (let i = 0; i < 7; i++) {
      if (cursor.getMonth() !== monthIndex) break;
      nextWeek.push({ label: WEEKDAYS[toMonIndex(cursor.getDay())], day: cursor.getDate() });
      cursor.setDate(cursor.getDate() + 1);
    }
    while (nextWeek.length < 7) nextWeek.push({ isPadding: true });
    weeks.push(nextWeek);
  }

  return weeks;
}

/* ------------------ MAIN APP ------------------ */

export default function App() {
  const [page, setPage] = useState("landing");
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState("November");

  /* ✅ Load JSON from localStorage */
  const [rota, setRota] = useState(() =>
    JSON.parse(localStorage.getItem("rotaData") || "{}")
  );

  const weeks = generateWeeks(selectedYear, selectedMonth);

  /* ✅ Auto load latest rota whenever Employee view is opened or month/year changes */
  useEffect(() => {
    if (!isAdmin) {
      const latest = JSON.parse(localStorage.getItem("rotaData"));
      if (latest) setRota(latest);
    }
  }, [isAdmin, selectedYear, selectedMonth]);

  /* ✅ Live sync between tabs/windows */
  useEffect(() => {
    const syncRota = () => {
      const updated = JSON.parse(localStorage.getItem("rotaData"));
      if (updated) setRota(updated);
    };
    window.addEventListener("storage", syncRota);
    return () => window.removeEventListener("storage", syncRota);
  }, []);

  /* ✅ AUTO SAVE */
  const updateShift = (empId, weekIndex, dayIndex, code) => {
    const updated = structuredClone(rota);

    updated[selectedYear] ??= {};
    updated[selectedYear][selectedMonth] ??= [];
    updated[selectedYear][selectedMonth][weekIndex] ??= {};
    updated[selectedYear][selectedMonth][weekIndex][empId] ??= [];

    updated[selectedYear][selectedMonth][weekIndex][empId][dayIndex] = code;

    setRota(updated);
    localStorage.setItem("rotaData", JSON.stringify(updated));  // ✅ auto-save JSON
  };

  /* Landing animation text */
  const rotatingWords = ["MyRota", "MyPlans", "MyTeam", "MyTime"];
  const [word, setWord] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWord((w) => (w + 1) % rotatingWords.length), 900);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-black dark:to-gray-900 text-white">

        {/* HEADER */}
        <header className="p-4 flex justify-between items-center bg-white/10 shadow-xl backdrop-blur-xl">
          <h1 className="text-3xl font-extrabold cursor-pointer" onClick={() => setPage("landing")}>
            MyRota+
          </h1>

          <div className="flex gap-2">
            <button onClick={() => setPage("landing")} className="px-4 py-2 bg-white/20 rounded-lg font-bold">🏠</button>
            <button onClick={() => setDarkMode(!darkMode)} className="px-4 py-2 bg-white/20 rounded-lg font-bold">{darkMode ? "☀" : "🌙"}</button>
          </div>
        </header>

        {/* LANDING PAGE */}
        {page === "landing" && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <h1 className="text-6xl font-extrabold text-white">
              Welcome to <span className="text-yellow-400">{rotatingWords[word]}</span>
            </h1>
            <button
              onClick={() => setPage("login")}
              className="mt-6 px-10 py-3 bg-white rounded-full text-purple-700 font-bold hover:scale-110 transition"
            >
              Get Started →
            </button>
          </div>
        )}

        {/* LOGIN PAGE */}
        {page === "login" && (
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
            <h2 className="text-4xl font-extrabold">Choose Role</h2>

            <div className="flex gap-6">
              <button
                className="px-8 py-3 bg-white text-purple-700 rounded-lg font-bold"
                onClick={() => {
                  const pass = prompt("Enter Admin Password:");
                  if (pass === "password") {
                    setIsAdmin(true);
                    setPage("dashboard");
                  } else alert("❌ Wrong password");
                }}
              >
                Admin
              </button>

              <button
                className="px-8 py-3 bg-white/20 text-white rounded-lg font-bold"
                onClick={() => {
                  setIsAdmin(false);
                  setPage("dashboard");
                }}
              >
                Employee
              </button>
            </div>
          </div>
        )}

        {/* DASHBOARD PAGE */}
        {page === "dashboard" && (
          <div className="p-6 pb-20">

            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
              <h2 className="text-3xl font-extrabold">ROTA — {selectedMonth} {selectedYear}</h2>

              <div className="flex gap-3">
                <select
                  className="px-4 py-2 bg-white/20 rounded-lg text-white"
                  value={selectedYear}
                  onChange={(e) => {
                    const yr = Number(e.target.value);
                    setSelectedYear(yr);
                    setSelectedMonth(MONTHS_BY_YEAR[yr][0]);
                  }}
                >
                  {YEARS.map((yr) => (
                    <option key={yr} value={yr} className="text-black">{yr}</option>
                  ))}
                </select>

                <select
                  className="px-4 py-2 bg-white/20 rounded-lg text-white"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {MONTHS_BY_YEAR[selectedYear].map((m) => (
                    <option key={m} value={m} className="text-black">{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {weeks.map((week, wIndex) => (
              <div key={wIndex} className="mb-8 p-4 rounded-xl bg-white/20 backdrop-blur-xl overflow-x-auto">

                <h3 className="text-xl font-bold mb-3">Week {wIndex + 1}</h3>

                <table className="w-max md:w-full text-center border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="bg-white/30 text-black font-bold">
                      <th className="p-2 sticky left-0 bg-white/30 text-left">Employee</th>
                      {WEEKDAYS.map((wd, i) => (
                        <th key={i} className="p-2">{wd} {week[i]?.day ?? ""}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {EMPLOYEES.map(({ id, name }) => (
                      <tr key={id} className="even:bg-white/10">
                        <td className="p-2 sticky left-0 bg-transparent font-semibold text-left">{name}</td>

                        {week.map((cell, dIndex) => {
                          const value =
                            (rota[selectedYear]?.[selectedMonth]?.[wIndex]?.[id] ?? [])[dIndex] ?? "";

                          return (
                            <td key={dIndex} className="p-1">
                              {cell.isPadding ? (
                                <span className={`inline-flex opacity-40 ${badgeColor("")}`} />
                              ) : isAdmin ? (
                                <select
                                  value={value}
                                  className={`rounded-md text-xs p-1 text-black ${CELL_SIZE}`}
                                  onChange={(e) => updateShift(id, wIndex, dIndex, e.target.value)}
                                >
                                  <option value=""></option>
                                  {SHIFTS.map((shift) => (
                                    <option key={shift.code} value={shift.code}>{shift.code}</option>
                                  ))}
                                </select>
                              ) : value ? (
                                <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold ${badgeColor(value)}`}>
                                  {value}
                                </span>
                              ) : (
                                <span className={`inline-flex opacity-40 ${badgeColor("")}`} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  );
}

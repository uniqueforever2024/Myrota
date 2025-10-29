import { useState, useEffect } from "react";

/* ------------------ CONSTANTS ------------------ */

// Available years
const YEARS = [2025, 2026];

// Months based on year selection
const MONTHS_BY_YEAR: Record<number, string[]> = {
  2025: ["November", "December"],
  2026: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ],
};

// All month name -> JS month index (0-11)
const MONTH_INDEX: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

// Shifts and color codes
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

// Employees list
const EMPLOYEES = [
  "Tasavuur","Piyush","Shikha","Akash",
  "Sourav","Ashraf","Deepthi","Naveen",
  "Arun","Prasanna","Raju","Vishnu","Siddharth"
];

// Color Badge Mapping (fixed size)
const CELL_SIZE = "w-16 h-8"; // fixed width & height for all shift blocks
const badgeColor = (code?: string) => ({
  A: `bg-blue-300 text-black ${CELL_SIZE}`,
  B: `bg-green-300 text-black ${CELL_SIZE}`,
  C: `bg-yellow-300 text-black ${CELL_SIZE}`,
  PL: `bg-pink-300 text-black ${CELL_SIZE}`,
  RH: `bg-violet-300 text-black ${CELL_SIZE}`,
  CH: `bg-violet-500 text-white ${CELL_SIZE}`,
  WS: `bg-red-500 text-white ${CELL_SIZE}`,
  W: `bg-green-800 text-white ${CELL_SIZE}`,
}[code as keyof any] || `bg-gray-300 text-black ${CELL_SIZE}`);

// Weekday labels, Monday-first per requirement
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/* ✅ Generate weeks with Monday→Sunday columns.
   Pad leading/trailing days so each week has 7 cells.
   If month starts on Tue, we add a dummy Mon without date. */
function generateWeeks(selectedYear: number, selectedMonthName: string) {
  const monthIndex = MONTH_INDEX[selectedMonthName]; // correct JS month index

  const firstDate = new Date(selectedYear, monthIndex, 1);
  const lastDate = new Date(selectedYear, monthIndex + 1, 0);

  // JS getDay(): Sun=0..Sat=6 → convert to Mon=0..Sun=6
  const toMonIndex = (d: number) => (d + 6) % 7;

  const weeks: Array<Array<{ label: string; day?: number; isPadding?: boolean }>> = [];
  let cursor = new Date(firstDate);

  // Build first week with paddings before the 1st day so week starts on Monday
  const startPad = toMonIndex(firstDate.getDay());
  const firstWeek: Array<{ label: string; day?: number; isPadding?: boolean }> = [];
  for (let i = 0; i < startPad; i++) {
    firstWeek.push({ label: WEEKDAYS[i], isPadding: true });
  }
  while (firstWeek.length < 7 && cursor.getMonth() === monthIndex) {
    const weekday = WEEKDAYS[toMonIndex(cursor.getDay())];
    firstWeek.push({ label: weekday, day: cursor.getDate() });
    cursor.setDate(cursor.getDate() + 1);
  }
  weeks.push(firstWeek);

  // Build subsequent full weeks with padding after month end to Sunday in the final week
  while (cursor.getMonth() === monthIndex) {
    const week: Array<{ label: string; day?: number; isPadding?: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      if (cursor.getMonth() !== monthIndex) break;
      const weekday = WEEKDAYS[toMonIndex(cursor.getDay())];
      week.push({ label: weekday, day: cursor.getDate() });
      cursor.setDate(cursor.getDate() + 1);
    }

    // If the month ended mid-week, pad the rest until Sunday
    while (week.length < 7) {
      const nextLabel = WEEKDAYS[week.length];
      week.push({ label: nextLabel, isPadding: true });
    }

    weeks.push(week);
  }

  // Edge case: if the month ends exactly on Sunday, the last week will already have 7 days and no padding.
  // If month has only 1 week (rare when first day is Mon and last is Sun but short month), weeks array still correct.

  return weeks;
}

/* ------------------ MAIN APP ------------------ */

export default function App() {
  const [page, setPage] = useState("landing");
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState("January");

  const [rota, setRota] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem("rotaData");
    return saved ? JSON.parse(saved) : {};
  });

  const weeks = generateWeeks(selectedYear, selectedMonth);

  const updateShift = (empIndex: number, weekIndex: number, dayIndex: number, code: string) => {
    const updated: Record<string, any> = structuredClone(rota);
    updated[selectedYear] ??= {};
    updated[selectedYear][selectedMonth] ??= [];
    updated[selectedYear][selectedMonth][weekIndex] ??= [];
    updated[selectedYear][selectedMonth][weekIndex][empIndex] ??= [];
    updated[selectedYear][selectedMonth][weekIndex][empIndex][dayIndex] = code;
    setRota(updated);
  };

  useEffect(() => {
    localStorage.setItem("rotaData", JSON.stringify(rota));
  }, [rota]);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-black dark:to-gray-900 text-white">

        {/* HEADER */}
        <header className="p-4 flex justify-between items-center bg-white/10 backdrop-blur-xl shadow-lg">
          <h1 className="text-3xl font-extrabold cursor-pointer" onClick={() => setPage("landing")}>
            MyRota+
          </h1>

          <button onClick={() => setDarkMode(!darkMode)} className="px-4 py-2 bg-white/20 rounded-lg font-bold">
            {darkMode ? "☀" : "🌙"}
          </button>
        </header>

        {/* LANDING PAGE */}
        {page === "landing" && (
          <div className="flex flex-col items-center justify-center py-32 text-center px-6">
            <h1 className="text-6xl font-extrabold">Welcome to MyRota</h1>
            <button
              onClick={() => setPage("login")}
              className="px-10 py-3 bg-white text-purple-700 font-bold rounded-full hover:scale-110 transition text-xl"
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
                className="px-8 py-3 bg-white text-purple-700 font-bold rounded-lg"
                onClick={() => {
                  const pass = prompt("Enter Admin Password:");
                  if (pass === "password") {
                    setIsAdmin(true);
                    setPage("dashboard");
                  } else {
                    alert("❌ Incorrect password");
                  }
                }}
              >
                Admin
              </button>

              <button
                className="px-8 py-3 bg-white/20 text-white font-bold rounded-lg"
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

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <div className="p-6 pb-20">

            {/* Dropdowns */}
            <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center mb-6">
              <h2 className="text-3xl font-extrabold">ROTA — {selectedMonth} {selectedYear}</h2>

              <div className="flex gap-3">
                <select className="px-4 py-2 bg-white/20 rounded-lg text-white"
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

            {/* Table */}
            {weeks.map((week, wIndex) => (
              <div key={wIndex} className="mb-8 bg-white/10 p-4 rounded-xl shadow-lg overflow-x-auto">

                <h3 className="text-xl font-bold mb-3">Week {wIndex + 1}</h3>

                <table className="min-w-full text-center border-collapse text-sm">
                  <thead>
                    <tr className="bg-white/30 text-black font-bold">
                      <th className="p-2 sticky left-0 bg-white/30 z-10 text-left">Employee</th>
                      {WEEKDAYS.map((wd, idx) => (
                        <th key={idx} className="p-2">{wd}{" "}{week[idx]?.day ?? ""}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {EMPLOYEES.map((emp, eIndex) => (
                      <tr key={emp} className="even:bg-white/5">
                        <td className="font-semibold text-left p-2 sticky left-0 bg-inherit z-10">{emp}</td>

                        {week.map((cell, dIndex) => {
                          const value = rota[selectedYear]?.[selectedMonth]?.[wIndex]?.[eIndex]?.[dIndex] ?? "";

                          return (
                            <td className="p-1" key={dIndex}>
                              {cell.isPadding ? (
                                <span className={`inline-flex items-center justify-center rounded-md text-xs opacity-50 ${badgeColor()}`}>
                                  —
                                </span>
                              ) : isAdmin ? (
                                <select
                                  value={value}
                                  className={`rounded-md text-xs p-1 text-black ${CELL_SIZE} inline-block`}
                                  onChange={(e) => updateShift(eIndex, wIndex, dIndex, e.target.value)}
                                >
                                  <option value=""></option>
                                  {SHIFTS.map((shift) => (
                                    <option key={shift.code} value={shift.code}>
                                      {shift.code}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                value ? (
                                  <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold ${badgeColor(value)}`}>
                                    {value}
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center justify-center rounded-md text-xs opacity-40 ${badgeColor()}`}> </span>
                                )
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

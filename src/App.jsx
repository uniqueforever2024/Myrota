import { useState, useEffect } from "react";

/* ------------------ CONSTANTS ------------------ */

// Available years
const YEARS = [2025, 2026];

// Months based on year selection
const MONTHS_BY_YEAR = {
  2025: ["November", "December"],
  2026: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ],
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

// Color Badge Mapping
const badgeColor = (code) => ({
  A: "bg-blue-300 text-black",
  B: "bg-green-300 text-black",
  C: "bg-yellow-300 text-black",
  PL: "bg-pink-300 text-black",
  RH: "bg-violet-300 text-black",
  CH: "bg-violet-500 text-white",
  WS: "bg-red-500 text-white",
  W: "bg-green-800 text-white",
}[code] || "bg-gray-300 text-black");

/* ✅ FIXED — Generate correct weeks with correct weekday/date alignment */
function generateWeeks(selectedYear, selectedMonthName) {
  const monthIndex = MONTHS_BY_YEAR[selectedYear].indexOf(selectedMonthName);

  const weeks = [];
  const firstDay = new Date(selectedYear, monthIndex, 1);

  // Convert to Monday-based index (Mon=0, Tue=1 ... Sun=6)
  const startDayIndex = (firstDay.getDay() + 6) % 7;

  let currentDate = new Date(selectedYear, monthIndex, 1);

  // First Week → starts from actual date (NO padding)
  const firstWeek = [];
  for (let i = startDayIndex; i < 7; i++) {
    firstWeek.push({
      label: currentDate.toLocaleDateString("en-US", { weekday: "short" }),
      day: currentDate.getDate()
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  weeks.push(firstWeek);

  // Remaining Weeks → always Mon → Sun full weeks
  while (currentDate.getMonth() === monthIndex) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      if (currentDate.getMonth() !== monthIndex) break;
      week.push({
        label: currentDate.toLocaleDateString("en-US", { weekday: "short" }),
        day: currentDate.getDate()
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

/* ------------------ MAIN APP ------------------ */

export default function App() {
  const [page, setPage] = useState("landing");
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState("January");

  const [rota, setRota] = useState(() => {
    const saved = localStorage.getItem("rotaData");
    return saved ? JSON.parse(saved) : {};
  });

  const weeks = generateWeeks(selectedYear, selectedMonth);

  const updateShift = (empIndex, weekIndex, dayIndex, code) => {
    const updated = structuredClone(rota);
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-extrabold">ROTA — {selectedMonth} {selectedYear}</h2>

              <div className="flex gap-3">
                <select className="px-4 py-2 bg-white/20 rounded-lg text-white"
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setSelectedMonth(MONTHS_BY_YEAR[e.target.value][0]);
                  }}
                >
                  {YEARS.map((yr) => (
                    <option key={yr} className="text-black">{yr}</option>
                  ))}
                </select>

                <select
                  className="px-4 py-2 bg-white/20 rounded-lg text-white"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {MONTHS_BY_YEAR[selectedYear].map((m, i) => (
                    <option key={i} className="text-black">{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            {weeks.map((week, wIndex) => (
              <div key={wIndex} className="mb-8 bg-white/10 p-4 rounded-xl shadow-lg">

                <h3 className="text-xl font-bold mb-3">Week {wIndex + 1}</h3>

                <table className="min-w-full text-center border-collapse text-sm">
                  <thead>
                    <tr className="bg-white/30 text-black font-bold">
                      <th className="p-2">Employee</th>
                      {week.map((d, idx) => (
                        <th key={idx} className="p-2">{d.label}|{d.day}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {EMPLOYEES.map((emp, eIndex) => (
                      <tr key={emp}>
                        <td className="font-semibold text-left p-2">{emp}</td>

                        {week.map((_, dIndex) => {
                          const value =
                            rota[selectedYear]?.[selectedMonth]?.[wIndex]?.[eIndex]?.[dIndex] ?? "";

                          return (
                            <td className="p-1" key={dIndex}>
                              {isAdmin ? (
                                <select
                                  value={value}
                                  className="rounded-md text-xs p-1 text-black"
                                  onChange={(e) =>
                                    updateShift(eIndex, wIndex, dIndex, e.target.value)
                                  }
                                >
                                  <option value=""></option>
                                  {SHIFTS.map((shift) => (
                                    <option key={shift.code} value={shift.code}>
                                      {shift.code}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                value && (
                                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${badgeColor(value)}`}>
                                    {value}
                                  </span>
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

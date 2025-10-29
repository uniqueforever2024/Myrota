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

// Generate weekly dates for month
function generateWeeks(selectedYear, selectedMonthName) {
  const monthIndex = MONTHS_BY_YEAR[selectedYear].indexOf(selectedMonthName);
  const weeks = [];
  let current = new Date(selectedYear, monthIndex, 1);

  while (current.getMonth() === monthIndex) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      if (current.getMonth() !== monthIndex) break;
      week.push(
        `${current.toLocaleDateString("en-US", { weekday: "short" })}|${current.getDate()}`
      );
      current.setDate(current.getDate() + 1);
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

          <h1
            className="text-3xl font-extrabold tracking-tight cursor-pointer"
            onClick={() => setPage("landing")}
          >MyRota+</h1>

          <div className="flex gap-4">

            {page !== "landing" && (
              <button
                onClick={() => setPage("landing")}
                className="px-5 py-2 bg-white/20 backdrop-blur-lg border border-white/30 hover:bg-white/30 rounded-lg shadow text-white font-semibold flex items-center gap-2 transition"
              >
                🏚
              </button>
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-4 py-2 bg-white/20 backdrop-blur-lg border border-white/30 hover:bg-white/30 rounded-lg shadow text-white font-semibold transition"
            >
              {darkMode ? "☀" : "🌙"}
            </button>

          </div>
        </header>

        {/* LANDING PAGE */}
        {page === "landing" && (
          <div className="flex flex-col items-center justify-center py-32 text-center px-6">
            <h1 className="text-6xl font-extrabold leading-tight">
              Welcome to <span className="text-yellow-300">MyRota</span>
            </h1>
            <p className="max-w-2xl opacity-90 text-lg mb-10 mt-4">
              The easiest way to manage rota, shifts, weekend support, and leaves.
            </p>

            <button
              onClick={() => setPage("login")}
              className="px-10 py-3 bg-white text-purple-700 font-bold rounded-full shadow-lg hover:scale-110 transition text-xl"
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
                className="px-8 py-3 bg-white text-purple-700 font-bold rounded-lg shadow-lg hover:scale-110 transition"
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
                className="px-8 py-3 bg-white/20 backdrop-blur-lg border border-white/40 hover:bg-white/30 text-white font-bold rounded-lg shadow-lg transition"
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

            {/* TITLE + DROPDOWN ROW */}
            <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">

              <h2 className="text-3xl font-extrabold tracking-tight">
                ROTA DASHBOARD — {selectedMonth.toUpperCase()}
              </h2>

              <div className="flex gap-3">
                <select
                  className="px-4 py-2 bg-white/20 backdrop-blur-lg border border-white/30 rounded-lg shadow text-white font-semibold hover:bg-white/30 hover:scale-105 transition"
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
                  className="px-4 py-2 bg-white/20 backdrop-blur-lg border border-white/30 rounded-lg shadow text-white font-semibold hover:bg-white/30 hover:scale-105 transition"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {MONTHS_BY_YEAR[selectedYear].map((m, i) => (
                    <option key={i} className="text-black">{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ROTA TABLE */}
            {weeks.map((week, wIndex) => (
              <div key={wIndex} className="mb-8 bg-white/10 p-4 rounded-xl backdrop-blur-xl shadow-lg">

                <h3 className="text-xl font-bold mb-3">Week {wIndex + 1}</h3>

                <table className="min-w-full text-center border-collapse text-sm">
                  <thead>
                    <tr className="bg-white/30 text-black font-bold">
                      <th className="p-2">Employee</th>
                      {week.map((d, idx) => (
                        <th key={idx} className="p-2">{d}</th>
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

            {/* SHIFT CODE TABLE */}
            <div className="mt-12 bg-white text-black rounded-xl p-4 shadow-md">
              <h3 className="text-lg font-bold mb-3">Definition of Shift Codes</h3>
              <table className="w-full text-left text-sm rounded-lg overflow-hidden border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border px-2 py-1">Code</th>
                    <th className="border px-2 py-1">Description</th>
                    <th className="border px-2 py-1">Color</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="border px-2 py-1">A</td><td>Morning Shift</td><td className="bg-blue-300 border"></td></tr>
                  <tr><td className="border px-2 py-1">B</td><td>Normal Shift</td><td className="bg-green-300 border"></td></tr>
                  <tr><td className="border px-2 py-1">C</td><td>Night Shift</td><td className="bg-yellow-300 border"></td></tr>
                  <tr><td className="border px-2 py-1">PL</td><td>Personal Leave</td><td className="bg-pink-300 border"></td></tr>
                  <tr><td className="border px-2 py-1">RH</td><td>Restricted Holiday</td><td className="bg-violet-300 border"></td></tr>
                  <tr><td className="border px-2 py-1">CH</td><td>Company Holiday</td><td className="bg-violet-500 text-white border"></td></tr>
                  <tr><td className="border px-2 py-1">WS</td><td>Weekend Shift</td><td className="bg-red-500 text-white border"></td></tr>
                  <tr><td className="border px-2 py-1">W</td><td>Weekend Off</td><td className="bg-green-800 text-white border"></td></tr>

                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FOOTER (hidden on login page & landing) */}
        {page !== "login" && page !== "landing" && (
          <footer className="text-center py-4 opacity-80 bg-black/30 text-xs">
            © HCL | 2025 All Rights Reserved
          </footer>
        )}
      </div>
    </div>
  );
}

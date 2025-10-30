// ✅ App.jsx
import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

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
  { code: "W", label: "Weekend Off" },
];

const EMPLOYEES = [
  "Tasavuur", "Astitva", "Piyush", "Shikha", "Akash",
  "Sourav", "Ashraf", "Deepthi", "Naveen",
  "Arun", "Prasanna", "Raju", "Vishnu", "Siddharth"
];

// ✅ Consistent cell size
const CELL = "w-16 h-8 text-center";

/* ✅ Color-coded shift rendering */
const badgeColor = (code) => {
  const map = {
    A: `bg-blue-300 text-black ${CELL}`,
    B: `bg-green-300 text-black ${CELL}`,
    C: `bg-yellow-300 text-black ${CELL}`,
    PL: `bg-pink-300 text-black ${CELL}`,
    RH: `bg-purple-300 text-black ${CELL}`,
    CH: `bg-red-500 text-white ${CELL}`,
    WS: `bg-red-300 text-white ${CELL}`,
    W: `bg-green-800 text-white ${CELL}`,
  };
  return map[code] || `bg-gray-300 text-black ${CELL}`;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------ Helpers ------------------ */

function getKey(year, month, week, emp, day) {
  return `${year}-${month}-${week}-${emp}-${day}`;
}

function getDefaultShift(dayLabel) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(dayLabel) ? "B" : "W";
}

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
  const [page, setPage] = useState("landing");
  const [isAdmin, setIsAdmin] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState("November");

  const [employeeView, setEmployeeView] = useState(null);
  const [collapsedWeeks, setCollapsedWeeks] = useState([]);

  const [rota, setRota] = useState({});

  const weeks = generateWeeks(selectedYear, selectedMonth);

  /* ✅ Realtime Firebase Listener */
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rota", "master"), (snap) => {
      setRota(snap.data() || {});
    });
    return unsub;
  }, []);

  /* ✅ Save to Firebase */
  const updateShift = async (emp, week, day, code) => {
    const key = getKey(selectedYear, selectedMonth, week, emp, day);

    setRota((prev) => ({ ...prev, [key]: code }));

    await setDoc(doc(db, "rota", "master"), { [key]: code }, { merge: true });
  };

  /* ✅ Landing page rotating animation */
  const rotatingWords = ["MyRota", "MyPlans", "MyTeam", "MyTime"];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-600 to-purple-700 dark:from-black dark:to-gray-900 text-white">

        {/* HEADER */}
        <header className="p-4 flex justify-between items-center bg-white/10 backdrop-blur-xl shadow-xl">
          <h1 className="text-3xl font-extrabold cursor-pointer" onClick={() => setPage("landing")}>
            MyRota+
          </h1>

          <div className="flex gap-2">
            <button onClick={() => setPage("landing")} className="px-4 py-2 bg-white/20 rounded-lg font-bold">🏠</button>
            <button onClick={() => setDarkMode(!darkMode)} className="px-4 py-2 bg-white/20 rounded-lg font-bold">
              {darkMode ? "☀" : "🌙"}
            </button>
          </div>
        </header>

        <main className="flex-grow">

          {/* ✅ LANDING PAGE WITH ROTATING TEXT */}
          {page === "landing" && (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6 animate-fadeInUp">

              <h1 className="text-6xl font-extrabold">
                <span className="text-white">Welcome to </span>
                <span className="text-yellow-400">
                  {rotatingWords[currentWordIndex]}
                </span>
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

              {/* selects */}
              <div className="flex flex-col gap-2 md:flex-row justify-between items-center mb-6">
                <h2 className="text-3xl font-extrabold">
                  ROTA — {selectedMonth} {selectedYear}
                </h2>

                <div className="flex gap-3">
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
                </div>
              </div>

              {/* WEEK tables */}
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
                              className="font-semibold text-left p-2 sticky left-0 bg-transparent z-10 min-w-[120px] cursor-pointer hover:text-yellow-300"
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
                                    const value = rota[key] ?? defaultShift;

                                    return isAdmin ? (
                                      <div className={`${badgeColor(value)} rounded-md flex items-center justify-center`}>
                                        <select
                                          value={value}
                                          className="w-full bg-transparent font-bold text-xs cursor-pointer p-1 outline-none"
                                          onChange={(e) => updateShift(empIndex, weekIndex, dayIndex, e.target.value)}
                                        >
                                          {SHIFTS.map((s) => (
                                            <option key={s.code} value={s.code}>
                                              {s.code}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ) : (
                                      <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold ${badgeColor(value)}`}>
                                        {value}
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

              {/* Shift legend */}
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
            </div>
          )}

          {/* EMPLOYEE MODAL */}
          {employeeView !== null && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl text-black p-6 w-full max-w-lg max-height-[80vh] overflow-y-auto">

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
                      const value = rota[key] ?? defaultShift;

                      return (
                        <tr key={i} className="border-b">
                          <td className="p-2">{cell.day}</td>
                          <td className="p-2">{cell.label}</td>
                          <td className="p-2 font-bold">
                            <span className={`inline-flex items-center justify-center rounded-md text-xs font-bold ${badgeColor(value)}`}>
                              {value}
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
        `}</style>

      </div>
    </div>
  );
}

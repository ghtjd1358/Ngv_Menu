import { useState, useEffect, useMemo } from "react";
import { getHoliday } from "./utils/holidays";
import { todayKST } from "./utils/date";
import { stripMenuPrice } from "./utils/menu";

const NAV = { background: "none", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 8px" };
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function cellISO(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function MenuCalendar({ selectedDate, dataByDate, onDateSelect, onMonthChange }) {
  const [view, setView] = useState(() => ({
    year: parseInt(selectedDate.slice(0, 4)),
    month: parseInt(selectedDate.slice(5, 7)),
  }));

  // selectedDate가 바뀌면 달력 뷰를 해당 월로 이동
  useEffect(() => {
    setView({
      year: parseInt(selectedDate.slice(0, 4)),
      month: parseInt(selectedDate.slice(5, 7)),
    });
  }, [selectedDate]);

  // useMemo: 세션 내 날짜가 바뀌지 않으므로 1회만 계산
  const today = useMemo(() => todayKST(), []);
  const { year, month } = view;

  const navigate = (delta) => {
    let y = year, m = month + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setView({ year: y, month: m });
    onMonthChange?.(new Date(y, m - 1, 1));
  };

  // 항상 42칸(6행) 고정 → 월 이동 시 달력 높이 불변
  const startDow = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)];
  while (cells.length < 42) cells.push(null); // 6행 고정

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div style={{ border: "1.5px solid #C8CEDF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(30,36,51,0.07)" }}>
      {/* 헤더: 월 네비게이션 + 요일 */}
      <div style={{ background: "#1E2433", padding: "12px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => navigate(-1)} style={NAV} aria-label="이전 달">‹</button>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{year}년 {month}월</span>
          <button onClick={() => navigate(1)} style={NAV} aria-label="다음 달">›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", paddingBottom: 8 }}>
          {DAY_NAMES.map((name, i) => (
            <div key={i} style={{
              textAlign: "center", fontSize: 12, fontWeight: 700,
              color: i === 0 ? "#F87171" : i === 6 ? "#93C5FD" : "rgba(255,255,255,0.55)",
            }}>
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* 달력 본체 */}
      <div style={{ padding: 6, background: "#fff" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} style={{ minHeight: 90 }} />;

              const iso = cellISO(year, month, day);
              const isSelected = iso === selectedDate;
              const isToday = iso === today;
              const holiday = getHoliday(iso);
              const isRed = di === 0 || !!holiday;
              const isSat = di === 6;

              // 달력 셀: 301동식당 메뉴만 표시
              const menuData = dataByDate[iso];
              const r301 = menuData?.restaurants?.find(r => r.id === "301");
              const menuItems = (r301?.lunch || [])
                .filter(l => l.length > 1 && !l.startsWith("<"))
                .slice(0, 6)
                .map(stripMenuPrice);

              const numColor = isSelected ? "#fff"
                : isRed ? "#F87171"
                : isSat ? "#93C5FD"
                : isToday ? "#4361EE"
                : "#1E2433";

              return (
                <button
                  key={di}
                  onClick={() => onDateSelect(iso)}
                  title={holiday || undefined}
                  style={{
                    background: isSelected ? "#4361EE" : isToday ? "#EEF1FD" : "transparent",
                    border: `1.5px solid ${isToday && !isSelected ? "#4361EE" : "transparent"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    minHeight: 90,
                    minWidth: 0,
                    padding: "6px 3px 5px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: numColor, lineHeight: 1.3, flexShrink: 0 }}>
                    {day}
                  </span>
                  {holiday && !isSelected && (
                    <span style={{ fontSize: 9, color: "#F87171", fontWeight: 700, lineHeight: 1.2, flexShrink: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {holiday
                      .replace("설날 전날", "설날 전")
                      .replace("설날 다음날", "설날 후")
                      .replace("추석 전날", "추석 전")
                      .replace("추석 다음날", "추석 후")
                      .replace(/ (전날|다음날|연휴)$/, "")}
                    </span>
                  )}
                  {menuItems.map((item, i) => (
                    <span key={i} style={{
                      fontSize: 13,
                      lineHeight: 1.3,
                      color: isSelected ? "rgba(255,255,255,0.88)" : "#5B6070",
                      width: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: "0 2px",
                      textAlign: "center",
                    }}>
                      {item}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

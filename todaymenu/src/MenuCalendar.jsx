import { useState, useEffect } from "react";
import { getHoliday } from "./utils/holidays";

const NAV = { background: "none", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 8px" };
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function cellISO(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKST() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

// 메뉴 텍스트 정규화
function cleanItem(text) {
  return text.replace(/\s*[：:]\s*[\d,]+원\s*$/, "").trim();
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

  const today = todayKST();
  const { year, month } = view;

  const navigate = (delta) => {
    let y = year, m = month + delta;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setView({ year: y, month: m });
    onMonthChange?.(new Date(y, m - 1, 1));
  };

  // 달력 그리드 생성
  const startDow = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div style={{ border: "1px solid #DEE3EF", borderRadius: 16, overflow: "hidden" }}>
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
              textAlign: "center", fontSize: 11, fontWeight: 700,
              color: i === 0 ? "#F87171" : i === 6 ? "#93C5FD" : "rgba(255,255,255,0.55)",
            }}>
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* 달력 본체 */}
      <div style={{ padding: 6 }}>
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
                .map(cleanItem);

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
                    padding: "6px 3px 5px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: numColor, lineHeight: 1.3, flexShrink: 0 }}>
                    {day}
                  </span>
                  {holiday && !isSelected && (
                    <span style={{ fontSize: 9, color: "#F87171", fontWeight: 700, lineHeight: 1.2, flexShrink: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {holiday.replace(/ (전날|다음날|연휴)$/, "")}
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

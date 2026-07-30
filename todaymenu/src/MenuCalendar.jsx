import { useState, useEffect, useMemo } from "react";
import { getHoliday } from "./utils/holidays";
import { todayKST } from "./utils/date";
import { stripMenuPrice } from "./utils/menu";

const NAV = { background: "none", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 8px" };
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_LABELS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function cellISO(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDayToISO(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export default function MenuCalendar({ selectedDate, dataByDate, availableDates = [], onDateSelect, onMonthChange }) {
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const [view, setView] = useState(() => ({
    year: parseInt(selectedDate.slice(0, 4)),
    month: parseInt(selectedDate.slice(5, 7)),
  }));

  // 키보드 포커스 날짜 (선택과 독립적으로 달력 내 포커스 위치 추적)
  const [focusedISO, setFocusedISO] = useState(selectedDate);

  useEffect(() => {
    setView({
      year: parseInt(selectedDate.slice(0, 4)),
      month: parseInt(selectedDate.slice(5, 7)),
    });
    setFocusedISO(selectedDate);
  }, [selectedDate]);

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
  const lastDay  = new Date(year, month, 0).getDate();
  const cells    = [...Array(startDow).fill(null), ...Array.from({ length: lastDay }, (_, i) => i + 1)];
  while (cells.length < 42) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // 키보드 방향키 내비게이션 (data-date attribute로 DOM 요소 직접 포커스)
  function handleKeyDown(iso, e) {
    const DELTAS = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    const delta = DELTAS[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      const target = addDayToISO(iso, delta);
      setFocusedISO(target);
      const ty = parseInt(target.slice(0, 4));
      const tm = parseInt(target.slice(5, 7));
      if (ty !== year || tm !== month) {
        setView({ year: ty, month: tm });
        onMonthChange?.(new Date(ty, tm - 1, 1));
      }
      // data-date selector로 해당 버튼 포커스
      setTimeout(() => {
        document.querySelector(`[data-date="${target}"]`)?.focus();
      }, 0);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDateSelect(iso);
    }
  }

  return (
    <div style={{ border: "1.5px solid #C8CEDF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(30,36,51,0.07)" }}>
      {/* 헤더: 월 내비게이션 + 요일 */}
      <div style={{ background: "#1E2433", padding: "12px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => navigate(-1)} style={NAV} aria-label="이전 달">‹</button>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{year}년 {month}월</span>
          <button onClick={() => navigate(1)} style={NAV} aria-label="다음 달">›</button>
        </div>
        <div role="row" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", paddingBottom: 8 }}>
          {DAY_NAMES.map((name, i) => (
            <div key={name} role="columnheader" aria-label={DAY_LABELS[i]}
              style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: i === 0 ? "#F87171" : i === 6 ? "#93C5FD" : "rgba(255,255,255,0.55)" }}>
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* 달력 본체 */}
      <div role="grid" aria-label={`${year}년 ${month}월 식단 달력`} style={{ padding: 6, background: "#fff" }}>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} role="gridcell" style={{ minHeight: 90 }} />;

              const iso = cellISO(year, month, day);
              const isSelected = iso === selectedDate;
              const isToday    = iso === today;
              const holiday    = getHoliday(iso);
              const isRed      = di === 0 || !!holiday;
              const isSat      = di === 6;

              const menuData  = dataByDate[iso];
              const r301      = menuData?.restaurants?.find(r => r.id === "301");
              const menuItems = (r301?.lunch || [])
                .filter(l => l.length > 1 && !l.startsWith("<"))
                .slice(0, 6)
                .map(stripMenuPrice);

              const isPast     = iso < today;
              const isDisabled = isPast && !availableSet.has(iso) && !menuData;
              const isFocused  = iso === focusedISO;

              const numColor = isSelected ? "#fff"
                : isRed  ? "#F87171"
                : isSat  ? "#93C5FD"
                : isToday ? "#4361EE"
                : "#1E2433";

              const holidayLabel = holiday
                ? holiday
                    .replace("설날 전날", "설날 전")
                    .replace("설날 다음날", "설날 후")
                    .replace("추석 전날", "추석 전")
                    .replace("추석 다음날", "추석 후")
                    .replace(/ (전날|다음날|연휴)$/, "")
                : null;

              return (
                <button
                  key={di}
                  data-date={iso}
                  role="gridcell"
                  aria-label={`${month}월 ${day}일${holiday ? ` ${holiday}` : ""}${isToday ? " 오늘" : ""}${isSelected ? " 선택됨" : ""}`}
                  aria-pressed={isSelected}
                  aria-disabled={isDisabled}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={isDisabled ? undefined : () => onDateSelect(iso)}
                  onKeyDown={isDisabled ? undefined : (e) => handleKeyDown(iso, e)}
                  onFocus={() => setFocusedISO(iso)}
                  disabled={isDisabled}
                  style={{
                    background: isSelected ? "#4361EE" : isToday ? "#EEF1FD" : "transparent",
                    border: `1.5px solid ${isToday && !isSelected ? "#4361EE" : "transparent"}`,
                    borderRadius: 8,
                    cursor: isDisabled ? "default" : "pointer",
                    opacity: isDisabled ? 0.35 : 1,
                    minHeight: 90,
                    minWidth: 0,
                    padding: "6px 3px 5px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    width: "100%",
                    overflow: "hidden",
                    transition: "background 0.13s ease, border-color 0.13s ease",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: numColor, lineHeight: 1.3, flexShrink: 0 }}>
                    {day}
                  </span>
                  {holidayLabel && !isSelected && (
                    <span style={{ fontSize: 9, color: "#F87171", fontWeight: 700, lineHeight: 1.2, flexShrink: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {holidayLabel}
                    </span>
                  )}
                  {menuItems.map((item, i) => (
                    <span key={`${item}-${i}`} style={{
                      fontSize: 13, lineHeight: 1.3,
                      color: isSelected ? "rgba(255,255,255,0.88)" : "#5B6070",
                      width: "100%", overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", padding: "0 2px", textAlign: "center",
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

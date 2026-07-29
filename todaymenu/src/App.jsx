import "./App.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ko } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { getOrCreateAnonymousId } from "./utils/anonymousId";
import { getKSTDateStr } from "./utils/date";
import { stripMenuPrice } from "./utils/menu";
import MenuCalendar from "./MenuCalendar";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#F0F2F8",        // 연한 청회색 배경 – 흰 카드가 뜨도록
  card: "#FFFFFF",      // 카드 순백
  header: "#111827",
  border: "#DDE1EF",
  text1: "#111827",
  text2: "#4B5563",
  text3: "#9CA3AF",
  accent: "#3B5BDB",
  accentLight: "#EEF2FF",
  green: "#059669",
  greenLight: "#D1FAE5",
  amber: "#B45309",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEE2E2",
};

function formatLabel(isoStr) {
  return format(parseISO(isoStr), "M월 d일 EEEE", { locale: ko });
}

// ── Lunch status helpers ─────────────────────────────────────────────────────
function parseLunchHours(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { sh: +m[1], sm: +m[2], eh: +m[3], em: +m[4] };
}

function getLunchStatus(hoursStr) {
  const p = parseLunchHours(hoursStr);
  if (!p) return null;
  const now = new Date();
  const kst = (now.getUTCHours() * 60 + now.getUTCMinutes() + 9 * 60) % (24 * 60);
  const start = p.sh * 60 + p.sm;
  const end = p.eh * 60 + p.em;
  if (kst < start) return { state: "before", diff: start - kst };
  if (kst >= end) return { state: "closed" };
  return { state: "open", diff: end - kst };
}

// ── Menu line parser ─────────────────────────────────────────────────────────
function parseMenuLine(text) {
  const sect = text.match(/^<(.+?)>\s*(.+)?$/);
  if (sect) return { type: "section", label: sect[1], extra: sect[2] || null };
  const priced = text.match(/^(.+?)\s*[：:]\s*(\d[\d,]*원)\s*$/);
  if (priced) return { type: "item", name: stripMenuPrice(text), price: priced[2] };
  return { type: "item", name: text, price: null };
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ hoursStr }) {
  const [s, setS] = useState(() => getLunchStatus(hoursStr));
  useEffect(() => {
    const id = setInterval(() => setS(getLunchStatus(hoursStr)), 30_000);
    return () => clearInterval(id);
  }, [hoursStr]);
  if (!s) return null;

  const badge = (bg, color, dotColor, label, pulse) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 99, padding: "3px 11px", fontSize: 13, fontWeight: 600, background: bg, color, whiteSpace: "nowrap" }}>
      <span className={pulse ? "pulse" : ""} style={{ width: 6, height: 6, borderRadius: 99, background: dotColor, display: "inline-block" }} />
      {label}
    </span>
  );

  if (s.state === "before") {
    const h = Math.floor(s.diff / 60), m = s.diff % 60;
    return badge(C.amberLight, C.amber, "#F59E0B", h > 0 ? `${h}시간 ${m}분 후 오픈` : `${m}분 후 오픈`, false);
  }
  if (s.state === "closed") return badge(C.redLight, C.red, C.red, "오늘 종료", false);
  return badge(C.greenLight, C.green, C.green, `영업중 · ${s.diff}분 후 종료`, true);
}

// 숨길 섹션 키워드 (회사 직원이 이용 불가한 식당/코너)
const HIDDEN_SECTION_KEYWORDS = ["교직원", "take-out", "테이크아웃", "카페", "고기국수", "제주식", "take out"];

function isSectionHidden(label) {
  const lower = label.toLowerCase();
  return HIDDEN_SECTION_KEYWORDS.some(kw => lower.includes(kw));
}

function ItemList({ items, showPrices = false }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {items.map((item, i) =>
        item.type === "section" ? (
          <li key={i} style={{ paddingTop: i === 0 ? 0 : 4, width: "100%" }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", color: C.accent }}>{item.label}</span>
          </li>
        ) : (
          <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, width: "100%", minWidth: 0 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: C.text1, lineHeight: 1.5, wordBreak: "keep-all" }}>{item.name}</span>
            {showPrices && item.price && <span style={{ fontSize: 13, color: C.text3, whiteSpace: "nowrap", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{item.price}</span>}
          </li>
        )
      )}
    </ul>
  );
}

// ── Restaurant card ──────────────────────────────────────────────────────────
function RestaurantCard({ restaurant, liked, onToggle, accentColor }) {
  const { name, hours, lunch } = restaurant;
  const [showOrder, setShowOrder] = useState(false);

  const { mainItems, orderItems } = useMemo(() => {
    const allParsed = (Array.isArray(lunch) ? lunch : []).map(parseMenuLine);
    const mainItems = [], orderItems = [];
    let state = "main";
    for (const item of allParsed) {
      if (item.type === "section") {
        if (isSectionHidden(item.label)) state = "hidden";
        else if (item.label.includes("주문식")) { state = "order"; orderItems.push(item); }
        else { state = "main"; mainItems.push(item); }
      } else {
        if (state === "main") mainItems.push(item);
        else if (state === "order") orderItems.push(item);
      }
    }
    return { mainItems, orderItems };
  }, [lunch]);

  const hasOrder = orderItems.some(i => i.type === "item");

  const color = accentColor || C.accent;
  return (
    <div style={{ background: C.card, borderRadius: 16, boxShadow: "0 2px 16px rgba(20,30,60,0.08)", borderLeft: `5px solid ${color}`, display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
      <div style={{ padding: "18px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text1 }}>{name}</p>
            {hours && <p style={{ margin: "4px 0 0", fontSize: 13, color: C.text3 }}>{hours}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <StatusBadge hoursStr={hours} />
            <button type="button" onClick={onToggle} aria-pressed={liked}
              style={{ display: "inline-flex", alignItems: "center", borderRadius: 99, padding: "4px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: liked ? C.redLight : C.bg, color: liked ? C.red : C.text3, whiteSpace: "nowrap" }}>
              {liked ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </div>
      <div style={{ height: 1, background: C.border, margin: "0 20px" }} />
      <div style={{ padding: "14px 20px 18px", minWidth: 0, width: "100%" }}>
        {mainItems.length === 0 && !hasOrder ? (
          <p style={{ margin: 0, fontSize: 13, color: C.text3 }}>메뉴 정보 없음</p>
        ) : (
          <>
            {mainItems.length > 0 && <ItemList items={mainItems} />}
            {hasOrder && (
              <div style={{ marginTop: mainItems.length > 0 ? 12 : 0 }}>
                <button type="button" onClick={() => setShowOrder(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, color: C.text3, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ fontSize: 10, transition: "transform 0.15s", display: "inline-block", transform: showOrder ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                  주문식 메뉴 (개인 사비)
                </button>
                {showOrder && (
                  <div style={{ marginTop: 8 }}>
                    <ItemList items={orderItems} showPrices />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Order calculator ─────────────────────────────────────────────────────────
let _rowId = 0;
const emptyRow = () => ({ id: ++_rowId, name: "", sandwichId: "", drinkId: "" });

function OrderCalculator({ sandwiches, drinks }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [copied, setCopied] = useState(false);

  const getPrice = (row) => {
    const s = sandwiches.find(s => s.id === row.sandwichId);
    const d = drinks.find(d => d.id === row.drinkId);
    return (s?.price || 0) + (d?.price || 0);
  };

  const total = rows.reduce((sum, r) => sum + getPrice(r), 0);
  const hasOrders = rows.some(r => r.sandwichId || r.drinkId);

  const update = (id, key, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (id) => setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  const handleCopy = () => {
    const lines = rows
      .filter(r => r.sandwichId || r.drinkId)
      .map(r => {
        const s = sandwiches.find(s => s.id === r.sandwichId);
        const d = drinks.find(d => d.id === r.drinkId);
        return `${r.name || "미입력"}: ${s?.name || "-"}${d && d.price > 0 ? ` + ${d.name}` : ""} = ${getPrice(r).toLocaleString()}원`;
      });
    navigator.clipboard.writeText([...lines, ``, `합계: ${total.toLocaleString()}원`].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputStyle = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 12, color: C.text1, background: C.bg, outline: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1.2fr auto auto", gap: 6 }}>
        {["이름", "샌드위치", "음료", "금액", ""].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.text3, letterSpacing: "0.05em" }}>{h}</span>
        ))}
      </div>
      {rows.map(row => {
        const price = getPrice(row);
        return (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1.2fr auto auto", gap: 6, alignItems: "center" }}>
            <input value={row.name} onChange={e => update(row.id, "name", e.target.value)} placeholder="이름" style={inputStyle} />
            <select value={row.sandwichId} onChange={e => update(row.id, "sandwichId", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">선택</option>
              {sandwiches.map(s => <option key={s.id} value={s.id}>{s.name}{s.price ? ` (${s.price.toLocaleString()}원)` : ""}</option>)}
            </select>
            <select value={row.drinkId} onChange={e => update(row.id, "drinkId", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">없음</option>
              {drinks.map(d => <option key={d.id} value={d.id}>{d.name}{d.price > 0 ? ` (${d.price.toLocaleString()}원)` : ""}</option>)}
            </select>
            <span style={{ fontSize: 12, fontWeight: 600, color: price > 0 ? C.text1 : C.text3, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {price > 0 ? `${price.toLocaleString()}원` : "-"}
            </span>
            <button type="button" onClick={() => removeRow(row.id)}
              style={{ background: "none", border: "none", color: C.text3, cursor: "pointer", fontSize: 16, padding: "0 2px" }}>
              ✕
            </button>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <button type="button" onClick={addRow}
          style={{ background: C.accentLight, color: C.accent, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + 사람 추가
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text1, fontVariantNumeric: "tabular-nums" }}>합계 {total.toLocaleString()}원</span>
      </div>
      <div style={{ height: 1, background: C.border }} />
      <button type="button" onClick={handleCopy} disabled={!hasOrders}
        style={{ background: hasOrders ? C.header : C.border, color: hasOrders ? "#fff" : C.text3, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: hasOrders ? "pointer" : "default" }}>
        {copied ? "복사됨!" : "주문 내역 텍스트로 복사"}
      </button>
    </div>
  );
}

// ── Quiznos modal ────────────────────────────────────────────────────────────
function QuiznosModal({ open, onClose, items = [], drinks = [], updatedAt }) {
  const [tab, setTab] = useState("menu");

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tabBtn = (id, label) => (
    <button type="button" onClick={() => setTab(id)}
      style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", borderRadius: 8, background: tab === id ? C.header : "transparent", color: tab === id ? "#fff" : C.text3 }}>
      {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <button type="button" aria-label="닫기" onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 520, background: C.card, borderRadius: "24px 24px 0 0", padding: 24, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text1 }}>퀴즈노스</p>
          <button type="button" onClick={onClose}
            style={{ background: "#F4F6FB", border: "none", borderRadius: 99, width: 28, height: 28, cursor: "pointer", color: C.text3, fontSize: 13 }}>
            ✕
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {tabBtn("menu", "메뉴")}
          {tabBtn("calculator", "주문 계산")}
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {tab === "menu" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {updatedAt && <p style={{ margin: "0 0 4px", fontSize: 11, color: C.text3 }}>업데이트: {updatedAt}</p>}
              {items.map((it) => (
                <div key={it.id} className="qz-item" style={{ borderRadius: 14, padding: 12, background: C.bg, display: "flex", gap: 12, alignItems: "center" }}>
                  {it.image && <img src={it.image} alt={it.name} style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{it.name}</span>
                      {it.price && <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>{it.price.toLocaleString()}원</span>}
                      {typeof it.calorie === "number" && <span style={{ fontSize: 10, color: C.text3, background: C.border, borderRadius: 99, padding: "1px 7px" }}>{it.calorie} kcal</span>}
                    </div>
                    {it.desc && <p style={{ margin: "3px 0 0", fontSize: 11, color: C.text3, lineHeight: 1.5 }}>{it.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <OrderCalculator sandwiches={items} drinks={drinks} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const TODAY = getKSTDateStr(0);
  const TOMORROW = getKSTDateStr(1);

  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [dataByDate, setDataByDate] = useState({});
  const [loadingDate, setLoadingDate] = useState(null);
  const [errorByDate, setErrorByDate] = useState({});
  const [availableDates, setAvailableDates] = useState([]);
  const [likes, setLikes] = useState({});
  const [anonymousId, setAnonymousId] = useState(null);
  const [quiznosOpen, setQuiznosOpen] = useState(false);
  const [quiznosItems, setQuiznosItems] = useState([]);
  const [quiznosDrinks, setQuiznosDrinks] = useState([]);
  const [quiznosUpdatedAt, setQuiznosUpdatedAt] = useState("");

  const API_BASE =
    import.meta.env.VITE_API_BASE ||
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8787"
      : "https://menu-worker.hojjang18.workers.dev");

  useEffect(() => { setAnonymousId(getOrCreateAnonymousId()); }, []);

  // 브라우저 탭 제목 동적 업데이트
  useEffect(() => {
    document.title = `엔지미식회 · ${formatLabel(selectedDate)}`;
  }, [selectedDate]);

  // 동시 fetch 추적 (loadingDate는 스피너 표시용, inFlight는 dedup용)
  const inFlight = useRef(new Set());

  const fetchMenu = useCallback((date, silent = false) => {
    if (dataByDate[date] || inFlight.current.has(date)) return;
    inFlight.current.add(date);
    if (!silent) setLoadingDate(date);
    fetch(`${API_BASE}/api/menu/today?date=${date}`, { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => {
        setDataByDate(prev => ({ ...prev, [date]: json }));
        if (!silent) setErrorByDate(prev => ({ ...prev, [date]: null }));
      })
      .catch(e => { if (!silent) setErrorByDate(prev => ({ ...prev, [date]: e?.message || "오류" })); })
      .finally(() => { inFlight.current.delete(date); if (!silent) setLoadingDate(null); });
  }, [dataByDate, API_BASE]);

  const fetchMonthData = useCallback((year, month) => {
    fetch(`${API_BASE}/api/menu/month?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(json => {
        if (typeof json === "object" && !json.error) {
          setDataByDate(prev => ({ ...prev, ...json }));
        }
      })
      .catch(() => {});
  }, [API_BASE]);

  useEffect(() => {
    fetchMenu(TODAY);
    fetchMenu(getKSTDateStr(1), true); // 내일 메뉴 선제 로딩 (silent)
    fetch(`${API_BASE}/api/menu/dates`)
      .then(r => r.json())
      .then(json => {
        if (!Array.isArray(json.dates)) return;
        setAvailableDates(json.dates);
        // 캐시된 모든 월의 데이터 한 번에 로드
        const months = [...new Set(json.dates.map(d => d.slice(0, 7)))];
        months.forEach(ym => {
          const [y, m] = ym.split("-");
          fetchMonthData(parseInt(y), parseInt(m));
        });
      })
      .catch(() => {});
  }, [TODAY]);

  const handleMonthChange = useCallback((date) => {
    fetchMonthData(date.getFullYear(), date.getMonth() + 1);
  }, [fetchMonthData]);

  useEffect(() => { fetchMenu(selectedDate); }, [selectedDate]);

  useEffect(() => {
    if (!anonymousId) return;
    fetch(`${API_BASE}/api/favorites`, { headers: { "X-Anonymous-Id": anonymousId } })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const favs = Array.isArray(json.favorites) ? json.favorites : [];
        setLikes(prev => { const next = { ...prev }; favs.forEach(id => { next[id] = true; }); return next; });
      })
      .catch(() => {});
  }, [anonymousId]);

  useEffect(() => {
    fetch("/quiznos.json", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        setQuiznosItems(Array.isArray(json.items) ? json.items : []);
        setQuiznosDrinks(Array.isArray(json.drinks) ? json.drinks : []);
        setQuiznosUpdatedAt(json.updatedAt || "");
      })
      .catch(() => {});
  }, []);

  const handleToggle = useCallback(async (menuId) => {
    if (!anonymousId) return;
    const wasLiked = !!likes[menuId];
    setLikes(prev => ({ ...prev, [menuId]: !wasLiked }));
    try {
      const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Anonymous-Id": anonymousId },
        body: JSON.stringify({ menuId }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLikes(prev => ({ ...prev, [menuId]: json.liked }));
    } catch {
      setLikes(prev => ({ ...prev, [menuId]: wasLiked }));
    }
  }, [anonymousId, likes]);

  const data = dataByDate[selectedDate];
  const loading = loadingDate === selectedDate || (!data && !errorByDate[selectedDate]);
  const error = errorByDate[selectedDate];
  const noMenuData = data?.restaurants?.every(r => r.lunch?.length === 0);

  const r301 = data?.restaurants?.find(r => r.id === "301");
  const dure = data?.restaurants?.find(r => r.id === "dure");

  // 200ms 이내 응답이면 스피너 생략 (빠른 캐시 히트 시 깜빡임 방지)
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (!loading) { setShowSpinner(false); return; }
    const t = setTimeout(() => setShowSpinner(true), 200);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ background: C.header, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/favicon.svg" alt="" style={{ width: 28, height: 28, borderRadius: 8 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>엔지미식회</span>
          </div>
          <span style={{ fontSize: 13, color: "#8A95B0" }}>{formatLabel(selectedDate)}</span>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "24px 20px 32px" }}>
        <div className="app-layout">
          {/* ── 왼쪽: 오늘 메뉴 + 버튼 ── */}
          <div className="left-panel">
            {/* 날짜 헤더 (항상 표시) */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.text3 }}>
                  {selectedDate === TODAY ? "오늘" : selectedDate === TOMORROW ? "내일" : "선택 날짜"}
                </p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text1, lineHeight: 1.2 }}>
                  {formatLabel(selectedDate)}
                </p>
              </div>
              {selectedDate !== TODAY && (
                <button type="button" onClick={() => setSelectedDate(TODAY)}
                  style={{ background: C.accentLight, color: C.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  오늘로
                </button>
              )}
            </div>

            {loading && showSpinner ? (
              /* 200ms 이상 걸릴 때만 스피너 표시 */
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "56px 0", color: C.text3 }}>
                <div className="spinner" />
                <span style={{ fontSize: 14 }}>불러오는 중…</span>
              </div>
            ) : !loading && error ? (
              <div style={{ background: C.redLight, borderRadius: 16, padding: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: C.red }}>{error}</p>
                <button type="button" onClick={() => { setErrorByDate(p => ({ ...p, [selectedDate]: null })); fetchMenu(selectedDate); }}
                  style={{ marginTop: 12, background: C.red, color: "#fff", border: "none", borderRadius: 99, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  다시 시도
                </button>
              </div>
            ) : !loading && noMenuData ? (
              <div style={{ background: C.card, borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 2px 12px rgba(20,30,60,0.07)" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text2 }}>
                  {selectedDate < TODAY ? "해당 날짜의 메뉴 기록이 없습니다"
                    : selectedDate === TODAY ? "오늘 메뉴를 불러오지 못했습니다"
                    : "아직 업데이트되지 않았습니다"}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 13, color: C.text3 }}>
                  {selectedDate < TODAY ? "서비스 시작 이전이거나 기록이 없는 날짜입니다"
                    : selectedDate === TODAY ? "잠시 후 다시 시도해주세요"
                    : "메뉴는 당일 오전 중 업데이트됩니다"}
                </p>
                {selectedDate !== TODAY && (
                  <button type="button" onClick={() => setSelectedDate(TODAY)}
                    style={{ marginTop: 16, background: C.accentLight, color: C.accent, border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    오늘 메뉴 보기
                  </button>
                )}
              </div>
            ) : !loading && data ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {r301 && <RestaurantCard restaurant={r301} accentColor={C.accent} liked={!!likes["301"]} onToggle={() => handleToggle("301")} />}
                {dure && <RestaurantCard restaurant={dure} accentColor={C.green} liked={!!likes["dure"]} onToggle={() => handleToggle("dure")} />}
              </div>
            ) : null}

          </div>

          {/* ── 오른쪽: 달력 + 버튼 ── */}
          <div className="right-panel">
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: C.text3, letterSpacing: "0.04em" }}>메뉴</p>
            <MenuCalendar
              selectedDate={selectedDate}
              dataByDate={dataByDate}
              onDateSelect={setSelectedDate}
              onMonthChange={handleMonthChange}
            />
            {/* 포케 / 퀴즈노스 버튼 */}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button type="button"
                onClick={() => window.open("https://m.booking.naver.com/order/bizes/1397805/items/6691932?theme=place&service-target=map-pc&refererCode=menutab&lang=ko&area=ple", "_blank", "noopener,noreferrer")}
                style={{ background: C.card, color: C.text1, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 4px rgba(20,30,60,0.06)" }}>
                포케 올데이 메뉴
              </button>
              <button type="button" onClick={() => setQuiznosOpen(true)}
                style={{ background: C.card, color: C.text1, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 4px rgba(20,30,60,0.06)" }}>
                퀴즈노스 주문
              </button>
            </div>
          </div>
        </div>
      </main>

      <QuiznosModal
        open={quiznosOpen}
        onClose={() => setQuiznosOpen(false)}
        items={quiznosItems}
        drinks={quiznosDrinks}
        updatedAt={quiznosUpdatedAt}
      />
    </div>
  );
}

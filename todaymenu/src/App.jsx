import "./App.css";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getOrCreateAnonymousId } from "./utils/anonymousId";

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#F4F6FB",
  card: "#FFFFFF",
  header: "#1E2433",
  border: "#DEE3EF",
  text1: "#1E2433",
  text2: "#5B6070",
  text3: "#8892A4",
  accent: "#4361EE",
  accentLight: "#EEF1FD",
  green: "#059669",
  greenLight: "#D1FAE5",
  amber: "#B45309",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEE2E2",
};

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
  if (priced) return { type: "item", name: priced[1].trim(), price: priced[2] };
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

  const style = {
    display: "inline-flex", alignItems: "center", gap: 5,
    borderRadius: 99, padding: "2px 10px",
    fontSize: 11, fontWeight: 600, letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  };

  if (s.state === "before") {
    const h = Math.floor(s.diff / 60), m = s.diff % 60;
    return (
      <span style={{ ...style, background: C.amberLight, color: C.amber }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: "#F59E0B", display: "inline-block" }} />
        {h > 0 ? `${h}시간 ${m}분 후` : `${m}분 후 오픈`}
      </span>
    );
  }
  if (s.state === "closed") {
    return (
      <span style={{ ...style, background: C.redLight, color: C.red }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: C.red, display: "inline-block" }} />
        오늘 종료
      </span>
    );
  }
  return (
    <span style={{ ...style, background: C.greenLight, color: C.green }}>
      <span className="pulse" style={{ width: 6, height: 6, borderRadius: 99, background: C.green, display: "inline-block" }} />
      영업중 · {s.diff}분 후 종료
    </span>
  );
}

// ── Restaurant card ──────────────────────────────────────────────────────────
function RestaurantCard({ restaurant, liked, onToggle }) {
  const { id, name, hours, lunch } = restaurant;
  const items = (Array.isArray(lunch) ? lunch : []).map(parseMenuLine);

  return (
    <div style={{
      background: C.card, borderRadius: 20,
      boxShadow: `0 0 0 1px ${C.border}`,
      display: "flex", flexDirection: "column",
    }}>
      {/* Card header */}
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text1, lineHeight: 1.3 }}>{name}</p>
            {hours && (
              <p style={{ margin: "3px 0 0", fontSize: 11, color: C.text3 }}>{hours}</p>
            )}
          </div>
          <StatusBadge hoursStr={hours} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#EEF0F6", margin: "0 20px" }} />

      {/* Menu list */}
      <div style={{ flex: 1, padding: "16px 20px" }}>
        {items.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: C.text3 }}>메뉴 정보 없음</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((item, i) =>
              item.type === "section" ? (
                <li key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  paddingTop: i === 0 ? 0 : 6,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent }}>
                    {item.label}
                  </span>
                  {item.extra && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>{item.extra}</span>
                  )}
                </li>
              ) : (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, color: C.text1, lineHeight: 1.45 }}>{item.name}</span>
                  {item.price && (
                    <span style={{ fontSize: 11, color: C.text3, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {item.price}
                    </span>
                  )}
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {/* Like button */}
      <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onToggle}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            borderRadius: 99, padding: "4px 12px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "none", transition: "background 0.15s",
            background: liked ? C.redLight : "#F4F6FB",
            color: liked ? C.red : C.text3,
          }}
          aria-pressed={liked}
        >
          {liked ? "찜됨" : "찜하기"}
        </button>
      </div>
    </div>
  );
}

// ── Quiznos modal ────────────────────────────────────────────────────────────
function QuiznosModal({ open, onClose, items = [], updatedAt }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <button type="button" aria-label="닫기" onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer" }} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 480,
        background: C.card, borderRadius: "24px 24px 0 0",
        padding: 24, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text1 }}>퀴즈노스 지원 메뉴</p>
            {updatedAt && <p style={{ margin: "3px 0 0", fontSize: 11, color: C.text3 }}>업데이트: {updatedAt}</p>}
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "#F4F6FB", border: "none", borderRadius: 99, width: 28, height: 28, cursor: "pointer", color: C.text3, fontSize: 13 }}>
            ✕
          </button>
        </div>

        <div style={{ maxHeight: "60vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} className="qz-item" style={{ borderRadius: 14, padding: 12, background: C.bg, display: "flex", gap: 12, alignItems: "center" }}>
              {it.image && (
                <img src={it.image} alt={it.name}
                  style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
                  onError={(e) => { e.currentTarget.style.display = "none"; }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{it.name}</span>
                  {typeof it.calorie === "number" && (
                    <span style={{ fontSize: 10, fontWeight: 500, color: C.text3, background: C.border, borderRadius: 99, padding: "1px 7px" }}>
                      {it.calorie} kcal
                    </span>
                  )}
                </div>
                {it.desc && <p style={{ margin: "3px 0 0", fontSize: 11, color: C.text3, lineHeight: 1.5 }}>{it.desc}</p>}
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={onClose}
          style={{ marginTop: 16, width: "100%", background: C.header, color: "#fff", border: "none", borderRadius: 99, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          닫기
        </button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [likes, setLikes] = useState({});
  const [anonymousId, setAnonymousId] = useState(null);
  const [quiznosOpen, setQuiznosOpen] = useState(false);
  const [quiznosItems, setQuiznosItems] = useState([]);
  const [quiznosUpdatedAt, setQuiznosUpdatedAt] = useState("");

  const API_BASE =
    import.meta.env.VITE_API_BASE ||
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8787"
      : "https://menu-worker.hojjang18.workers.dev");

  useEffect(() => { setAnonymousId(getOrCreateAnonymousId()); }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${API_BASE}/api/menu/today`, { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => { if (alive) { setData(json); setError(""); } })
      .catch(e => { if (alive) setError(e?.message || "메뉴를 불러오지 못했습니다."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!anonymousId) return;
    let alive = true;
    fetch(`${API_BASE}/api/favorites`, { headers: { "X-Anonymous-Id": anonymousId } })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!alive || !json) return;
        const favs = Array.isArray(json.favorites) ? json.favorites : [];
        setLikes(prev => {
          const next = { ...prev };
          favs.forEach(id => { next[id] = true; });
          return next;
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [anonymousId]);

  useEffect(() => {
    fetch("/quiznos.json", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        setQuiznosItems(Array.isArray(json.items) ? json.items : []);
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

  const dateLabel = useMemo(() => {
    if (!data?.date) return "";
    const [y, m, d] = data.date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${m}월 ${d}일 ${days[dt.getDay()]}요일`;
  }, [data?.date]);

  const r301 = data?.restaurants?.find(r => r.id === "301");
  const dure = data?.restaurants?.find(r => r.id === "dure");

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif" }}>
      {/* Header */}
      <header style={{ background: C.header, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 22, height: 22, background: C.accent, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>식</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>엔지미식회</span>
          </div>
          <span style={{ fontSize: 12, color: "#6B7A99" }}>
            {loading ? "불러오는 중…" : dateLabel || "오늘 식단"}
          </span>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px 32px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", fontSize: 13, color: C.text3 }}>
            메뉴 불러오는 중…
          </div>
        ) : error ? (
          <div style={{ background: C.redLight, borderRadius: 16, padding: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.red }}>{error}</p>
            <button type="button" onClick={() => window.location.reload()}
              style={{ marginTop: 12, background: C.red, color: "#fff", border: "none", borderRadius: 99, padding: "6px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              새로고침
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {r301 && <RestaurantCard restaurant={r301} liked={!!likes["301"]} onToggle={() => handleToggle("301")} />}
            {dure && <RestaurantCard restaurant={dure} liked={!!likes["dure"]} onToggle={() => handleToggle("dure")} />}
          </div>
        )}

        {/* Bottom links */}
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button"
            onClick={() => window.open("https://m.booking.naver.com/order/bizes/1397805/items/6691932?theme=place&service-target=map-pc&refererCode=menutab&lang=ko&area=ple", "_blank", "noopener,noreferrer")}
            style={{ background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 99, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            포케 올데이 메뉴
          </button>
          <button type="button" onClick={() => setQuiznosOpen(true)}
            style={{ background: C.card, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 99, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            퀴즈노스 메뉴
          </button>
        </div>
      </main>

      <QuiznosModal open={quiznosOpen} onClose={() => setQuiznosOpen(false)} items={quiznosItems} updatedAt={quiznosUpdatedAt} />
    </div>
  );
}

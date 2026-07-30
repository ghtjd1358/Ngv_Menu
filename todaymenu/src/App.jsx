import "./App.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ko } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { getOrCreateAnonymousId } from "./utils/anonymousId";
import { getKSTDateStr } from "./utils/date";
import { C } from "./constants";

// 로컬 개발 시 .env.local에 VITE_API_BASE=http://localhost:8787 설정
const API_BASE = import.meta.env.VITE_API_BASE ?? "https://menu-worker.hojjang18.workers.dev";
import RestaurantCard from "./components/RestaurantCard";
import QuiznosModal from "./components/QuiznosModal";
import MenuCalendar from "./MenuCalendar";

// ── Date helpers ─────────────────────────────────────────────────────────────
function formatLabel(isoStr) {
  return format(parseISO(isoStr), "M월 d일 EEEE", { locale: ko });
}

function relativeDateLabel(isoStr, todayStr) {
  const diff = Math.round(
    (new Date(isoStr + "T00:00:00Z") - new Date(todayStr + "T00:00:00Z")) / 86400000
  );
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  if (diff > 0) return `${diff}일 후`;
  return `${Math.abs(diff)}일 전`;
}

function formatKSTTime(isoStr) {
  if (!isoStr) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(isoStr));
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const TODAY    = useMemo(() => getKSTDateStr(0), []);
  const TOMORROW = useMemo(() => getKSTDateStr(1), []);

  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [dataByDate,   setDataByDate]   = useState({});
  const [loadingDate,  setLoadingDate]  = useState(null);
  const [errorByDate,  setErrorByDate]  = useState({});
  const [availableDates, setAvailableDates] = useState([]);
  const [likes,        setLikes]        = useState({});
  const [anonymousId,  setAnonymousId]  = useState(null);
  const [quiznosOpen,  setQuiznosOpen]  = useState(false);
  const [quiznosItems, setQuiznosItems] = useState([]);
  const [quiznosDrinks, setQuiznosDrinks] = useState([]);
  const [quiznosUpdatedAt, setQuiznosUpdatedAt] = useState("");

  useEffect(() => { setAnonymousId(getOrCreateAnonymousId()); }, []);

  // 탭 제목 동적 업데이트
  useEffect(() => {
    document.title = `엔지미식회 · ${formatLabel(selectedDate)}`;
  }, [selectedDate]);

  // dataByDate / likes를 ref로 동기화 → useCallback 의존성 최소화
  const inFlight       = useRef(new Set());
  const dataByDateRef  = useRef(dataByDate);
  const likesRef       = useRef(likes);
  useEffect(() => { dataByDateRef.current = dataByDate; }, [dataByDate]);
  useEffect(() => { likesRef.current = likes; }, [likes]);

  // ── Fetch 함수 ──────────────────────────────────────────────────────────────
  const fetchMenu = useCallback((date, silent = false) => {
    if (dataByDateRef.current[date] || inFlight.current.has(date)) return;
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMenuFresh = useCallback((date) => {
    // 강제 새로고침: inFlight/cache 무시하고 재요청
    inFlight.current.delete(date);
    setDataByDate(prev => { const n = { ...prev }; delete n[date]; return n; });
    setErrorByDate(prev => ({ ...prev, [date]: null }));
    // 짧은 딜레이 후 fetchMenu 호출 (state 업데이트 반영 보장)
    setTimeout(() => {
      inFlight.current.delete(date);
      setLoadingDate(date);
      fetch(`${API_BASE}/api/menu/today?date=${date}&fresh=1`, { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(json => {
          setDataByDate(prev => ({ ...prev, [date]: json }));
          setErrorByDate(prev => ({ ...prev, [date]: null }));
        })
        .catch(e => setErrorByDate(prev => ({ ...prev, [date]: e?.message || "오류" })))
        .finally(() => { inFlight.current.delete(date); setLoadingDate(null); });
    }, 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMonthData = useCallback((year, month) => {
    fetch(`${API_BASE}/api/menu/month?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(json => {
        if (typeof json === "object" && !json.error) {
          setDataByDate(prev => ({ ...prev, ...json }));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMenu(TODAY);
    fetchMenu(TOMORROW, true);
    fetch(`${API_BASE}/api/menu/dates`)
      .then(r => r.json())
      .then(json => {
        if (!Array.isArray(json.dates)) return;
        setAvailableDates(json.dates);
        const months = [...new Set(json.dates.map(d => d.slice(0, 7)))];
        months.forEach(ym => {
          const [y, m] = ym.split("-");
          fetchMonthData(parseInt(y), parseInt(m));
        });
      })
      .catch(() => {});
  }, [TODAY, TOMORROW, fetchMonthData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonthChange = useCallback((date) => {
    fetchMonthData(date.getFullYear(), date.getMonth() + 1);
  }, [fetchMonthData]);

  useEffect(() => { fetchMenu(selectedDate); }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const wasLiked = !!likesRef.current[menuId];
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
  }, [anonymousId]);

  // ── 파생 상태 ────────────────────────────────────────────────────────────────
  const data       = dataByDate[selectedDate];
  const loading    = loadingDate === selectedDate || (!data && !errorByDate[selectedDate]);
  const error      = errorByDate[selectedDate];
  const noMenuData = data?.restaurants?.every(r => r.lunch?.length === 0);
  const r301       = data?.restaurants?.find(r => r.id === "301");
  const dure       = data?.restaurants?.find(r => r.id === "dure");

  // 오늘 메뉴 업데이트 전 여부
  // - 오전 8시 전 접속, 또는 updatedAt의 KST 날짜가 오늘이 아닌 경우
  const showStaleMenuBanner = !loading && selectedDate === TODAY && (() => {
    const kstHour = parseInt(
      new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", hour12: false })
        .format(new Date())
    );
    if (kstHour < 8) return true;
    if (data?.updatedAt) {
      const updatedKSTDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" })
        .format(new Date(data.updatedAt));
      return updatedKSTDate !== TODAY;
    }
    return false;
  })();

  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (!loading) { setShowSpinner(false); return; }
    const t = setTimeout(() => setShowSpinner(true), 200);
    return () => clearTimeout(t);
  }, [loading]);

  // ── Render ───────────────────────────────────────────────────────────────────
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

          {/* ── 왼쪽: 오늘 메뉴 ── */}
          <div className="left-panel">
            {/* 날짜 헤더 */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.text3 }}>
                  {relativeDateLabel(selectedDate, TODAY)}
                </p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text1, lineHeight: 1.2 }}>
                  {formatLabel(selectedDate)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {/* 새로고침 버튼 */}
                <button type="button" onClick={() => fetchMenuFresh(selectedDate)} disabled={loading}
                  title="메뉴 새로고침"
                  style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 14, cursor: loading ? "default" : "pointer", color: loading ? C.text3 : C.text2, display: "flex", alignItems: "center" }}>
                  ↻
                </button>
                {selectedDate !== TODAY && (
                  <button type="button" onClick={() => setSelectedDate(TODAY)}
                    style={{ background: C.accentLight, color: C.accent, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    오늘로
                  </button>
                )}
              </div>
            </div>

            {/* 오늘 메뉴 업데이트 전 안내 배너 */}
            {showStaleMenuBanner && (
              <div style={{ background: "#FEFCE8", border: "1px solid #FDE047", borderLeft: "4px solid #EAB308", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#713F12", fontWeight: 500 }}>
                오늘 메뉴는 보통 오전 8시경 업데이트됩니다
              </div>
            )}

            {/* 마지막 업데이트 */}
            {data?.updatedAt && (
              <p style={{ margin: "0 0 14px", fontSize: 12, color: C.text3 }}>
                마지막 업데이트: {formatKSTTime(data.updatedAt)}
              </p>
            )}

            {/* 메뉴 섹션 */}
            {loading && showSpinner ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, padding: "56px 0", color: C.text3 }}>
                <div className="spinner" />
                <span style={{ fontSize: 14 }}>불러오는 중…</span>
              </div>
            ) : !loading && error ? (
              <div style={{ background: C.redLight, borderRadius: 16, padding: 20 }}>
                <p style={{ margin: 0, fontSize: 14, color: C.red }}>{error}</p>
                <button type="button" onClick={() => fetchMenuFresh(selectedDate)}
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
                    : selectedDate === TODAY ? "↻ 버튼으로 다시 시도해보세요"
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
              <div key={selectedDate} className="anim-fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              availableDates={availableDates}
              onDateSelect={setSelectedDate}
              onMonthChange={handleMonthChange}
            />
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

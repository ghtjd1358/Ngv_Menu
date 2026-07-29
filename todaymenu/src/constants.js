// ── 디자인 토큰 ──────────────────────────────────────────────────────────────
export const C = {
  bg: "#F0F2F8",
  card: "#FFFFFF",
  header: "#111827",
  border: "#DDE1EF",
  text1: "#111827",
  text2: "#4B5563",
  text3: "#6B7280",   // WCAG AA 4.77:1 on white (기존 #9CA3AF는 2.85:1로 미달)
  accent: "#3B5BDB",
  accentLight: "#EEF2FF",
  green: "#059669",
  greenLight: "#D1FAE5",
  amber: "#B45309",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEE2E2",
};

// ── API 엔드포인트 (빌드 타임 상수) ─────────────────────────────────────────
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8787"
    : "https://menu-worker.hojjang18.workers.dev");

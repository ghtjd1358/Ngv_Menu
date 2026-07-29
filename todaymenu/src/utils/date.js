// KST(한국 표준시) 기준 오늘 날짜 반환 — Asia/Seoul 명시로 타임존 무관
export function todayKST() {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

// KST 기준 오늘 + offsetDays 날짜 반환
export function getKSTDateStr(offsetDays = 0) {
    const today = todayKST();                       // "YYYY-MM-DD"
    if (offsetDays === 0) return today;
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
    return dt.toISOString().slice(0, 10);
}

export function formatDateKR(isoYmd) {
    const [y, m, d] = isoYmd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${m}.${String(d).padStart(2, "0")} (${days[dt.getDay()]})`;
}

export function guessActiveMeal(now = new Date()) {
    const h = now.getHours();
    if (h < 11) return "breakfast";
    if (h < 16) return "lunch";
    return "dinner";
}

export function formatDateKR(isoYmd) {
    const [y, m, d] = isoYmd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${m}.${String(d).padStart(2, "0")} (${days[dt.getDay()]})`;
}

export function addDays(isoYmd, diff) {
    const [y, m, d] = isoYmd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + diff);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

export function guessActiveMeal(now = new Date()) {
    const h = now.getHours();
    if (h < 11) return "breakfast";
    if (h < 16) return "lunch";
    return "dinner";
}

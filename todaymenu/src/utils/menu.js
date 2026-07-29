// 메뉴 텍스트에서 "이름 : 가격원" 패턴의 가격 부분 제거
export function stripMenuPrice(text) {
    return text.replace(/\s*[：:]\s*[\d,]+원\s*$/, "").trim();
}

// 메뉴 텍스트 파싱: 섹션 헤더(<...>) or 가격 포함 항목 or 일반 항목
export function parseMenuLine(text) {
    const sect = text.match(/^<(.+?)>\s*(.+)?$/);
    if (sect) return { type: "section", label: sect[1], extra: sect[2] || null };
    const priced = text.match(/^(.+?)\s*[：:]\s*(\d[\d,]*원)\s*$/);
    if (priced) return { type: "item", name: stripMenuPrice(text), price: priced[2] };
    return { type: "item", name: text, price: null };
}

// 숨길 섹션 키워드 (회사 직원이 이용 불가한 식당/코너)
export const HIDDEN_SECTION_KEYWORDS = [
    "교직원",
    "take-out",
    "take out",
    "테이크아웃",
    "카페",
    "고기국수",
    "제주식",
];

export function isSectionHidden(label) {
    const lower = label.toLowerCase();
    return HIDDEN_SECTION_KEYWORDS.some(kw => lower.includes(kw));
}

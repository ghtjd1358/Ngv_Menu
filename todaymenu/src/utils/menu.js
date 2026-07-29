// 메뉴 텍스트에서 "이름 : 가격원" 패턴의 가격 부분 제거
export function stripMenuPrice(text) {
    return text.replace(/\s*[：:]\s*[\d,]+원\s*$/, "").trim();
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

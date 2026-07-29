// 메뉴 텍스트에서 "이름 : 가격원" 패턴의 가격 부분 제거
export function stripMenuPrice(text) {
    return text.replace(/\s*[：:]\s*[\d,]+원\s*$/, "").trim();
}

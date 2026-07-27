// utils/anonymousId.js
// 익명 사용자 식별자를 생성하고 관리하는 유틸리티

const STORAGE_KEY = "anonymousId";

/**
 * UUID v4 생성 (간단한 구현)
 */
function generateUUID() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * 익명 사용자 ID를 가져오거나 생성
 * @returns {string} anonymousId
 */
export function getOrCreateAnonymousId() {
	try {
		// localStorage에서 기존 ID 확인
		let id = localStorage.getItem(STORAGE_KEY);
		
		if (!id) {
			// 없으면 새로 생성
			id = generateUUID();
			localStorage.setItem(STORAGE_KEY, id);
		}
		
		return id;
	} catch (e) {
		// localStorage 접근 실패 시 세션용 임시 ID 생성
		console.warn("localStorage 접근 실패, 임시 ID 사용:", e);
		return `temp-${generateUUID()}`;
	}
}

/**
 * 현재 익명 사용자 ID 반환 (없으면 null)
 * @returns {string|null}
 */
export function getAnonymousId() {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

/**
 * 익명 사용자 ID 초기화 (테스트용)
 */
export function resetAnonymousId() {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (e) {
		console.warn("localStorage 초기화 실패:", e);
	}
}


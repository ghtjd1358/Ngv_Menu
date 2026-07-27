// src/index.js
const SOURCE_URL = "https://snuco.snu.ac.kr/foodmenu/";
const KV_KEY_TODAY = "menu:today";
const KV_KEY_FAVORITES_PREFIX = "favorites:"; // favorites:{anonymousId}

function todayISO_KST() {
	const fmt = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Seoul",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return fmt.format(new Date());
}

async function fetchSourceHtml() {
	const res = await fetch(SOURCE_URL, {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
			"Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
			"Cache-Control": "no-cache",
			"Pragma": "no-cache",
			"Sec-Fetch-Dest": "document",
			"Sec-Fetch-Mode": "navigate",
			"Sec-Fetch-Site": "none",
			"Sec-Fetch-User": "?1",
			"Upgrade-Insecure-Requests": "1",
		},
	});
	if (!res.ok) throw new Error(`source fetch failed (HTTP ${res.status})`);
	const html = await res.text();
	if (html.includes("snucert.snu.ac.kr/waf")) throw new Error("WAF blocked: SNU firewall rejected the request");
	return html;
}

// ---- HTML helpers ----
function decodeHtml(s) {
	return s
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"');
}
function stripTags(s) {
	return s.replace(/<\/?[a-z][^>]*>/gi, " ");
}
function extractTd(trHtml, className) {
	const re = new RegExp(
		`<td\\s+class=["']${className}["'][^>]*>([\\s\\S]*?)<\\/td>`,
		"i"
	);
	const m = trHtml.match(re);
	return m ? m[1] : "";
}
function extractTitleName(titleTdHtml) {
	const text = decodeHtml(stripTags(titleTdHtml))
		.replace(/\s+/g, " ")
		.trim();
	return text.replace(/\(\d{2,4}-\d{3,4}\)\s*$/, "").trim();
}
function brToLines(tdInnerHtml) {
	const decoded = decodeHtml(tdInnerHtml);
	const withNewlines = decoded.replace(/<br\s*\/?>/gi, "\n");
	return withNewlines
		.replace(/\r/g, "")
		.split("\n")
		.map((l) => stripTags(l).replace(/\s+/g, " ").trim())
		.filter(Boolean);
}
function findRowHtmlByRestaurantName(pageHtml, restaurantName) {
	const rows = pageHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
	return (
		rows.find(
			(r) => r.includes(restaurantName) && /class=["']title["']/.test(r)
		) || ""
	);
}

// 운영시간 라인에서 시간만 추출
function extractHoursFromLines(lines) {
	const hit = lines.find((l) => l.includes("운영시간"));
	if (!hit) return "";

	const cleaned = hit
		.replace(/^.*운영시간\s*[:：]?\s*/g, "")
		.replace(/^[:\s]+/g, "")
		.trim();

	const m = cleaned.match(/\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2}/);
	return m ? m[0].replace(/\s+/g, "") : cleaned;
}

function isNoticeLine(l) {
	// 안내/주의 문구 제거
	if (l.startsWith("※")) return true;
	if (l.includes("혼잡시간")) return true;
	if (l.includes("라스트")) return true;
	if (l.includes("요일별")) return true;
	if (l.includes("수령")) return true;
	if (l.includes("준비수량")) return true;
	return false;
}

function normalizeMenuLines(lines) {
	return lines
		.map((l) => l.replace(/\s+/g, " ").trim())
		.filter(Boolean);
}

function isHeaderLine(l) {
	return /^<[^>]+>/.test(l) || /^<[^>]+>$/.test(l);
}

// 특정 헤더 섹션만 추출: startHeader 포함, 다음 헤더 전까지
function takeSection(lines, startHeader, stopHeaders) {
	const startIdx = lines.findIndex((l) => l.includes(startHeader));
	console.log("takeSection startHeader:", startHeader, "startIdx:", startIdx);
	if (startIdx < 0) return [];

	const out = [];
	for (let i = startIdx; i < lines.length; i++) {
		const l = lines[i];

		// startIdx 이후에 stop header를 만나면 종료(단, startHeader 자체는 유지)
		if (i > startIdx && stopHeaders.some((h) => l.includes(h))) break;

		out.push(l);
	}
	console.log("takeSection out head:", out.slice(0, 10));
	return out;
}

// ---- restaurant-specific parsing ----

// 두레미담: <셀프코너> 섹션만 ( <주문식 메뉴> 전까지 )
function parseDureLunch(tdLunchHtml) {
	const lines = normalizeMenuLines(brToLines(tdLunchHtml));
	const hours = extractHoursFromLines(lines);

	const section = takeSection(lines, "<셀프코너>", ["<주문식 메뉴>"]);

	const lunch = [];

	console.log("=== DURE RAW LUNCH TD ===");
	console.log(tdLunchHtml.slice(0, 200)); // lunch td 원문 일부
	console.log("=== DURE LINES ===");
	console.log(lines.slice(0, 30));
	for (const l of section) {
		if (l.includes("운영시간")) continue;
		if (isNoticeLine(l)) continue;
		// 헤더 포함(가독성) - 원하면 헤더를 빼고 싶으면 아래 if로 조정
		lunch.push(l);
	}

	return { hours, lunch };
}

// 301동: <식사> 섹션만 ( <TAKE-OUT> 전까지 )
function parse301Lunch(tdLunchHtml) {
	const lines = normalizeMenuLines(brToLines(tdLunchHtml));
	console.log("301 lunch lines head:", lines.slice(0, 25));


	// hours는 <식사> 섹션의 운영시간만
	const mealSectionWithNotices = takeSection(lines, "<식사>", ["TAKE-OUT", "301동1층"]);
	const hours = extractHoursFromLines(mealSectionWithNotices);

	const lunch = [];
	console.log("=== 301 RAW LUNCH TD ===");
	console.log(tdLunchHtml.slice(0, 200));
	console.log("=== 301 LINES ===");
	console.log(lines.slice(0, 30));

	for (const l of mealSectionWithNotices) {
		if (l.includes("운영시간")) continue;
		if (isNoticeLine(l)) continue;


		// "교직원전용식당" 이후는 표시하지 않음
		if (l.includes("교직원전용식당")) break;

		// <식사> 헤더는 유지(원하면 제거 가능)
		if (isHeaderLine(l)) {
			lunch.push(l);
			continue;
		}

		if (l.length < 3) continue;
		lunch.push(l);

	}

	return { hours, lunch };
}

function parseRestaurantRow(trHtml, restaurantId) {
	const titleTd = extractTd(trHtml, "title");
	const lunchTd = extractTd(trHtml, "lunch");
	const name = extractTitleName(titleTd);

	if (!lunchTd) return { id: restaurantId, name, hours: "", lunch: [] };

	if (restaurantId === "dure") {
		const { hours, lunch } = parseDureLunch(lunchTd);
		return { id: restaurantId, name, hours, lunch };
	}
	if (restaurantId === "301") {
		const { hours, lunch } = parse301Lunch(lunchTd);
		return { id: restaurantId, name, hours, lunch };
	}

	// fallback
	const lines = normalizeMenuLines(brToLines(lunchTd));
	return { id: restaurantId, name, hours: extractHoursFromLines(lines), lunch: lines };
}

// ---- KV helpers ----
async function getCachedToday(env) {
	const raw = await env.MENU_KV.get(KV_KEY_TODAY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
async function setCachedToday(env, obj) {
	await env.MENU_KV.put(KV_KEY_TODAY, JSON.stringify(obj), {
		expirationTtl: 60 * 60 * 24,
	});
}
function jsonResponse(obj, status = 200) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "GET, POST, OPTIONS",
			"access-control-allow-headers": "Content-Type, X-Anonymous-Id",
		},
	});
}

// CORS preflight 응답
function corsResponse() {
	return new Response(null, {
		status: 204,
		headers: {
			"access-control-allow-origin": "*",
			"access-control-allow-methods": "GET, POST, OPTIONS",
			"access-control-allow-headers": "Content-Type, X-Anonymous-Id",
			"access-control-max-age": "86400",
		},
	});
}

async function buildTodayMenuJson() {
	const html = await fetchSourceHtml();

	const dureRow = findRowHtmlByRestaurantName(html, "두레미담");
	const r301Row = findRowHtmlByRestaurantName(html, "301동식당");

	const dure = dureRow
		? parseRestaurantRow(dureRow, "dure")
		: { id: "dure", name: "두레미담", hours: "", lunch: [] };

	const r301 = r301Row
		? parseRestaurantRow(r301Row, "301")
		: { id: "301", name: "301동식당", hours: "", lunch: [] };

	return {
		date: todayISO_KST(),
		sourceUrl: SOURCE_URL,
		updatedAt: new Date().toISOString(),
		restaurants: [dure, r301],
	};
}

// ---- Favorites API helpers ----

/**
 * 사용자의 찜 목록 가져오기
 * @param {*} env 
 * @param {string} anonymousId 
 * @returns {Promise<Set<string>>} menuId Set
 */
async function getUserFavorites(env, anonymousId) {
	const key = `${KV_KEY_FAVORITES_PREFIX}${anonymousId}`;
	const raw = await env.MENU_KV.get(key);
	if (!raw) return new Set();
	
	try {
		const arr = JSON.parse(raw);
		return new Set(Array.isArray(arr) ? arr : []);
	} catch {
		return new Set();
	}
}

/**
 * 사용자의 찜 목록 저장
 * @param {*} env 
 * @param {string} anonymousId 
 * @param {Set<string>} favSet 
 */
async function setUserFavorites(env, anonymousId, favSet) {
	const key = `${KV_KEY_FAVORITES_PREFIX}${anonymousId}`;
	const arr = Array.from(favSet);
	await env.MENU_KV.put(key, JSON.stringify(arr), {
		expirationTtl: 60 * 60 * 24 * 365, // 1년
	});
}

/**
 * 요청 헤더에서 anonymousId 추출
 * @param {Request} req 
 * @returns {string|null}
 */
function extractAnonymousId(req) {
	return req.headers.get("X-Anonymous-Id") || null;
}

// ---- Worker entry ----
export default {
	async fetch(req, env, ctx) {
		const url = new URL(req.url);

		// CORS preflight
		if (req.method === "OPTIONS") {
			return corsResponse();
		}

		// GET /api/debug/html - 소스 HTML 앞부분 확인용 (임시)
		if (url.pathname === "/api/debug/html") {
			try {
				const html = await fetchSourceHtml();
				const dureRow = findRowHtmlByRestaurantName(html, "두레미담");
				const r301Row = findRowHtmlByRestaurantName(html, "301동식당");
				const dureLunchTd = dureRow ? extractTd(dureRow, "lunch") : "ROW_NOT_FOUND";
				const r301LunchTd = r301Row ? extractTd(r301Row, "lunch") : "ROW_NOT_FOUND";
				return new Response(JSON.stringify({
					htmlLength: html.length,
					htmlHead: html.slice(0, 500),
					dureRowFound: !!dureRow,
					r301RowFound: !!r301Row,
					dureLunchTdLength: dureLunchTd.length,
					dureLunchTdHead: dureLunchTd.slice(0, 300),
					r301LunchTdLength: r301LunchTd.length,
					r301LunchTdHead: r301LunchTd.slice(0, 300),
				}, null, 2), { headers: { "content-type": "application/json" } });
			} catch (e) {
				return new Response(JSON.stringify({ error: e?.message }), { headers: { "content-type": "application/json" } });
			}
		}

		// GET /api/menu/today
		if (url.pathname === "/api/menu/today") {
			const fresh = url.searchParams.get("fresh") === "1";

			if (!fresh) {
				const cached = await getCachedToday(env);
				if (cached) return jsonResponse(cached);
			}

			try {
				const data = await buildTodayMenuJson();
				ctx.waitUntil(setCachedToday(env, data));
				return jsonResponse(data);
			} catch (e) {
				return jsonResponse(
					{ error: e?.message || "menu build failed", sourceUrl: SOURCE_URL },
					500
				);
			}
		}

		// GET /api/favorites - 사용자의 찜 목록 조회
		if (url.pathname === "/api/favorites" && req.method === "GET") {
			const anonymousId = extractAnonymousId(req);
			
			if (!anonymousId) {
				return jsonResponse({ error: "X-Anonymous-Id header required" }, 400);
			}

			try {
				const favSet = await getUserFavorites(env, anonymousId);
				return jsonResponse({ favorites: Array.from(favSet) });
			} catch (e) {
				return jsonResponse({ error: e?.message || "favorites fetch failed" }, 500);
			}
		}

		// POST /api/favorites/toggle - 찜 토글
		if (url.pathname === "/api/favorites/toggle" && req.method === "POST") {
			const anonymousId = extractAnonymousId(req);
			
			if (!anonymousId) {
				return jsonResponse({ error: "X-Anonymous-Id header required" }, 400);
			}

			try {
				const body = await req.json();
				const { menuId } = body;

				if (!menuId || typeof menuId !== "string") {
					return jsonResponse({ error: "menuId required" }, 400);
				}

				const favSet = await getUserFavorites(env, anonymousId);
				const wasLiked = favSet.has(menuId);

				if (wasLiked) {
					favSet.delete(menuId);
				} else {
					favSet.add(menuId);
				}

				await setUserFavorites(env, anonymousId, favSet);

				return jsonResponse({
					menuId,
					liked: !wasLiked,
					favorites: Array.from(favSet),
				});
			} catch (e) {
				return jsonResponse({ error: e?.message || "toggle failed" }, 500);
			}
		}

		return new Response("Not Found", { status: 404 });
	},

	async scheduled(event, env, ctx) {
		ctx.waitUntil(
			(async () => {
				try {
					const data = await buildTodayMenuJson();
					await setCachedToday(env, data);
				} catch (e) {
					console.log("scheduled update failed:", e?.message || e);
				}
			})()
		);
	},
};

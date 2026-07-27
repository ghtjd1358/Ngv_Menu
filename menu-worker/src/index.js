const SOURCE_URL = "https://snuco.snu.ac.kr/foodmenu/";
const KV_KEY_TODAY = "menu:today";
const KV_KEY_FAVORITES_PREFIX = "favorites:";
const kvByDate = (date) => `menu:${date}`;

// ── Date helpers ─────────────────────────────────────────────────────────────
function todayISO_KST() {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Seoul",
		year: "numeric", month: "2-digit", day: "2-digit",
	}).format(new Date());
}

function addDaysISO(isoDate, days) {
	const [y, m, d] = isoDate.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return dt.toISOString().slice(0, 10);
}

// ── Fetch ────────────────────────────────────────────────────────────────────
const BROWSER_HEADERS = {
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
};

async function fetchSourceHtml(date = null) {
	// 날짜 지정 시 사이트의 date 검색 폼을 POST로 제출
	const res = date
		? await fetch(SOURCE_URL, {
			method: "POST",
			headers: {
				...BROWSER_HEADERS,
				"Content-Type": "application/x-www-form-urlencoded",
				"Referer": SOURCE_URL,
				"Sec-Fetch-Site": "same-origin",
			},
			body: `date=${encodeURIComponent(date)}`,
		})
		: await fetch(SOURCE_URL, { headers: BROWSER_HEADERS });

	if (!res.ok) throw new Error(`source fetch failed (HTTP ${res.status})`);
	const html = await res.text();
	if (html.includes("snucert.snu.ac.kr/waf")) {
		throw new Error("WAF blocked: SNU firewall rejected the request");
	}
	if (html.length < 1000) {
		throw new Error(`source returned suspiciously small response (${html.length} bytes)`);
	}
	return html;
}

// ── HTML helpers ─────────────────────────────────────────────────────────────
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
	return decodeHtml(stripTags(titleTdHtml))
		.replace(/\s+/g, " ")
		.trim()
		.replace(/\(\d{2,4}-\d{3,4}\)\s*$/, "")
		.trim();
}

function brToLines(tdInnerHtml) {
	return decodeHtml(tdInnerHtml)
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/\r/g, "")
		.split("\n")
		.map((l) => stripTags(l).replace(/\s+/g, " ").trim())
		.filter(Boolean);
}

function findRowHtmlByRestaurantName(pageHtml, restaurantName) {
	const rows = pageHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
	return rows.find(
		(r) => r.includes(restaurantName) && /class=["']title["']/.test(r)
	) || "";
}

function extractHoursFromLines(lines) {
	const hit = lines.find((l) => l.includes("운영시간"));
	if (!hit) return "";
	const cleaned = hit.replace(/^.*운영시간\s*[:：]?\s*/g, "").replace(/^[:\s]+/g, "").trim();
	const m = cleaned.match(/\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2}/);
	return m ? m[0].replace(/\s+/g, "") : cleaned;
}

function isNoticeLine(l) {
	return l.startsWith("※") || l.includes("혼잡시간") || l.includes("라스트") ||
		l.includes("요일별") || l.includes("수령") || l.includes("준비수량");
}

function normalizeMenuLines(lines) {
	return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function isHeaderLine(l) {
	return /^<[^>]+>/.test(l);
}

function takeSection(lines, startHeader, stopHeaders) {
	const startIdx = lines.findIndex((l) => l.includes(startHeader));
	if (startIdx < 0) return [];
	const out = [];
	for (let i = startIdx; i < lines.length; i++) {
		const l = lines[i];
		if (i > startIdx && stopHeaders.some((h) => l.includes(h))) break;
		out.push(l);
	}
	return out;
}

// ── Restaurant parsers ───────────────────────────────────────────────────────
function parseDureLunch(tdLunchHtml) {
	const lines = normalizeMenuLines(brToLines(tdLunchHtml));
	const hours = extractHoursFromLines(lines);
	const section = takeSection(lines, "<셀프코너>", ["<주문식 메뉴>"]);
	const lunch = section.filter(l => !l.includes("운영시간") && !isNoticeLine(l));
	return { hours, lunch };
}

function parse301Lunch(tdLunchHtml) {
	const lines = normalizeMenuLines(brToLines(tdLunchHtml));
	const mealSection = takeSection(lines, "<식사>", ["TAKE-OUT", "301동1층"]);
	const hours = extractHoursFromLines(mealSection);
	const lunch = [];
	for (const l of mealSection) {
		if (l.includes("운영시간")) continue;
		if (isNoticeLine(l)) continue;
		if (l.includes("교직원전용식당")) break;
		if (l.length < 2) continue;
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
	const lines = normalizeMenuLines(brToLines(lunchTd));
	return { id: restaurantId, name, hours: extractHoursFromLines(lines), lunch: lines };
}

// ── Build menu JSON ──────────────────────────────────────────────────────────
async function buildMenuJson(date = null) {
	const html = await fetchSourceHtml(date);
	const dureRow = findRowHtmlByRestaurantName(html, "두레미담");
	const r301Row = findRowHtmlByRestaurantName(html, "301동식당");

	const dure = dureRow
		? parseRestaurantRow(dureRow, "dure")
		: { id: "dure", name: "두레미담", hours: "", lunch: [] };
	const r301 = r301Row
		? parseRestaurantRow(r301Row, "301")
		: { id: "301", name: "301동식당", hours: "", lunch: [] };

	// Validate: at least one restaurant has menu data
	if (dure.lunch.length === 0 && r301.lunch.length === 0) {
		console.warn("Warning: both restaurants returned empty lunch data");
	}

	return {
		date: date || todayISO_KST(),
		sourceUrl: SOURCE_URL,
		updatedAt: new Date().toISOString(),
		restaurants: [dure, r301],
	};
}

// ── KV helpers ───────────────────────────────────────────────────────────────
async function getCachedToday(env) {
	const raw = await env.MENU_KV.get(KV_KEY_TODAY);
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

async function setCachedToday(env, obj) {
	await env.MENU_KV.put(KV_KEY_TODAY, JSON.stringify(obj), { expirationTtl: 60 * 60 * 24 });
}

async function getMenuByDate(env, date) {
	const raw = await env.MENU_KV.get(kvByDate(date));
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

async function setMenuByDate(env, obj) {
	await env.MENU_KV.put(kvByDate(obj.date), JSON.stringify(obj), { expirationTtl: 60 * 60 * 24 * 7 });
}

// ── Favorites helpers ────────────────────────────────────────────────────────
async function getUserFavorites(env, anonymousId) {
	const raw = await env.MENU_KV.get(`${KV_KEY_FAVORITES_PREFIX}${anonymousId}`);
	if (!raw) return new Set();
	try {
		const arr = JSON.parse(raw);
		return new Set(Array.isArray(arr) ? arr : []);
	} catch { return new Set(); }
}

async function setUserFavorites(env, anonymousId, favSet) {
	await env.MENU_KV.put(
		`${KV_KEY_FAVORITES_PREFIX}${anonymousId}`,
		JSON.stringify(Array.from(favSet)),
		{ expirationTtl: 60 * 60 * 24 * 365 }
	);
}

function extractAnonymousId(req) {
	return req.headers.get("X-Anonymous-Id") || null;
}

// ── Response helpers ─────────────────────────────────────────────────────────
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

// ── Worker entry ─────────────────────────────────────────────────────────────
export default {
	async fetch(req, env, ctx) {
		const url = new URL(req.url);

		if (req.method === "OPTIONS") return corsResponse();

		// GET /api/menu/today?date=YYYY-MM-DD&fresh=1
		if (url.pathname === "/api/menu/today") {
			const today = todayISO_KST();
			const dateParam = url.searchParams.get("date");
			const targetDate = dateParam || today;
			const fresh = url.searchParams.get("fresh") === "1";
			const isFuture = targetDate > today;

			// Future date: only return if we have cached data (from advance publish)
			if (isFuture) {
				const cached = await getMenuByDate(env, targetDate);
				if (cached) return jsonResponse(cached);
				return jsonResponse({
					date: targetDate,
					sourceUrl: SOURCE_URL,
					updatedAt: null,
					restaurants: [],
					note: "내일 메뉴는 아직 업데이트되지 않았습니다.",
				});
			}

			// Today or past: try cache first
			if (!fresh) {
				const byDate = await getMenuByDate(env, targetDate);
				if (byDate) return jsonResponse(byDate);
				if (targetDate === today) {
					const cached = await getCachedToday(env);
					if (cached) return jsonResponse(cached);
				}
			}

			// Fetch fresh from source
			try {
				const data = await buildMenuJson();
				ctx.waitUntil(Promise.all([
					setCachedToday(env, data),
					setMenuByDate(env, data),
				]));
				return jsonResponse(data);
			} catch (e) {
				return jsonResponse({ error: e?.message || "menu build failed", sourceUrl: SOURCE_URL }, 500);
			}
		}

		// GET /api/favorites
		if (url.pathname === "/api/favorites" && req.method === "GET") {
			const anonymousId = extractAnonymousId(req);
			if (!anonymousId) return jsonResponse({ error: "X-Anonymous-Id header required" }, 400);
			try {
				const favSet = await getUserFavorites(env, anonymousId);
				return jsonResponse({ favorites: Array.from(favSet) });
			} catch (e) {
				return jsonResponse({ error: e?.message || "favorites fetch failed" }, 500);
			}
		}

		// POST /api/favorites/toggle
		if (url.pathname === "/api/favorites/toggle" && req.method === "POST") {
			const anonymousId = extractAnonymousId(req);
			if (!anonymousId) return jsonResponse({ error: "X-Anonymous-Id header required" }, 400);
			try {
				const { menuId } = await req.json();
				if (!menuId || typeof menuId !== "string") return jsonResponse({ error: "menuId required" }, 400);
				const favSet = await getUserFavorites(env, anonymousId);
				const wasLiked = favSet.has(menuId);
				wasLiked ? favSet.delete(menuId) : favSet.add(menuId);
				await setUserFavorites(env, anonymousId, favSet);
				return jsonResponse({ menuId, liked: !wasLiked, favorites: Array.from(favSet) });
			} catch (e) {
				return jsonResponse({ error: e?.message || "toggle failed" }, 500);
			}
		}

		return new Response("Not Found", { status: 404 });
	},

	async scheduled(event, env, ctx) {
		ctx.waitUntil((async () => {
			// 오늘 메뉴
			try {
				const today = await buildMenuJson();
				await Promise.all([setCachedToday(env, today), setMenuByDate(env, today)]);
				console.log(`Today OK: ${today.date}, dure=${today.restaurants[0]?.lunch?.length}, r301=${today.restaurants[1]?.lunch?.length}`);
			} catch (e) {
				console.error("Today update failed:", e?.message || e);
			}

			// 내일 메뉴 (사이트에서 지원하면 저장)
			try {
				const tomorrowDate = addDaysISO(todayISO_KST(), 1);
				const tomorrow = await buildMenuJson(tomorrowDate);
				const hasData = tomorrow.restaurants.some(r => r.lunch?.length > 0);
				if (hasData) {
					await setMenuByDate(env, tomorrow);
					console.log(`Tomorrow OK: ${tomorrow.date}`);
				} else {
					console.log(`Tomorrow data empty, skipping cache: ${tomorrowDate}`);
				}
			} catch (e) {
				console.log(`Tomorrow fetch skipped: ${e?.message || e}`);
			}
		})());
	},
};

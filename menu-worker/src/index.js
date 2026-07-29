const SOURCE_URL = "https://snumenu.gerosyab.net/ko/menus";
const RES_CODES = "09,07";
const KV_KEY_FAVORITES_PREFIX = "favorites:";
const kvByDate = (date) => `menu:${date}`;
const KV_TTL_MENU = 60 * 60 * 24 * 30;       // 30일 (월간 달력 지원)
const KV_TTL_FAVORITES = 60 * 60 * 24 * 365;

// ── 입력 검증 ────────────────────────────────────────────────────────────────
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const ANON_ID_RE = /^[0-9a-f\-]{8,36}$/i;
const MENU_ID_MAX_LEN = 64;

function isValidDate(str) {
	if (!str || !DATE_ISO_RE.test(str)) return false;
	const d = new Date(str + "T00:00:00Z");
	return !isNaN(d.getTime());
}

function isWithinDateRange(targetDate, today, maxDays = 365) {
	const diff = Math.abs(
		(new Date(targetDate + "T00:00:00Z") - new Date(today + "T00:00:00Z")) / 86400000
	);
	return diff <= maxDays;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function todayISO_KST() {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Seoul",
		year: "numeric", month: "2-digit", day: "2-digit",
	}).format(new Date());
}

// ── Menu fetch via HTMLRewriter ───────────────────────────────────────────────
async function buildMenuJson(date = null) {
	const targetDate = date || todayISO_KST();
	const url = `${SOURCE_URL}?date=${targetDate}&resCode=${RES_CODES}`;

	const fetchRes = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "ko-KR,ko;q=0.9",
		}
	});

	if (!fetchRes.ok) throw new Error(`snumenu fetch failed: ${fetchRes.status}`);

	const data = {
		"09": { id: "301", name: "301동식당", hours: "", lunch: [] },
		"07": { id: "dure", name: "두레미담", hours: "", lunch: [] },
	};

	let currentRes = null;
	let currentMealType = "";
	let mealTypeBuffer = "";

	const transformed = new HTMLRewriter()
		.on('.restaurant', {
			element(el) {
				const code = el.getAttribute('data-resCode');
				if (code && data[code]) {
					currentRes = code;
					currentMealType = "";
					mealTypeBuffer = "";
				}
			}
		})
		.on('.meal-type', {
			element() { mealTypeBuffer = ""; },
			text(chunk) { mealTypeBuffer += chunk.text; },
		})
		.on('.menu a.modal-link', {
			element(el) {
				const mt = mealTypeBuffer.trim();
				if (mt) currentMealType = mt;
				if (currentMealType !== "점심" || !currentRes) return;
				const menu = el.getAttribute('data-menu');
				if (menu && data[currentRes]) data[currentRes].lunch.push(menu.trim());
			}
		})
		.transform(fetchRes);

	await transformed.text();

	const restaurants = Object.values(data);
	const hasData = restaurants.some(r => r.lunch.length > 0);

	if (!hasData) console.warn(`No lunch data for ${targetDate} from snumenu`);

	return {
		date: targetDate,
		sourceUrl: url,
		updatedAt: new Date().toISOString(),
		hasData,
		restaurants,
	};
}

// ── KV helpers ───────────────────────────────────────────────────────────────
async function getMenuByDate(env, date) {
	const raw = await env.MENU_KV.get(kvByDate(date));
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

async function setMenuByDate(env, obj) {
	await env.MENU_KV.put(kvByDate(obj.date), JSON.stringify(obj), { expirationTtl: KV_TTL_MENU });
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
		{ expirationTtl: KV_TTL_FAVORITES }
	);
}

function extractAnonymousId(req) {
	const id = req.headers.get("X-Anonymous-Id");
	if (!id || !ANON_ID_RE.test(id)) return null;
	return id;
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

		// GET /api/menu/month?year=YYYY&month=MM
		if (url.pathname === "/api/menu/month") {
			const year = url.searchParams.get("year");
			const month = url.searchParams.get("month")?.padStart(2, "0");
			if (!year || !month || !/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
				return jsonResponse({ error: "year (YYYY) and month (1-12) required" }, 400);
			}
			try {
				const prefix = `menu:${year}-${month}-`;
				const list = await env.MENU_KV.list({ prefix });
				const results = {};
				await Promise.all(list.keys.map(async key => {
					const raw = await env.MENU_KV.get(key.name);
					if (!raw) return;
					try {
						const data = JSON.parse(raw);
						if (data?.date) results[data.date] = data;
					} catch {}
				}));
				return jsonResponse(results);
			} catch (e) {
				return jsonResponse({ error: e?.message || "month fetch failed" }, 500);
			}
		}

		// GET /api/menu/dates
		if (url.pathname === "/api/menu/dates") {
			try {
				const list = await env.MENU_KV.list({ prefix: "menu:" });
				const dates = list.keys
					.map(k => k.name.replace("menu:", ""))
					.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
					.sort();
				return jsonResponse({ dates, truncated: !list.list_complete });
			} catch (e) {
				return jsonResponse({ error: e?.message || "list failed" }, 500);
			}
		}

		// GET /api/menu/today?date=YYYY-MM-DD&fresh=1
		if (url.pathname === "/api/menu/today") {
			const today = todayISO_KST();
			const dateParam = url.searchParams.get("date");

			// 날짜 형식 및 범위 검증
			if (dateParam) {
				if (!isValidDate(dateParam)) {
					return jsonResponse({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
				}
				if (!isWithinDateRange(dateParam, today)) {
					return jsonResponse({ error: "Date out of range (±365 days)" }, 400);
				}
			}

			const targetDate = dateParam || today;
			const fresh = url.searchParams.get("fresh") === "1";
			const isFuture = targetDate > today;

			// 미래 날짜: 캐시 확인 후 live fetch
			if (isFuture) {
				const cached = await getMenuByDate(env, targetDate);
				if (cached?.updatedAt) {
					const kstDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" })
						.format(new Date(cached.updatedAt));
					if (kstDate === targetDate) return jsonResponse(cached);
				}
				try {
					const data = await buildMenuJson(targetDate);
					if (data.hasData) ctx.waitUntil(setMenuByDate(env, data));
					return jsonResponse(data);
				} catch (e) {
					console.warn("Future date fetch failed:", e?.message);
				}
				return jsonResponse({
					date: targetDate, sourceUrl: SOURCE_URL, updatedAt: null,
					hasData: false, restaurants: [], note: "해당 날짜의 메뉴가 아직 없습니다.",
				});
			}

			// 과거 날짜: KV에 없으면 데이터 없음
			if (targetDate < today) {
				const byDate = await getMenuByDate(env, targetDate);
				if (byDate) return jsonResponse(byDate);
				return jsonResponse({
					date: targetDate, sourceUrl: SOURCE_URL, updatedAt: null,
					hasData: false, restaurants: [], note: "해당 날짜의 메뉴 데이터가 없습니다.",
				});
			}

			// 오늘: 캐시 우선
			if (!fresh) {
				const byDate = await getMenuByDate(env, today);
				if (byDate) return jsonResponse(byDate);
			}

			try {
				const data = await buildMenuJson();
				// 데이터가 있을 때만 캐시 저장 (빈 결과가 7일 고착되는 문제 방지)
				if (data.hasData) ctx.waitUntil(setMenuByDate(env, data));
				return jsonResponse(data);
			} catch (e) {
				return jsonResponse({ error: e?.message || "menu build failed", sourceUrl: SOURCE_URL }, 500);
			}
		}

		// GET /api/favorites
		if (url.pathname === "/api/favorites" && req.method === "GET") {
			const anonymousId = extractAnonymousId(req);
			if (!anonymousId) return jsonResponse({ error: "Invalid or missing X-Anonymous-Id header" }, 400);
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
			if (!anonymousId) return jsonResponse({ error: "Invalid or missing X-Anonymous-Id header" }, 400);
			try {
				const body = await req.json();
				const { menuId } = body;
				if (!menuId || typeof menuId !== "string" || menuId.length > MENU_ID_MAX_LEN) {
					return jsonResponse({ error: `menuId required (max ${MENU_ID_MAX_LEN} chars)` }, 400);
				}
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
			try {
				const data = await buildMenuJson();
				// 데이터가 있을 때만 저장 (빈 메뉴로 캐시 오염 방지)
				if (data.hasData) {
					await setMenuByDate(env, data);
				}
				const r301 = data.restaurants.find(r => r.id === "301");
				const rdure = data.restaurants.find(r => r.id === "dure");
				console.log(`Cron OK: ${data.date}, 301=${r301?.lunch?.length}, dure=${rdure?.lunch?.length}, saved=${data.hasData}`);

				// 슬랙 알림 (SLACK_WEBHOOK_URL 환경변수 설정 시 활성화)
				if (env.SLACK_WEBHOOK_URL && data.hasData) {
					const text = data.restaurants
						.map(r => `*${r.name}*\n${r.lunch.slice(0, 5).join(" / ")}`)
						.join("\n\n");
					await fetch(env.SLACK_WEBHOOK_URL, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ text: `오늘(${data.date}) 식단\n\n${text}` }),
					}).catch(e => console.warn("Slack webhook failed:", e?.message));
				}
			} catch (e) {
				console.error("Cron failed:", e?.message || e);
			}
		})());
	},
};

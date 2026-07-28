const SOURCE_URL = "https://snumenu.gerosyab.net/ko/menus";
const RES_CODES = "09,07";
const KV_KEY_TODAY = "menu:today";
const KV_KEY_FAVORITES_PREFIX = "favorites:";
const kvByDate = (date) => `menu:${date}`;

const RES_MAP = {
	"09": { id: "301", name: "301동식당" },
	"07": { id: "dure", name: "두레미담" },
};

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
				}
			}
		})
		.on('.meal-type', {
			element() { mealTypeBuffer = ""; },
			text(chunk) { mealTypeBuffer += chunk.text; },
		})
		.on('.meal', {
			element() {
				// meal-type text는 .meal 시작 후 .meal-type에서 수집됨
				// .meal element가 닫힐 때 currentMealType을 확정
			}
		})
		.on('.menu a.modal-link', {
			element(el) {
				// .meal-type 텍스트가 쌓인 것을 여기서 확인
				const mt = mealTypeBuffer.trim();
				if (mt) currentMealType = mt;

				if (currentMealType !== "점심" || !currentRes) return;
				const menu = el.getAttribute('data-menu');
				if (menu && data[currentRes]) {
					data[currentRes].lunch.push(menu.trim());
				}
			}
		})
		.on('.meal-time, .operating-time, .time', {
			text(chunk) {
				if (!currentRes) return;
				const t = chunk.text.trim();
				const m = t.match(/\d{1,2}:\d{2}\s*[~\-]\s*\d{1,2}:\d{2}/);
				if (m && currentMealType === "점심") {
					data[currentRes].hours = m[0].replace(/\s/g, "");
				}
			}
		})
		.transform(fetchRes);

	await transformed.text();

	const restaurants = Object.values(data);

	if (restaurants.every(r => r.lunch.length === 0)) {
		console.warn(`No lunch data for ${targetDate} from snumenu`);
	}

	return {
		date: targetDate,
		sourceUrl: url,
		updatedAt: new Date().toISOString(),
		restaurants,
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

		// GET /api/menu/month?year=YYYY&month=MM
		if (url.pathname === "/api/menu/month") {
			const year = url.searchParams.get("year");
			const month = url.searchParams.get("month")?.padStart(2, "0");
			if (!year || !month) return jsonResponse({ error: "year and month required" }, 400);
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
				return jsonResponse({ dates });
			} catch (e) {
				return jsonResponse({ error: e?.message || "list failed" }, 500);
			}
		}

		// GET /api/menu/today?date=YYYY-MM-DD&fresh=1
		if (url.pathname === "/api/menu/today") {
			const today = todayISO_KST();
			const dateParam = url.searchParams.get("date");
			const targetDate = dateParam || today;
			const fresh = url.searchParams.get("fresh") === "1";
			const isFuture = targetDate > today;

			// 미래 날짜: updatedAt이 실제로 해당 날짜(KST)에 저장된 데이터만 반환
			if (isFuture) {
				const cached = await getMenuByDate(env, targetDate);
				if (cached?.updatedAt) {
					const kstDate = new Date(new Date(cached.updatedAt).getTime() + 9 * 60 * 60 * 1000)
						.toISOString().slice(0, 10);
					if (kstDate === targetDate) return jsonResponse(cached);
				}
				// snumenu는 미래 날짜도 지원 — 직접 fetch 시도
				try {
					const data = await buildMenuJson(targetDate);
					if (data.restaurants.some(r => r.lunch.length > 0)) {
						ctx.waitUntil(setMenuByDate(env, data));
						return jsonResponse(data);
					}
				} catch (e) {
					console.warn("Future date fetch failed:", e?.message);
				}
				return jsonResponse({
					date: targetDate, sourceUrl: SOURCE_URL, updatedAt: null,
					restaurants: [], note: "해당 날짜의 메뉴가 아직 없습니다.",
				});
			}

			// 과거 날짜: KV에 없으면 데이터 없음
			if (targetDate < today) {
				const byDate = await getMenuByDate(env, targetDate);
				if (byDate) return jsonResponse(byDate);
				return jsonResponse({
					date: targetDate, sourceUrl: SOURCE_URL, updatedAt: null,
					restaurants: [], note: "해당 날짜의 메뉴 데이터가 없습니다.",
				});
			}

			// 오늘: 날짜가 일치하는 캐시만 사용
			if (!fresh) {
				const byDate = await getMenuByDate(env, today);
				if (byDate) return jsonResponse(byDate);
				const cached = await getCachedToday(env);
				if (cached && cached.date === today) return jsonResponse(cached);
			}

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
			try {
				const data = await buildMenuJson();
				await Promise.all([setCachedToday(env, data), setMenuByDate(env, data)]);
				console.log(`Cron OK: ${data.date}, 301=${data.restaurants[0]?.lunch?.length}, dure=${data.restaurants[1]?.lunch?.length}`);
			} catch (e) {
				console.error("Cron failed:", e?.message || e);
			}
		})());
	},
};

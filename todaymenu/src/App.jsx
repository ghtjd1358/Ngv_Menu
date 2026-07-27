import { useEffect, useMemo, useState, useCallback } from "react";
// ✅ mock 제거 (필요하면 fallback용으로만 남겨도 됨)
// import { mockToday } from "./mock/menu";
import { formatDateKR } from "./utils/date";
import { getOrCreateAnonymousId } from "./utils/anonymousId";

function TopBar() {
    return (
        <div className="sticky top-0 z-20 bg-slate-900 text-white shadow-sm">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
                <div className="flex items-center gap-3">
                    <button className="h-8 w-8 rounded-md">
                        <img src="/icons/rice.png" className="h-8 w-8" />
                    </button>
                    <div className="text-m font-semibold">엔지미식회</div>
                </div>
                <div className="text-xs text-white/70">사내 식단표</div>
            </div>
        </div>
    );
}

function DateHeader({ label }) {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
            <div className="flex items-center justify-center gap-4">
                <div className="text-lg font-bold text-slate-900">{label}</div>
            </div>
        </div>
    );
}

function LikeButton({ isLiked, count, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-black/5 hover:bg-white"
            aria-pressed={isLiked}
            aria-label="찜"
        >
            <span
                aria-hidden
                className={[
                    "inline-flex h-4 w-4 items-center justify-center rounded-full",
                    isLiked ? "bg-red-500 text-white" : "bg-slate-200 text-slate-600",
                ].join(" ")}
            >
                ♥
            </span>
            <span>{count}</span>
        </button>
    );
}

function MenuBlock({ textLines, variant = "warm", likeKey, likes, setLikes, onToggleFavorite }) {
    const gradient =
        variant === "warm"
            ? "from-rose-400 to-orange-400"
            : variant === "cool"
                ? "from-sky-400 to-indigo-400"
                : "from-amber-400 to-yellow-400";

    const state = likes[likeKey] ?? { liked: false, count: 0 };

    const onToggle = () => {
        // 낙관적 업데이트
        setLikes((prev) => {
            const cur = prev[likeKey] ?? { liked: false, count: 0 };
            const nextLiked = !cur.liked;
            const nextCount = Math.max(0, cur.count + (nextLiked ? 1 : -1));
            return { ...prev, [likeKey]: { liked: nextLiked, count: nextCount } };
        });

        // 서버 동기화
        if (onToggleFavorite) {
            onToggleFavorite(likeKey, !state.liked);
        }
    };

    return (
        <div
            className={[
                "relative h-full rounded-2xl bg-gradient-to-br p-6 text-center text-white",
                gradient,
            ].join(" ")}
        >
            <div className="mx-auto max-w-[18rem] whitespace-pre-line text-sm font-semibold leading-relaxed">
                {textLines}
            </div>
            <LikeButton isLiked={state.liked} count={state.count} onToggle={onToggle} />
        </div>
    );
}

function RestaurantCard({ restaurant, likes, setLikes, onToggleFavorite }) {
    const { id, name, hours, lunch } = restaurant;
    const safeLunch = Array.isArray(lunch) ? lunch : [];

    const blocks = useMemo(() => {
        // ✅ 두레미담: 항상 노란색 + 한 블록
        if (id === "dure") {
            return [
                {
                    key: 0,
                    text: safeLunch.join("\n"),
                    variant: "yellow",
                },
            ];
        }

        // ✅ 301동식당: warm / cool 2블록
        if (safeLunch.length === 0) {
            return [
                { key: 0, text: "메뉴 정보 없음", variant: "warm" },
                { key: 1, text: "", variant: "cool" },
            ];
        }

        if (safeLunch.length <= 2) {
            return [
                { key: 0, text: safeLunch[0] ?? "", variant: "warm" },
                { key: 1, text: safeLunch[1] ?? "", variant: "cool" },
            ];
        }

        // 길면 반으로 나눔
        const mid = Math.ceil(safeLunch.length / 2);
        return [
            {
                key: 0,
                text: safeLunch.slice(0, mid).join("\n"),
                variant: "warm",
            },
            {
                key: 1,
                text: safeLunch.slice(mid).join("\n"),
                variant: "cool",
            },
        ];
    }, [id, safeLunch]);

    return (
        <div className="flex h-full flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div>
                <div className="text-lg font-extrabold text-slate-900">{name}</div>
                <div className="mt-1 text-xs text-slate-600">
                    운영시간 {hours || "00:00 ~ 00:00"}
                </div>
            </div>

            {/* ✅ 두레미담은 1행, 301동은 2행 */}
            <div
                className={[
                    "mt-4 flex-1 grid gap-4",
                    id === "dure" ? "grid-rows-1" : "grid-rows-2",
                ].join(" ")}
            >
                {blocks.map((b) => (
                    <MenuBlock
                        key={b.key}
                        textLines={b.text}
                        variant={b.variant}
                        likeKey={`${id}:${b.key}`}
                        likes={likes}
                        setLikes={setLikes}
                        onToggleFavorite={onToggleFavorite}
                    />
                ))}
            </div>
        </div>
    );
}


function BottomButtons({ onOpenPoke, onOpenQuiznos }) {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 pb-6 md:px-6">
            <div className="mt-5 grid gap-3 md:grid-cols-2">
                <button
                    type="button"
                    onClick={onOpenPoke}
                    className="rounded-full bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                    포케 올데이 메뉴 바로가기
                </button>
                <button
                    type="button"
                    onClick={onOpenQuiznos}
                    className="rounded-full bg-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                    퀴즈노스 메뉴 보기
                </button>
            </div>
        </div>
    );
}

function QuiznosModal({ open, onClose, items = [], updatedAt }) {
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const fallbackThumb = (name) => (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 text-xs font-extrabold text-slate-600 ring-1 ring-black/5">
            {name?.slice(0, 2) || "QS"}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="닫기"
                onClick={onClose}
            />

            <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
                <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-lg font-extrabold text-slate-900">퀴즈노스 회사 지원 메뉴</div>
                            <p className="mt-1 text-sm text-slate-600">
                                지원 대상 메뉴만 표시됩니다{updatedAt ? ` (업데이트: ${updatedAt})` : ""}.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full px-3 py-2 text-slate-500 hover:bg-slate-100"
                            aria-label="닫기"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="mt-4 max-h-[62vh] overflow-auto px-1 pb-1">
                        {items.length === 0 ? (
                            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                                등록된 지원 메뉴가 없습니다.
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {items.map((it) => (
                                    <li key={it.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                                        <div className="flex items-start gap-4">
                                            <div className="shrink-0">
                                                {it.image ? (
                                                    <img
                                                        src={it.image}
                                                        alt={it.name}
                                                        className="h-14 w-14 rounded-2xl object-cover ring-1 ring-black/5"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = "none";
                                                        }}
                                                    />
                                                ) : (
                                                    fallbackThumb(it.name)
                                                )}
                                                {it.image ? <div className="mt-0 hidden" /> : null}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="text-sm font-extrabold text-slate-900">{it.name}</div>
                                                    {typeof it.calorie === "number" ? (
                                                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                                                            🔥 {it.calorie} kcal
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {it.desc ? (
                                                    <div className="mt-1 text-xs leading-relaxed text-slate-600">{it.desc}</div>
                                                ) : null}

                                                {Array.isArray(it.tags) && it.tags.length ? (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {it.tags.map((t) => (
                                                            <span
                                                                key={t}
                                                                className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200"
                                                            >
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    // ✅ mockToday 대신 API 데이터를 담을 state
    const [data, setData] = useState(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState("");

    const [likes, setLikes] = useState({});
    const [anonymousId, setAnonymousId] = useState(null);
    const [favoritesLoaded, setFavoritesLoaded] = useState(false);

    // ✅ 퀴즈노스 모달/데이터
    const [quiznosOpen, setQuiznosOpen] = useState(false);
    const [quiznosItems, setQuiznosItems] = useState([]);
    const [quiznosUpdatedAt, setQuiznosUpdatedAt] = useState("");
    const [quiznosLoadError, setQuiznosLoadError] = useState("");

    const API_BASE =
        import.meta.env.VITE_API_BASE ||
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
            ? "http://localhost:8787"
            : "https://menu-worker.ngvmenu.workers.dev");

    // ✅ 익명 사용자 ID 초기화
    useEffect(() => {
        const id = getOrCreateAnonymousId();
        setAnonymousId(id);
    }, []);

    // ✅ 오늘 메뉴 로드
    useEffect(() => {
        let alive = true;

        async function loadToday() {
            try {
                setDataLoading(true);
                setDataError("");

                // 캐시 무시가 필요하면 ?fresh=1 붙여서 확인 가능
                const res = await fetch(`${API_BASE}/api/menu/today`, { cache: "no-store" });
                if (!res.ok) throw new Error(`오늘 메뉴 로드 실패 (HTTP ${res.status})`);

                const json = await res.json();
                if (!alive) return;

                setData(json);
            } catch (e) {
                if (!alive) return;
                setData(null);
                setDataError(e?.message || "오늘 메뉴를 불러오지 못했습니다.");
            } finally {
                if (!alive) return;
                setDataLoading(false);
            }
        }

        loadToday();
        return () => {
            alive = false;
        };
    }, []);

    // ✅ 찜 목록 로드 (anonymousId가 준비되면)
    useEffect(() => {
        if (!anonymousId) return;

        let alive = true;

        async function loadFavorites() {
            try {
                const res = await fetch(`${API_BASE}/api/favorites`, {
                    headers: {
                        "X-Anonymous-Id": anonymousId,
                    },
                });

                if (!res.ok) {
                    console.warn("찜 목록 로드 실패:", res.status);
                    return;
                }

                const json = await res.json();
                if (!alive) return;

                const favorites = Array.isArray(json.favorites) ? json.favorites : [];

                // 서버에서 받은 찜 목록을 likes state에 반영
                setLikes((prev) => {
                    const updated = { ...prev };
                    favorites.forEach((menuId) => {
                        if (!updated[menuId]) {
                            updated[menuId] = { liked: true, count: 0 };
                        } else {
                            updated[menuId] = { ...updated[menuId], liked: true };
                        }
                    });
                    return updated;
                });

                setFavoritesLoaded(true);
            } catch (e) {
                console.warn("찜 목록 로드 에러:", e);
            }
        }

        loadFavorites();
        return () => {
            alive = false;
        };
    }, [anonymousId, API_BASE]);

    // ✅ 정적 JSON 로드 (public/quiznos.json)
    useEffect(() => {
        fetch("/quiznos.json", { cache: "no-store" })
            .then((r) => {
                if (!r.ok) throw new Error(`quiznos.json 로드 실패 (HTTP ${r.status})`);
                return r.json();
            })
            .then((json) => {
                const items = Array.isArray(json.items) ? json.items : [];
                setQuiznosItems(items);
                setQuiznosUpdatedAt(typeof json.updatedAt === "string" ? json.updatedAt : "");
                setQuiznosLoadError("");
            })
            .catch((err) => {
                setQuiznosItems([]);
                setQuiznosUpdatedAt("");
                setQuiznosLoadError(err?.message || "quiznos.json 로드 실패");
            });
    }, []);

    // ✅ 찜하기 토글 (낙관적 업데이트 + 서버 동기화)
    const handleToggleFavorite = useCallback(async (menuId, expectedLiked) => {
        if (!anonymousId) {
            console.warn("anonymousId가 없어 찜하기를 처리할 수 없습니다.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Anonymous-Id": anonymousId,
                },
                body: JSON.stringify({ menuId }),
            });

            if (!res.ok) {
                throw new Error(`찜하기 토글 실패 (HTTP ${res.status})`);
            }

            const json = await res.json();

            // 서버 응답과 로컬 상태가 다르면 동기화 (롤백)
            if (json.liked !== expectedLiked) {
                console.warn("서버 응답과 로컬 상태 불일치, 롤백합니다.");
                setLikes((prev) => {
                    const cur = prev[menuId] ?? { liked: false, count: 0 };
                    return {
                        ...prev,
                        [menuId]: {
                            ...cur,
                            liked: json.liked,
                        },
                    };
                });
            }
        } catch (e) {
            console.error("찜하기 토글 에러:", e);

            // 실패 시 롤백
            setLikes((prev) => {
                const cur = prev[menuId] ?? { liked: false, count: 0 };
                const rolledBack = !expectedLiked;
                const rolledBackCount = Math.max(0, cur.count + (rolledBack ? 1 : -1));
                return {
                    ...prev,
                    [menuId]: {
                        liked: rolledBack,
                        count: rolledBackCount,
                    },
                };
            });
        }
    }, [anonymousId, API_BASE]);

    // ✅ 포케 올데이: 네이버 링크 새 탭
    const handleOpenPoke = () => {
        window.open("https://m.booking.naver.com/order/bizes/1397805/items/6691932?theme=place&service-target=map-pc&refererCode=menutab&lang=ko&area=ple", "_blank", "noopener,noreferrer");
    };

    // ✅ 퀴즈노스: 모달 오픈
    const handleOpenQuiznos = () => setQuiznosOpen(true);

    const dateLabel = useMemo(() => {
        if (!data?.date) return "";
        const [mmdd, day] = formatDateKR(data.date).split(" ");
        const [m, d] = mmdd.split(".");
        return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일 ${day}`;
    }, [data?.date]);

    const r301 = data?.restaurants?.find((r) => r.id === "301");
    const dure = data?.restaurants?.find((r) => r.id === "dure");

    return (
        <div className="min-h-dvh bg-slate-50 text-slate-900">
            <TopBar />
            <DateHeader label={dataLoading ? "불러오는 중…" : dateLabel || "오늘"} />

            <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
                {/* ✅ 로딩/에러 */}
                {dataLoading ? (
                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                        오늘 메뉴 불러오는 중…
                    </div>
                ) : dataError ? (
                    <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
                        오늘 메뉴 데이터를 불러오지 못했습니다: {dataError}
                        <div className="mt-2">
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                            >
                                새로고침
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid items-stretch gap-4 md:grid-cols-2">
                        {r301 ? <RestaurantCard restaurant={r301} likes={likes} setLikes={setLikes} onToggleFavorite={handleToggleFavorite} /> : null}
                        {dure ? <RestaurantCard restaurant={dure} likes={likes} setLikes={setLikes} onToggleFavorite={handleToggleFavorite} /> : null}
                    </div>
                )}

                {/* ✅ quiznos.json 로드 실패해도 메인 화면이 죽지 않게, 안내만 표시 */}
                {quiznosLoadError ? (
                    <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs text-amber-800 ring-1 ring-amber-200">
                        퀴즈노스 메뉴 데이터를 불러오지 못했습니다: {quiznosLoadError}
                        <div className="mt-1 text-amber-700">public/quiznos.json 존재 여부와 JSON 형식을 확인해주세요.</div>
                    </div>
                ) : null}
            </div>

            <BottomButtons onOpenPoke={handleOpenPoke} onOpenQuiznos={handleOpenQuiznos} />
            <QuiznosModal
                open={quiznosOpen}
                onClose={() => setQuiznosOpen(false)}
                items={quiznosItems}
                updatedAt={quiznosUpdatedAt}
            />
        </div>
    );
}

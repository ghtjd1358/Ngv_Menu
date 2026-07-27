import { useEffect, useMemo, useState } from "react";
import { mockToday } from "./mock/menu";
import { formatDateKR } from "./utils/date";

function TopBar() {
  return (
    <div className="sticky top-0 z-20 bg-slate-900 text-white shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button className="rounded-lg px-2 py-2 hover:bg-white/10" type="button" aria-label="메뉴">
            <div className="space-y-1">
              <div className="h-0.5 w-5 bg-white/90" />
              <div className="h-0.5 w-5 bg-white/90" />
              <div className="h-0.5 w-5 bg-white/90" />
            </div>
          </button>
          <div className="text-sm font-semibold">엔지미식회</div>
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
        <button
          type="button"
          className="rounded-full px-3 py-2 text-slate-400 hover:bg-slate-100"
          aria-label="이전 날짜"
        >
          ◀
        </button>
        <div className="text-lg font-bold text-slate-900">{label}</div>
        <button
          type="button"
          className="rounded-full px-3 py-2 text-slate-400 hover:bg-slate-100"
          aria-label="다음 날짜"
        >
          ▶
        </button>
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

function MenuBlock({ textLines, variant = "warm", likeKey, likes, setLikes }) {
  const gradient =
    variant === "warm"
      ? "from-rose-400 to-orange-400"
      : variant === "cool"
        ? "from-sky-400 to-indigo-400"
        : "from-amber-400 to-yellow-400";

  const state = likes[likeKey] ?? { liked: false, count: 59 };

  const onToggle = () => {
    setLikes((prev) => {
      const cur = prev[likeKey] ?? { liked: false, count: 59 };
      const nextLiked = !cur.liked;
      const nextCount = Math.max(0, cur.count + (nextLiked ? 1 : -1));
      return { ...prev, [likeKey]: { liked: nextLiked, count: nextCount } };
    });
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

function RestaurantCard({ restaurant, likes, setLikes }) {
  const { id, name, hours, lunch } = restaurant;
  const isMany = lunch.length > 2;

  const blocks = useMemo(() => {
    if (!isMany) {
      return [
        { key: 0, text: lunch[0] ?? "", variant: "warm" },
        { key: 1, text: lunch[1] ?? "", variant: "cool" },
      ];
    }
    const allLines = lunch.join("\n");
    return [{ key: 0, text: allLines, variant: "yellow" }];
  }, [isMany, lunch]);

  return (
    // ✅ h-full + flex-col : 카드 자체 높이를 그리드에서 맞춤
    <div className="flex h-full flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <div className="text-lg font-extrabold text-slate-900">{name}</div>
        <div className="mt-1 text-xs text-slate-600">운영시간 {hours || "00:00 ~ 00:00"}</div>
      </div>

      {/* ✅ flex-1: 남는 높이를 블록 영역이 차지 */}
      {/* ✅ 301동(2개)은 2행 그리드로 각 블록이 동일 높이를 채움 */}
      <div
        className={[
          "mt-4 flex-1",
          isMany ? "grid" : "grid",
          isMany ? "grid-rows-1" : "grid-rows-2",
          "grid gap-4",
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
          퀴즈노스 메뉴 바로가기
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
      {/* dim */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />

      {/* dialog */}
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
                      {/* Thumbnail */}
                      <div className="shrink-0">
                        {it.image ? (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="h-14 w-14 rounded-2xl object-cover ring-1 ring-black/5"
                            loading="lazy"
                            onError={(e) => {
                              // 이미지 경로가 아직 없거나 실패해도 UI가 깨지지 않게 처리
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          fallbackThumb(it.name)
                        )}
                        {/* 이미지 로드 실패로 img가 숨겨진 경우를 대비해서 항상 fallback도 렌더 */}
                        {it.image ? (
                          <div className="mt-0 hidden" />
                        ) : null}
                      </div>

                      {/* Content */}
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
  const [data] = useState(mockToday);
  const [likes, setLikes] = useState({});

  // ✅ 퀴즈노스 모달/데이터
  const [quiznosOpen, setQuiznosOpen] = useState(false);
  const [quiznosItems, setQuiznosItems] = useState([]);
  const [quiznosUpdatedAt, setQuiznosUpdatedAt] = useState("");
  const [quiznosLoadError, setQuiznosLoadError] = useState("");

  useEffect(() => {
    // ✅ 정적 JSON 로드 (public/quiznos.json)
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

  // ✅ 포케 올데이: 네이버 링크 새 탭
  const handleOpenPoke = () => {
    window.open("https://naver.me/x1Vo9wUs", "_blank", "noopener,noreferrer");
  };

  // ✅ 퀴즈노스: 모달 오픈
  const handleOpenQuiznos = () => setQuiznosOpen(true);

  const dateLabel = useMemo(() => {
    const [mmdd, day] = formatDateKR(data.date).split(" ");
    const [m, d] = mmdd.split(".");
    return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일 ${day}`;
  }, [data.date]);

  const r301 = data.restaurants.find((r) => r.id === "301");
  const dure = data.restaurants.find((r) => r.id === "dure");

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <TopBar />
      <DateHeader label={dateLabel} />

      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="grid items-stretch gap-4 md:grid-cols-2">
          {r301 ? <RestaurantCard restaurant={r301} likes={likes} setLikes={setLikes} /> : null}
          {dure ? <RestaurantCard restaurant={dure} likes={likes} setLikes={setLikes} /> : null}
        </div>

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

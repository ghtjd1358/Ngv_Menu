# 🍽️ NGV 메뉴 - 찜하기 기능

## 📌 개요

엔지미식회 사내 식단표 앱에 **로그인 없이 사용자별로 분리된 찜하기 기능**을 추가했습니다.

### ✨ 주요 특징

- 🔐 **로그인 불필요** - 익명 사용자 식별자(UUID) 사용
- 👤 **사용자별 분리** - 각 사용자의 찜 목록 완전 독립
- ☁️ **서버 저장** - Cloudflare Workers KV에 영구 저장
- ⚡ **빠른 반응** - 낙관적 업데이트로 즉각적인 UI 반응
- 🔄 **자동 롤백** - 네트워크 오류 시 이전 상태로 복원
- 🌐 **CORS 지원** - Pages와 Workers 간 안전한 통신

---

## 🚀 빠른 시작

### 1. 로컬 테스트

```bash
# 터미널 1: Workers 실행
cd menu-worker
npm run dev

# 터미널 2: React 앱 실행
cd todaymenu
npm run dev

# 브라우저에서 http://localhost:5173 접속
```

### 2. 찜하기 테스트

1. 메뉴 카드의 ♥ 버튼 클릭
2. 하트 색상이 빨간색으로 변경됨
3. 페이지 새로고침 → 찜 상태 유지 확인

### 3. API 직접 테스트

```bash
# 찜 목록 조회
curl -H "X-Anonymous-Id: test-user-123" \
  http://localhost:8787/api/favorites

# 찜 추가/제거
curl -X POST \
  -H "X-Anonymous-Id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{"menuId":"301:0"}' \
  http://localhost:8787/api/favorites/toggle
```

---

## 📚 문서

| 문서 | 설명 |
|------|------|
| **[QUICKSTART.md](./QUICKSTART.md)** | 5분 안에 시작하는 빠른 가이드 |
| **[FAVORITES_GUIDE.md](./FAVORITES_GUIDE.md)** | 상세한 구현 가이드 및 API 명세 |
| **[CHANGES_SUMMARY.md](./CHANGES_SUMMARY.md)** | 전체 변경사항 요약 |

---

## 🏗️ 아키텍처

```
┌─────────────────┐
│  React App      │
│  (localhost:    │
│   5173)         │
└────────┬────────┘
         │ HTTP + X-Anonymous-Id
         ↓
┌─────────────────┐
│  Workers API    │
│  (localhost:    │
│   8787)         │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Cloudflare KV  │
│  (영구 저장)     │
└─────────────────┘
```

### 데이터 흐름

1. **사용자 접속** → anonymousId 생성 (localStorage)
2. **초기 로딩** → GET `/api/favorites` (서버에서 찜 목록 가져오기)
3. **찜하기 클릭** → 낙관적 업데이트 + POST `/api/favorites/toggle`
4. **성공** → 상태 유지
5. **실패** → 이전 상태로 롤백

---

## 🔧 기술 스택

### Frontend
- **React 19** - UI 프레임워크
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링

### Backend
- **Cloudflare Workers** - 서버리스 API
- **Cloudflare KV** - 키-값 저장소
- **Wrangler** - Workers 배포 도구

---

## 📂 프로젝트 구조

```
NGVmenu update/
├── menu-worker/              # Cloudflare Workers
│   ├── src/
│   │   └── index.js         # ✏️ 찜하기 API 추가
│   ├── package.json
│   └── wrangler.jsonc
│
├── todaymenu/               # React 앱
│   ├── src/
│   │   ├── App.jsx          # ✏️ 찜하기 API 연동
│   │   └── utils/
│   │       └── anonymousId.js  # ✨ 신규: 익명 ID 관리
│   ├── package.json
│   └── vite.config.js
│
├── QUICKSTART.md            # ✨ 신규: 빠른 시작 가이드
├── FAVORITES_GUIDE.md       # ✨ 신규: 상세 가이드
├── CHANGES_SUMMARY.md       # ✨ 신규: 변경사항 요약
└── README_FAVORITES.md      # ✨ 신규: 이 파일
```

---

## 🔑 API 명세

### GET /api/favorites

사용자의 찜 목록 조회

**요청:**
```http
GET /api/favorites
X-Anonymous-Id: {uuid}
```

**응답:**
```json
{
  "favorites": ["301:0", "301:1", "dure:0"]
}
```

### POST /api/favorites/toggle

찜 상태 토글

**요청:**
```http
POST /api/favorites/toggle
X-Anonymous-Id: {uuid}
Content-Type: application/json

{
  "menuId": "301:0"
}
```

**응답:**
```json
{
  "menuId": "301:0",
  "liked": true,
  "favorites": ["301:0", "301:1", "dure:0"]
}
```

---

## 🧪 테스트 시나리오

### ✅ 기본 동작
- [x] 찜하기 버튼 클릭 → 하트 색상 변경
- [x] 다시 클릭 → 찜 해제
- [x] 새로고침 → 찜 상태 유지

### ✅ 다중 사용자
- [x] 다른 브라우저 → 찜 목록 분리
- [x] 시크릿 모드 → 새로운 사용자로 인식

### ✅ 에러 처리
- [x] Workers 중지 → 롤백 동작
- [x] 네트워크 오프라인 → 롤백 동작

---

## 🚢 배포 가이드

### 1. Workers 배포

```bash
cd menu-worker
npm run deploy
```

배포 후 URL 확인 (예: `https://menu-worker.your-subdomain.workers.dev`)

### 2. React 앱 설정

`todaymenu/src/App.jsx` 파일 수정:

```javascript
const API_BASE = useMemo(() => {
    if (window.location.hostname !== "localhost" && ...) {
        return "https://menu-worker.your-subdomain.workers.dev"; // ⬅️ 실제 URL로 변경
    }
    return "http://localhost:8787";
}, []);
```

### 3. React 앱 배포

```bash
cd todaymenu
npm run build
# dist 폴더를 Cloudflare Pages에 배포
```

---

## 🔍 디버깅

### 브라우저 개발자 도구

1. **Console** - 에러 메시지 확인
2. **Network** - API 요청/응답 확인
3. **Application > Local Storage** - anonymousId 확인

### Workers 로그

```bash
cd menu-worker
wrangler tail
```

### KV 데이터 확인

```bash
# 모든 찜 목록 키 나열
wrangler kv:key list --binding=MENU_KV --prefix="favorites:"

# 특정 사용자 찜 목록 조회
wrangler kv:key get "favorites:YOUR-ANON-ID" --binding=MENU_KV
```

---

## 🛡️ 보안 및 프라이버시

- ✅ **익명성 보장** - 개인정보 수집 없음
- ✅ **데이터 격리** - anonymousId 기반 완전 분리
- ✅ **자동 만료** - KV TTL 1년 후 자동 삭제
- ✅ **CORS 보호** - 허용된 헤더만 사용

---

## 📈 향후 개선 사항

- [ ] 실시간 동기화 (WebSocket)
- [ ] 찜 개수 제한 (사용자당 최대 100개)
- [ ] 메뉴별 전체 찜 개수 통계
- [ ] 찜 목록 내보내기/가져오기
- [ ] D1 데이터베이스 마이그레이션 (복잡한 쿼리 필요 시)

---

## 🤝 기여

문제가 발생하거나 개선 사항이 있으면 이슈를 등록해주세요.

---

## 📄 라이선스

이 프로젝트는 사내용으로 제작되었습니다.

---

## 📞 지원

- **문서**: `FAVORITES_GUIDE.md` 참고
- **빠른 시작**: `QUICKSTART.md` 참고
- **디버깅**: 브라우저 개발자 도구 Console 확인

---

**구현 완료일**: 2026-01-14  
**버전**: 1.0.0  
**상태**: ✅ 로컬 테스트 준비 완료


# 찜하기 기능 구현 가이드

## 📋 개요

익명 사용자 식별자(Anonymous ID)를 사용하여 로그인 없이 사용자별로 찜하기 기능을 분리하고 서버(Cloudflare Workers)에 저장하는 기능을 구현했습니다.

## 🏗️ 아키텍처

### 1. 익명 사용자 식별
- **UUID v4** 기반 익명 식별자 생성
- **localStorage**에 `anonymousId` 키로 저장
- 최초 방문 시 자동 생성, 이후 재사용
- API 호출 시 `X-Anonymous-Id` 헤더로 전송

### 2. 데이터 저장
- **Cloudflare KV**를 사용하여 찜 목록 저장
- 키 형식: `favorites:{anonymousId}`
- 값 형식: JSON 배열 `["301:0", "dure:0", ...]`
- TTL: 1년 (365일)

### 3. API 엔드포인트

#### GET /api/favorites
사용자의 찜 목록 조회

**요청 헤더:**
```
X-Anonymous-Id: {uuid}
```

**응답:**
```json
{
  "favorites": ["301:0", "301:1", "dure:0"]
}
```

#### POST /api/favorites/toggle
찜 상태 토글

**요청 헤더:**
```
X-Anonymous-Id: {uuid}
Content-Type: application/json
```

**요청 본문:**
```json
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

## 🚀 로컬 테스트 방법

### 1. Workers 개발 서버 실행

```bash
cd menu-worker
npm run dev
```

Workers가 `http://localhost:8787`에서 실행됩니다.

### 2. React 개발 서버 실행

새 터미널에서:

```bash
cd todaymenu
npm run dev
```

React 앱이 `http://localhost:5173`에서 실행됩니다.

### 3. 브라우저에서 테스트

1. `http://localhost:5173` 접속
2. 개발자 도구 열기 (F12)
3. **Application > Local Storage**에서 `anonymousId` 확인
4. 메뉴 카드의 하트 버튼 클릭하여 찜하기 테스트
5. **Network** 탭에서 API 호출 확인:
   - `/api/favorites` (GET) - 초기 로드
   - `/api/favorites/toggle` (POST) - 찜 토글

### 4. curl을 사용한 API 테스트

```bash
# 익명 ID 생성 (예시)
ANON_ID="test-user-12345"

# 찜 목록 조회
curl -H "X-Anonymous-Id: $ANON_ID" \
  http://localhost:8787/api/favorites

# 찜 추가/제거
curl -X POST \
  -H "X-Anonymous-Id: $ANON_ID" \
  -H "Content-Type: application/json" \
  -d '{"menuId":"301:0"}' \
  http://localhost:8787/api/favorites/toggle

# 다시 조회하여 확인
curl -H "X-Anonymous-Id: $ANON_ID" \
  http://localhost:8787/api/favorites
```

### 5. 다중 사용자 시나리오 테스트

**시나리오 1: 같은 브라우저, 다른 탭**
- 같은 `anonymousId` 사용
- 한 탭에서 찜하면 다른 탭에서는 새로고침 필요

**시나리오 2: 다른 브라우저**
- 다른 `anonymousId` 생성
- 찜 목록이 완전히 분리됨

**시나리오 3: 시크릿 모드**
- 새로운 `anonymousId` 생성
- 시크릿 창 닫으면 데이터 삭제 (localStorage 특성)

**시나리오 4: localStorage 초기화**
```javascript
// 개발자 도구 Console에서 실행
localStorage.removeItem('anonymousId');
location.reload();
// 새로운 anonymousId가 생성되고 찜 목록이 초기화됨
```

## 📦 배포 방법

### 1. Workers 배포

```bash
cd menu-worker
npm run deploy
```

배포 후 Workers URL 확인 (예: `https://menu-worker.your-subdomain.workers.dev`)

### 2. React 앱의 API URL 수정

`todaymenu/src/App.jsx`에서 API_BASE 설정 수정:

```javascript
const API_BASE = useMemo(() => {
    // 배포 환경에서는 실제 Workers URL 사용
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        return "https://menu-worker.your-subdomain.workers.dev"; // ⬅️ 실제 URL로 변경
    }
    // 로컬 개발 시 Workers dev server
    return "http://localhost:8787";
}, []);
```

### 3. React 앱 빌드 및 배포

```bash
cd todaymenu
npm run build
```

`dist` 폴더를 Cloudflare Pages에 배포합니다.

## 🔍 예상 엣지케이스 및 처리

### 1. localStorage 접근 불가
**원인:** 시크릿 모드, 브라우저 설정, 쿠키 차단
**처리:** 임시 세션 ID 생성 (`temp-{uuid}`)
```javascript
// utils/anonymousId.js에서 처리됨
catch (e) {
    console.warn("localStorage 접근 실패, 임시 ID 사용:", e);
    return `temp-${generateUUID()}`;
}
```

### 2. 네트워크 오류 (API 호출 실패)
**처리:** 낙관적 업데이트 롤백
```javascript
// App.jsx의 handleToggleFavorite에서 처리
catch (e) {
    console.error("찜하기 토글 에러:", e);
    // 실패 시 롤백
    setLikes((prev) => { /* 이전 상태로 복원 */ });
}
```

### 3. 서버 응답과 로컬 상태 불일치
**처리:** 서버 응답 기준으로 동기화
```javascript
if (json.liked !== expectedLiked) {
    console.warn("서버 응답과 로컬 상태 불일치, 롤백합니다.");
    setLikes((prev) => { /* 서버 상태로 동기화 */ });
}
```

### 4. CORS 에러
**처리:** Workers에서 CORS 헤더 자동 추가
```javascript
// menu-worker/src/index.js
headers: {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, X-Anonymous-Id",
}
```

### 5. 동시 요청 (Race Condition)
**시나리오:** 사용자가 빠르게 여러 번 클릭
**처리:** 
- 낙관적 업데이트로 UI는 즉시 반응
- 서버는 마지막 요청 기준으로 처리
- 불일치 발생 시 서버 응답으로 동기화

### 6. KV 저장 실패
**처리:** Workers에서 try-catch로 에러 응답
```javascript
catch (e) {
    return jsonResponse({ error: e?.message || "toggle failed" }, 500);
}
```

### 7. 익명 ID 충돌
**가능성:** UUID v4는 충돌 확률이 극히 낮음 (2^122)
**처리:** 실질적으로 무시 가능

### 8. 찜 목록이 너무 많아지는 경우
**현재:** 제한 없음
**개선 방안:** 필요시 최대 100개 등으로 제한 추가

## 🧪 테스트 체크리스트

- [ ] 최초 방문 시 anonymousId 자동 생성
- [ ] localStorage에 anonymousId 저장 확인
- [ ] 찜하기 버튼 클릭 시 UI 즉시 반응 (낙관적 업데이트)
- [ ] 찜하기 API 호출 성공 확인
- [ ] 찜 해제 동작 확인
- [ ] 페이지 새로고침 후 찜 상태 유지
- [ ] 다른 브라우저에서 찜 목록 분리 확인
- [ ] 네트워크 오류 시 롤백 동작 확인
- [ ] CORS 헤더 정상 작동 확인
- [ ] Workers KV에 데이터 저장 확인

## 📝 주요 파일 목록

### 추가된 파일
- `todaymenu/src/utils/anonymousId.js` - 익명 ID 관리 유틸리티

### 수정된 파일
- `menu-worker/src/index.js` - 찜하기 API 엔드포인트 추가
- `todaymenu/src/App.jsx` - 찜하기 API 연동 및 낙관적 업데이트

## 🔒 보안 고려사항

1. **익명성 보장**: 실제 사용자 정보 수집 없음
2. **데이터 격리**: anonymousId 기반으로 완전 분리
3. **Rate Limiting**: 필요시 Workers에서 IP 기반 제한 추가 가능
4. **데이터 만료**: KV TTL 1년으로 자동 정리

## 🎯 향후 개선 가능 사항

1. **실시간 동기화**: WebSocket으로 여러 탭 간 실시간 동기화
2. **찜 개수 제한**: 사용자당 최대 찜 개수 제한
3. **통계 기능**: 메뉴별 전체 찜 개수 집계
4. **내보내기/가져오기**: 찜 목록 백업/복원 기능
5. **D1 마이그레이션**: KV 대신 D1 데이터베이스 사용 (더 복잡한 쿼리 필요 시)

## 📞 문제 해결

### Workers 로그 확인
```bash
wrangler tail
```

### KV 데이터 직접 확인
```bash
# 특정 사용자의 찜 목록 조회
wrangler kv:key get "favorites:YOUR-ANON-ID" --binding=MENU_KV

# 모든 favorites 키 나열
wrangler kv:key list --binding=MENU_KV --prefix="favorites:"
```

### 디버깅 팁
1. 브라우저 개발자 도구 Console에서 에러 확인
2. Network 탭에서 API 요청/응답 확인
3. Application 탭에서 localStorage 확인
4. Workers 로그에서 서버 에러 확인

---

**구현 완료일**: 2026-01-14
**구현자**: AI Assistant
**테스트 상태**: 로컬 테스트 준비 완료


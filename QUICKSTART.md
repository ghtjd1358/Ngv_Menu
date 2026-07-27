# 🚀 찜하기 기능 빠른 시작 가이드

## 1️⃣ 로컬 테스트 (5분)

### 터미널 1: Workers 실행
```bash
cd menu-worker
npm run dev
```
✅ `http://localhost:8787`에서 실행됨

### 터미널 2: React 앱 실행
```bash
cd todaymenu
npm run dev
```
✅ `http://localhost:5173`에서 실행됨

### 브라우저에서 테스트
1. `http://localhost:5173` 접속
2. 메뉴 카드의 ♥ 버튼 클릭
3. 새로고침 후 찜 상태 유지 확인

## 2️⃣ API 직접 테스트

```bash
# 찜 목록 조회
curl -H "X-Anonymous-Id: test-123" \
  http://localhost:8787/api/favorites

# 찜 추가
curl -X POST \
  -H "X-Anonymous-Id: test-123" \
  -H "Content-Type: application/json" \
  -d '{"menuId":"301:0"}' \
  http://localhost:8787/api/favorites/toggle

# 다시 조회
curl -H "X-Anonymous-Id: test-123" \
  http://localhost:8787/api/favorites
```

## 3️⃣ 배포 (Workers)

### Workers 배포
```bash
cd menu-worker
npm run deploy
```

배포 후 URL 확인:
```
https://menu-worker.your-subdomain.workers.dev
```

### React 앱 설정 수정

`todaymenu/src/App.jsx` 파일에서 **43번째 줄** 근처:

```javascript
const API_BASE = useMemo(() => {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        return "https://menu-worker.your-subdomain.workers.dev"; // ⬅️ 여기 수정!
    }
    return "http://localhost:8787";
}, []);
```

### React 앱 빌드 및 배포
```bash
cd todaymenu
npm run build
# dist 폴더를 Cloudflare Pages에 배포
```

## 4️⃣ 테스트 시나리오

### ✅ 기본 동작
- [ ] 찜하기 버튼 클릭 → 하트 색상 변경
- [ ] 다시 클릭 → 찜 해제
- [ ] 새로고침 → 찜 상태 유지

### ✅ 다중 사용자
- [ ] 다른 브라우저에서 접속 → 찜 목록 분리
- [ ] 시크릿 모드 → 새로운 사용자로 인식

### ✅ 에러 처리
- [ ] Workers 중지 → 에러 메시지 표시 및 롤백
- [ ] 네트워크 오프라인 → 롤백 동작

## 🔧 문제 해결

### Workers가 시작되지 않음
```bash
# wrangler 재설치
cd menu-worker
npm install wrangler@latest
```

### CORS 에러
- Workers의 CORS 헤더가 자동으로 추가되어 있음
- 브라우저 콘솔에서 에러 확인

### 찜 상태가 저장되지 않음
```javascript
// 브라우저 콘솔에서 확인
console.log(localStorage.getItem('anonymousId'));
```

### KV 데이터 확인
```bash
cd menu-worker
wrangler kv:key list --binding=MENU_KV --prefix="favorites:"
```

## 📚 자세한 문서

더 자세한 내용은 `FAVORITES_GUIDE.md`를 참고하세요.

---

**문의사항이 있으면 개발자 도구 Console을 먼저 확인하세요!**


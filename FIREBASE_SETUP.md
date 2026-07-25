# Firebase 설정 가이드 — 구글 로그인 + 클라우드 백업

> 프로젝트: `card-alarm-service` · 이 앱의 클라우드 동기화는 **완전 선택(옵트인)**입니다.
> 로그인하기 전에는 아무 정보도 서버로 전송되지 않고, 지금처럼 100% 로컬로 동작합니다.
> Firebase 웹 설정값은 이미 코드에 들어 있어(`src/lib/firebase/config.ts`) 별도 env 없이 동작합니다.

아래 콘솔 설정만 마치면 됩니다. (코드 쪽은 이미 준비 완료)

---

## 1) 구글 로그인 켜기

Firebase 콘솔 → **Authentication** → **Sign-in method**
- **Google** 공급업체 → **사용 설정(Enable)** → 지원 이메일 선택 → 저장

Firebase 콘솔 → **Authentication** → **Settings** → **승인된 도메인(Authorized domains)**
- `localhost` (기본 포함)
- **`25f.netlify.app` 추가** ← 배포 도메인. 없으면 배포 사이트에서 로그인 팝업이 막힙니다.

---

## 2) Cloud Storage 만들고 보안 규칙 넣기

Firebase 콘솔 → **Build → Storage** → **시작하기**로 버킷 생성
(버킷: `card-alarm-service.firebasestorage.app`)

**Storage → Rules** 탭에 아래 전체 코드를 붙여넣고 **게시(Publish)** 하세요.
(사용자는 자신의 UID 폴더만 읽고 쓸 수 있습니다. 남의 백업은 접근 불가.)

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 20 * 1024 * 1024; // 백업 파일 20MB 상한
    }
  }
}
```

> 이 파일은 저장소의 `storage.rules` 에도 있습니다.
> Firebase CLI를 쓴다면: `firebase deploy --only storage` (설정 파일 `firebase.json` 포함)

---

## 3) Storage CORS 허용 (웹에서 업로드·다운로드하려면 필요)

웹 브라우저에서 Storage에 접근하려면 버킷에 CORS를 한 번 설정해야 합니다.
[Google Cloud SDK(gsutil)](https://cloud.google.com/storage/docs/gsutil_install) 설치 후:

```bash
gsutil cors set cors.json gs://card-alarm-service.firebasestorage.app
```

`cors.json` 은 저장소 루트에 있습니다(배포 도메인 + localhost 허용).
> 도메인을 바꾸면 `cors.json` 의 `origin` 을 수정해 다시 `gsutil cors set` 하세요.

---

## 4) (선택) Netlify 환경변수

설정값은 코드에 기본으로 들어 있어 **추가하지 않아도 동작**합니다.
다른 Firebase 프로젝트로 바꾸고 싶을 때만 Netlify → Site settings → Environment variables 에 등록하면 코드 기본값을 덮어씁니다.

| Key | Value (현재 프로젝트) |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyCfYrEgji-YBDwx-qbcmuSColugsrbj4hA` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `card-alarm-service.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `card-alarm-service` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `card-alarm-service.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `1037642779249` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:1037642779249:web:dcc7529fbc8c6edab2e9d0` |

> 웹 Firebase 설정값은 "비밀"이 아닙니다(모든 클라이언트에 노출됨). 실제 보안은 위 Storage 보안 규칙 + 승인된 도메인이 담당합니다. 필요하면 Google Cloud Console에서 이 API 키를 특정 도메인/API로 제한할 수 있습니다.

---

## 동작 방식 요약

- **로그인**: 첫 화면 또는 설정 시트에서 "Google로 계속하기". 세션은 브라우저에 유지됩니다.
- **백업**: 설정 → 클라우드 → "클라우드에 백업". 전체 데이터를 내 UID 폴더에 JSON으로 올립니다.
- **암호화(선택·권장)**: 비밀번호를 입력하고 "비밀번호로 암호화"를 켜면, 업로드 전에 이 기기에서 AES-GCM으로 암호화합니다. **서버는 평문을 절대 보지 못합니다.** (비밀번호를 잊으면 복구 불가)
- **복원**: 다른 기기에서 로그인 후 "복원(병합/덮어쓰기)". 암호화된 백업은 같은 비밀번호로만 풀립니다.
- **자동 백업**: 설정에서 켜면 데이터가 바뀔 때 잠시 뒤 자동 업로드합니다.
- **로그아웃하면** 이후 외부 요청이 다시 0건이 됩니다.

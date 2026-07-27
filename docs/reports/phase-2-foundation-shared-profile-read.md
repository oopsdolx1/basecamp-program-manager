# BaseCamp Program Manager Phase 2 Report

작성일: 2026-07-27

## 1. 프로젝트 생성 경로

`C:\Users\user\Documents\Codex\2026-07-21\basecamp-program-manager`

기존 `condition-lab` 저장소는 수정하지 않고, 같은 날짜 작업 폴더 아래에 별도 Vite + React + TypeScript 프로젝트로 생성했다.

## 2. 생성 및 수정 파일 목록

- `package.json`
- `package-lock.json`
- `.gitignore`
- `.env.example`
- `index.html`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/AppProviders.tsx`
- `src/app/AppRouter.tsx`
- `src/app/routes.ts`
- `src/app/routeBuilder.ts`
- `src/components/common/*`
- `src/components/layout/*`
- `src/features/members/*`
- `src/features/programs/*`
- `src/features/printing/*`
- `src/firebase/*`
- `src/theme/*`
- `src/types/*`
- `src/utils/normalizeText.ts`
- `docs/reports/phase-2-foundation-shared-profile-read.md`

## 3. 설치한 패키지

Runtime:

- React
- React DOM
- React Router DOM
- Firebase
- Material UI
- Emotion
- MUI Icons

Development:

- TypeScript
- Vite
- Vite React plugin
- React type packages

`npm install` 결과 npm audit 기준 취약점 경고가 있었다.

- moderate: 12
- high: 2

Phase 2 범위를 넘는 의존성 자동 변경을 피하기 위해 `npm audit fix`는 실행하지 않았다.

## 4. Firebase 환경변수 구성

`.env.example`에는 다음 변수 이름만 추가했다.

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_CONDITION_LAB_APP_ID`

실제 Firebase 값은 코드와 보고서에 작성하지 않았다. 기존 Condition Lab의 fallback `appId`는 `basecamp_production`으로 확인되어 `.env.example`의 `VITE_CONDITION_LAB_APP_ID` 예시값에만 반영했다.

## 5. profiles 경로 연결 결과

Path Builder를 구현했다.

- `profilesCollectionPath(appId)`
- `programsCollectionPath(appId)`
- `printHistoryCollectionPath(appId)`
- `programManagerSettingsPath(appId)`

이번 Phase에서 실제 사용되는 경로는 `profilesCollectionPath(appId)`뿐이다.

반환 경로:

`artifacts/{appId}/public/data/profiles`

`appId`가 비어 있으면 명확한 오류를 발생시키도록 했다.

## 6. 인증 결과

기존 Condition Lab 방식과 맞춰 다음 순서로 인증을 시도하도록 구현했다.

- `globalThis.__initial_auth_token`이 있으면 custom token 로그인
- 없으면 anonymous sign-in

단, 현재 새 프로젝트에는 실제 `.env.local`이 없으므로 로컬 실행에서 Firebase 프로젝트 연결과 실제 인증 완료 여부는 검증하지 못했다.

## 7. 실제 조회된 member 문서 수

실제 Firebase 조회는 수행하지 못했다.

사유:

- 민감한 Firebase 값을 코드나 보고서에 남기지 않는 조건을 지켰다.
- 새 프로젝트에는 실제 `.env.local`이 없다.
- mock 데이터 우회는 금지되어 있어 사용하지 않았다.

UI와 repository에는 실제 조회 후 다음 숫자를 화면에 표시하는 진단 영역을 구현했다.

- 전체 문서 수
- `role === "member"` 문서 수
- role 제외 문서 수
- role 누락 문서 수
- 이름 누락 문서 수
- ID 불일치 문서 수
- `contact` fallback 사용 수
- `note` fallback 사용 수

## 8. role별 제외 문서 수

실제 조회가 차단되어 숫자는 확인하지 못했다.

구현 규칙:

- `role === "member"`만 회원 목록에 포함
- `trainer` 및 기타 role은 제외
- role 누락 문서는 member로 추정하지 않고 제외

## 9. Mapper legacy alias 발견 결과

실제 조회가 차단되어 숫자는 확인하지 못했다.

구현 규칙:

- `phone` 우선
- `phone`이 없고 `contact`가 있으면 읽기 fallback
- `memo` 우선
- `memo`가 없고 `note`가 있으면 읽기 fallback
- 원본 Firestore 문서는 수정하지 않음

## 10. ID 불일치 문서 수

실제 조회가 차단되어 숫자는 확인하지 못했다.

구현 규칙:

- Firestore document ID를 canonical ID로 사용
- 문서 내부 `id`가 다르면 진단 숫자에 반영
- UI와 저장 관계의 기준은 document ID

## 11. 이름 또는 role 누락 문서 수

실제 조회가 차단되어 숫자는 확인하지 못했다.

구현 규칙:

- 이름 누락 문서는 회원 목록에서 제외
- role 누락 문서는 회원 목록에서 제외
- 누락 숫자는 진단 영역에 표시

## 12. 회원 검색 및 선택 동작 결과

구현 완료:

- `/`에서 `/program-manager/quick-print`로 redirect
- `/program-manager/quick-print`에서 회원 선택 검증 화면 표시
- 이름 검색
- 전화번호 검색
- 공백 정규화
- 대소문자 정규화
- 회원 선택 상태 유지
- 선택 회원 요약 카드 표시
- "운동 프로그램 선택" 버튼은 비활성 상태로 표시

구독 데이터가 실제로 들어오면 검색과 선택은 Firestore 원본을 수정하지 않고 view model 기준으로 동작한다.

## 13. 테스트 결과

별도 테스트 프레임워크는 도입하지 않았다.

검증한 항목:

- TypeScript strict 빌드
- Vite production build
- mapper와 검색 로직은 TypeScript 컴파일 경계에서 타입 검증
- repository가 Firebase SDK 호출을 컴포넌트 밖으로 분리했는지 확인
- component에서 `onSnapshot` 직접 호출 없음

실제 Firestore subscription 업데이트, 삭제 반영, unsubscribe 동작은 `.env.local`과 Firebase 읽기 권한 확인 전까지 실데이터로 검증하지 못했다.

## 14. npm run build 결과

`npm run build` 성공.

첫 실행은 sandbox 권한 문제로 Vite 내부 빌드 도구 실행이 차단되었고, 권한 승인 후 재실행하여 성공했다.

빌드 경고:

- production bundle chunk가 500 kB를 초과했다.

원인 후보:

- Firebase + MUI 초기 번들이 한 번에 포함됨

다음 Phase에서 route-level lazy loading 또는 manual chunks를 검토할 수 있다.

## 15. 미해결 문제

- 실제 `.env.local`이 없어 Firebase 연결과 실시간 profiles 조회를 완료하지 못했다.
- Firebase Security Rules는 수정하지 않았고, 실제 읽기 권한도 검증하지 못했다.
- npm audit 취약점 경고가 남아 있다.
- 실데이터 기반 member/trainer/누락/alias/ID 불일치 숫자는 미확인이다.
- component-level UI 시각 검증은 로컬 실행 전이라 완료하지 못했다.

## 16. 다음 Phase 권장 범위

1. 실제 `.env.local`을 구성하고 `/program-manager/quick-print`에서 profiles 읽기 권한을 확인한다.
2. 실데이터 진단 숫자를 보고서에 보강한다.
3. subscription 업데이트와 삭제 반영을 브라우저에서 확인한다.
4. 프로그램 선택 placeholder 다음 단계의 UX 범위를 확정한다.
5. 프로그램 CRUD 구현 전 Firestore `programs` 저장 스키마와 Rules 전략을 먼저 확정한다.

## Stop Condition

Phase 2 구현은 foundation, route, theme, Firebase boundary, path builder, shared profile read integration 코드까지 완료했다.

실제 Firebase profiles 조회는 환경변수 미구성으로 중단했다. mock 데이터로 우회하지 않았다.

# Phase 2-T3 — 회원별 추천 운동 프로그램 연동 (T3-A 조사 + 키오스크 권한 분리 수정)

범위: 조사, 데이터 계약 확인, Emulator 연동 테스트, 설계. 운영 UI, 편집기, 추천 엔진, 출력 로직, QR, Rules, 운영 Firebase는 변경하거나 접근하지 않았다.

## A. Program Manager 현재 구조

| 항목 | 실제 구현 |
| --- | --- |
| 회원 선택 | `QuickPrintFlow` 1단계. `profileRepository.subscribeMembers`가 `artifacts/{appId}/public/data/profiles`를 onSnapshot으로 구독하고 `role === "member"`, 이름이 있는 문서만 남긴다. 이름, 전화번호, 초성 검색(`memberSelectionFilterService`). |
| 회원 ID | `memberId` = profile **문서 ID** (`mapProfileDocument(documentId)`). `raw.id`가 다르면 `id-mismatch` 경고만 남긴다. |
| 운동 편집기 | `SnapshotBuilderState`/`SnapshotBuilderHistory` (`snapshotBuilderService`). 생성 경로는 `createSnapshotBuilderHistory(program)`(전역 Program), `createMergedSnapshotBuilderHistory`(다중 부위), `createManualWorkoutBuilderHistory`(직접 구성). 최대 8종목. |
| 운동 카탈로그 | `programManagerRuntime`이 `artifacts/{appId}/public/data/sharedKnowledgeRuntime/current`(Condition Lab이 발행)를 읽는다. 행의 `catalogExerciseId`가 canonical ID. |
| 출력 snapshot | `goPrintPreview` → `createWorkoutSession` → `buildWorkoutSessionRecord`. `exercises[]`(`exerciseId`, `programExerciseId`, `name`, `order`, `plannedSets?`, `memo?`), `exerciseIds`, `memberSnapshot`, `programSnapshot`, `prescription`, `source`, `print`를 `artifacts/{appId}/public/data/workoutSessions/{sessionId}`에 저장. |
| `programExerciseId` | `mapSessionPrescriptionExercises`에서 **builder 행 ID**(`SnapshotBuilderExercise.id`, 행 생성 시 `crypto.randomUUID()`). 원본 Program의 행 ID가 아니다. 재출력 시 `printPreviewAuthorityResolver`가 이를 행 ID로 되돌려 쓴다. |
| sessionId | `ws_YYYYMMDD_<uuid 앞 12자>` (`createWorkoutSessionId`). |
| QR | `WorkoutPrintTemplateV1`이 `workoutSessionId`만 담는다(`QRCodeSVG`). |
| source | `WorkoutSource = {type:"program", programId} \| {type:"manual"}`. `program`은 전역 Program ID를 뜻한다. |
| 인증 | `ensureFirebaseAuth()` = `__initial_auth_token`이 있으면 custom token, 없으면 **익명 로그인**. Trainer claim 없음. |

## B. 두 프로젝트 namespace

| 항목 | Condition Lab | Program Manager |
| --- | --- | --- |
| Firebase projectId (`.env.local`) | `basecamp-40f23` | `basecamp-40f23` |
| Firebase SDK appId | `.env.local` 값 동일 (값 비교로 확인) | 동일 |
| 데이터 appId (`VITE_CONDITION_LAB_APP_ID`, `.env.local`) | `basecamp_production` | `basecamp_production` |
| Emulator | project `basecamp-e2e-local`, appId `basecamp_e2e_test`, Auth 19099, Firestore 18080 | 자체 Emulator 설정 없음 |
| 회원 경로 | `artifacts/{appId}/public/data/profiles/{memberId}` | 동일 경로, 문서 ID = memberId |
| 추천 경로 | `artifacts/{appId}/private/data/memberWorkoutPrograms/{programId}` | (미사용) |

- Firebase SDK `appId`(`1:…:web:…`)와 Firestore 경로의 `{appId}`(`VITE_CONDITION_LAB_APP_ID`)는 **서로 다른 개념**이다. 경로에는 후자만 쓰인다.
- 두 값은 로컬 `.env.local` 기준으로 일치한다. Vercel 운영 환경 변수는 확인하지 않았다(추정하지 않음).
- **제약:** `memberWorkoutProgramHandler`와 `trustedIssuance`는 `appId !== 'basecamp_e2e_test'`이면 `SERVER_CONFIGURATION_INVALID`를 던진다. 현재 서버 API는 운영 namespace를 제공할 수 없고, 운영 호스트 연결(어댑터 wiring)도 테스트 밖에 없다.

## C. 추천 프로그램 API (Condition Lab Phase 2-T2-A)

| Method / Path | 권한 | 동작 |
| --- | --- | --- |
| `GET /v1/trainer/members?query=` | Trainer | 이름 검색, `{memberId, name, displayNumber?}` |
| `GET /v1/trainer/members/{memberId}/workout-programs` | Trainer | profile 존재 확인 후 해당 member의 **전체(active+archived)** 목록, `isDefault` 우선 → `updatedAt` 내림차순. 필터 파라미터 없음. |
| `GET /v1/trainer/workout-programs/{id}` | Trainer | 단건 상세 |
| `POST /v1/trainer/members/{memberId}/workout-programs` | Trainer | 생성(catalog ID 검증, 1~8종목) |
| `PATCH /v1/trainer/workout-programs/{id}` | Trainer | update / setDefault / archive / clone, revision 검증 |

- 응답 projection(`view`): `id, memberId, name, description, exercises[], isDefault, status, revision, createdAt, updatedAt`(ms).
- 인증: `Authorization: Bearer <Firebase ID token>` → Admin SDK `verifyIdToken(token, true)` → `aud/iss` 프로젝트 검증 → custom claim `basecampRole === 'trainer'`.
- 오류: `{ error: { code, message, retryable } }`. 401 `AUTH_REQUIRED`/`AUTH_INVALID`/`AUTH_EXPIRED`, 403 `FORBIDDEN`, 404 `MEMBER_NOT_FOUND`/`PROGRAM_NOT_FOUND`, 409 `PROGRAM_REVISION_CONFLICT`.
- 설계 문서의 `GET /v1/print/members/{memberId}/workout-programs`는 **구현되지 않았다**. HTTP 어댑터는 `/v1/trainer/` 외 경로를 404로 막는다.

**결론:** Program Manager의 현재 identity(익명 사용자)는 `basecampRole`이 없어 403 `FORBIDDEN`. Emulator에서 확인했다. 기존 API만으로는 Program Manager에서 안전하게 조회할 수 없다. Trainer 권한 임의 부여, Master 비밀번호, 회원 선택 상태, QR은 근거로 쓰지 않는다.

### 결정 이력

- 2026-11-16 (T3-A): `/v1/print/members/{memberId}/workout-programs`를 Trainer 전용으로 하고 Program Manager 단말을 Trainer로 로그인시키는 안을 채택했다.
- **2026-11-16 (T3 수정): 위 결정을 철회한다.** Program Manager는 회원이 직접 쓰는 공용 키오스크이므로 Trainer 권한을 주지 않는다. `/v1/print/...` Trainer 전용 endpoint는 만들지 않는다. Trainer 쓰기 API(`/v1/trainer/*`)와 키오스크 읽기 API를 분리하고, 기존 Kiosk 세션 및 회원 바인딩 구조를 재사용한다.

### 키오스크 읽기 API (구현됨, Emulator 전용)

기존 `kioskScopedReadHandler`(`/v1/kiosk/session/profile`, `/logs`)에 경로 하나를 추가했다.

```
GET /v1/kiosk/session/workout-programs?kioskSessionId=<id>
Authorization: Bearer <kiosk ID token>   // basecampRole: 'kiosk', deviceId, kioskSessionId claim
200 { programs: Array<{ id, name, isDefault,
                        exercises: Array<{ exerciseId, name, order, plannedSets, memo? }> }> }
```

- 권한: `requireRole([KIOSK])` → `trustedIssuance.resolveKioskMemberScope`. 토큰의 session/device claim, 서버의 `authKioskSessions`(active, 미만료, 미철회, deviceId 일치), `authKioskDevices`(registered, 미철회)를 요청마다 확인한다. 데이터를 읽은 뒤 다시 확인한다(`ensureStillScoped`).
- memberId는 서버 세션에서만 결정한다. query에 `memberId`가 있으면 400 `MEMBER_ID_NOT_ALLOWED`.
- 반환: 해당 회원의 `status === 'active'`만, default 우선 → `updatedAt` 내림차순. `description`, `status`, `revision`, `createdBy/updatedBy`, 타임스탬프, `memberId`는 반환하지 않는다.
- 읽기 전용이다. Trainer 토큰도 이 경로에서는 403이다(역할 분리).
- 변경 파일 (Condition Lab): `server/kiosk/kioskScopedReadHandler.js`, `server/http/kioskScopedReadHttpAdapter.js`(허용 경로 추가), 신규 `server/http/tests/kioskWorkoutProgramRead.emulator.test.js`.

### 세션 시작: 기기 신뢰 정책 (구현됨, Emulator 전용)

결정 이력 (2026-11-16): 모델 A(Trainer가 키오스크로 보내기)를 구현했다가, 운영 방식 확정("보내기 버튼·기기 지정 없음, 회원이 자신을 선택하면 자동 표시")에 따라 철회했다. 이 방식은 회원 확인 수단 없이 서버가 회원 범위를 보증할 수 없다. 사용자가 이 위험을 알고 **기기 신뢰 정책**을 명시적으로 승인했다.

정책: 등록되고 철회되지 않은 키오스크 기기에서 회원이 자신을 선택하면, 서버가 그 회원에 대한 짧은 읽기 전용 세션을 연다.

- 위험(수용됨): 등록된 키오스크 앞의 사람은 다른 회원 이름을 눌러 그 회원의 추천 운동 목록을 볼 수 있다. 노출 범위는 active 추천의 운동명, 순서, 세트, 메모뿐이다. 참고로 Program Manager는 이미 회원 프로필 목록 전체를 브라우저에서 읽는다.
- 서버 보장:
  - 회원 선택은 서버가 검증한 **기기 전용 identity**에서만 받는다. 익명, Trainer, 회원, 세션 토큰은 403이고, 토큰이 없으면 401이다.
  - 기기 등록 및 미철회를 확인한다.
  - `role === 'member'` profile만 열 수 있다. 그 외에는 404다.
  - 세션 TTL은 15분이고, 기기당 active 세션은 1개다(새 시작 시 이전 세션 `superseded`).
  - 기기당 분당 12회까지만 시작할 수 있다(초과 시 429).
  - 세션 문서가 감사 기록이다(기기, 회원, 생성·종료·대체 시각, `activationModel: 'deviceTrust'`).
  - 읽기 때마다 `resolveKioskMemberScope`가 세션과 기기를 재확인한다. `memberId` 주입은 400이다.
  - 응답은 최소 필드뿐이고, 쓰기 경로는 없다.
  - 종료되거나 만료된 세션은 재사용할 수 없다.
- API:
  - `POST /v1/kiosk/session/start { memberId }`(기기 전용 토큰) → `{ kioskSessionId, customToken, expiresAt, member: { id, name } }`
  - 기존 `GET /v1/kiosk/session/workout-programs`
  - 기존 `POST /v1/kiosk/session/close`
- Trainer 쓰기 API(`/v1/trainer/*`)는 그대로 두고, 키오스크 경로와 분리했다. Trainer 보내기, 기기 목록, 수령 경로는 제거했다.
- 변경 파일 (Condition Lab):
  - `server/auth/trustedIssuance.js`: `issueKioskDeviceToken`, `startKioskSessionForDevice`, `registerKioskDevice`의 `label`
  - 신규 `server/kiosk/kioskSessionActivationHandler.js`, 신규 `server/http/kioskSessionActivationHttpAdapter.js`(`createLocalApiGateway` 포함)
  - `server/kiosk/kioskScopedReadHandler.js`, `server/http/kioskScopedReadHttpAdapter.js`(추천 읽기 경로)
  - 테스트 2개

### 운영 배포 전 공통 선행 조건 (T3-B 범위 밖)

- `kioskScopedReadHandler`, `trustedIssuance`, `memberWorkoutProgramHandler`는 `appId !== 'basecamp_e2e_test'`이면 실행을 거부한다. 운영 appId 주입과 운영 호스트 wiring이 필요하다.
- 운영 Trainer sign-in 방식(`PHASE2_AUTH_API_CONTRACT.md` "open").
- 키오스크 기기 등록 절차, 기기 토큰 회전/철회(`revokeRefreshTokens`), 유휴 시간 정책.
- 운영 Firestore 인덱스: 활성화와 수령은 `authKioskSessions`에 equality 다중 조건 쿼리를 쓴다(`deviceId`, `status`, `pickupStatus`). Emulator에서만 확인했다.

## D. 데이터 매핑

| MemberWorkoutProgram (저장) | 출력 `WorkoutSessionExerciseSnapshot` | 규칙 |
| --- | --- | --- |
| `exercises[].exerciseId` (catalog 검증됨) | `exerciseId` | 그대로. builder `catalogExerciseId`로 전달 |
| — (저장되지 않음) | `programExerciseId` | 새 builder 행 `crypto.randomUUID()`. 기존 Program/manual builder와 같은 규칙 |
| `exercises[].name` (서버가 catalog 이름으로 덮어씀) | `name` | 그대로 |
| `exercises[].order` (unique positive) | `order` | 정렬 후 1..n으로 재번호 (builder `reorder`와 동일) |
| `exercises[].plannedSets` | `plannedSets` | 그대로 (`sets`도 같은 값) |
| `exercises[].memo?` | `memo?` | 없으면 `""` |
| `name` | `programSnapshot.title` / `prescription.sourceProgramName` | builder `title` |
| `description` | — | 키오스크 projection에서 제외(트레이너 내부 설명). builder `memo`는 `""` |

- T1 설계의 `programExerciseId`(추천 행 ID)는 실제 서버 `normalizeExercises`가 **저장하지 않는다**. 추측해서 만들지 않는다.
- 미확정 필드:
  - `source`: `program`은 전역 Program을 뜻하므로 추천 ID를 넣으면 오인된다. `manual`로 두면 provenance를 잃는다. T3-B에서 `{type:"memberRecommendation", memberProgramId, revision}` 같은 명시적 schema 확장, 또는 optional provenance 필드가 필요하다(`normalizeWorkoutSource`, Condition Lab OCR context 호환성 검토 포함).
  - `category`/`categories`: 추천 모델에 카테고리가 없다. 현재 테스트에서는 `CUSTOM`을 썼다.
  - `difficulty`, `reps`, `weight`, `restSeconds`: 추천 모델에 없다. builder 기본값(`GENERAL`, `""`, `"0"`, `60`)을 쓴다.
- 원본 불변: builder state는 깊은 복사이고, 출력은 `createWorkoutSession`이 새 snapshot을 만든다. 추천 update API는 호출하지 않는다.

## E. Program Manager UI (구현됨)

- `QuickPrintFlow` 1단계(기존 회원 선택)에서 회원을 고르면 `useKioskRecommendation`이 세션을 시작하고 추천을 읽는다. 기존 "계속하기" 버튼 위에 `KioskRecommendationCard`가 나타난다.
  - 카드는 기본 추천을 먼저 보여 주고, 다른 추천은 칩으로 선택한다.
  - 버튼은 [그대로 사용] [수정해서 사용] [직접 구성]이다.
- 그대로 사용 → `createRecommendationBuilderHistory`(`manualWorkoutBuilderService`와 같은 형태) → 5단계. 수정해서 사용 → 같은 복사본으로 기존 4단계 편집기를 연다. 직접 구성 → 기존 수동 운동 선택기를 연다.
- 출력 세션 생성은 기존 `goPrintPreview` → `createWorkoutSession` → `mapSessionPrescriptionExercises`를 그대로 쓴다.
  - `source`는 `{ type: "recommendation", memberProgramId, edited }`다(`workoutSession.types.ts`, `workoutSessionRecordBuilder.ts`, `workoutSessionSourceResolver.ts`, 기록 화면 라벨 "트레이너 추천 · 제목").
  - QR, sessionId, A5 템플릿은 바꾸지 않았다.
- 세션 종료: 회원을 바꾸면 이전 세션을 close한다. workoutSession snapshot을 만든 직후(출력 미리보기로 이동하기 전) close한다. 화면을 벗어날 때도 close한다.
- 추천이 없으면 카드를 표시하지 않는다. API 주소가 없으면(`VITE_CONDITION_LAB_API_BASE_URL` 미설정) 기능을 끈다. 요청이 실패하면 "트레이너 추천 프로그램을 불러오지 못했습니다" 안내를 표시하고 기존 흐름을 유지한다.
- 인증:
  - 키오스크 기기 identity는 별도 Firebase app(`basecamp-kiosk-device`, local persistence)에 둔다. 최초 1회 `globalThis.__kiosk_device_token`(서버 발급 custom token)으로 등록한다.
  - 세션 토큰은 별도 in-memory app(`basecamp-kiosk-session`)에 둔다.
  - Program Manager 기존 익명 identity는 그대로이고, Trainer 권한은 없다.
- 개발/Emulator 지원: `VITE_FIREBASE_USE_EMULATOR=true`일 때만 Emulator에 연결한다(운영 projectId면 시작을 거부한다). `VITE_KIOSK_API_PROXY_TARGET`(localhost만)은 dev 서버 proxy다.

## F. Emulator 검증

### Condition Lab — `server/http/tests/kioskWorkoutProgramRead.emulator.test.js` (4/4 PASS)

```
node --env-file-if-exists=.env.e2e.local --test --test-concurrency=1 server/http/tests/kioskWorkoutProgramRead.emulator.test.js
```

- 정상 조회: 세션 회원의 active 추천만, default 우선, 운동 순서 정렬, 최소 필드(설명·revision·작성자·status·archived·다른 회원 미노출). 추천 없는 회원은 200 + 빈 배열. 원본 문서 불변.
- 회원 간 격리: `memberId` query 400, 다른 세션 ID 대입 403, 회원 B 세션은 B 추천만.
- 권한 없는 요청: 토큰 없음 401, 위조 401, 익명 403, **Trainer 403**, member 403, 미등록 기기 claim 403.
- 세션 만료/종료: 만료 403(`SESSION_SCOPE_DENIED`), close 403, revoke 403, 기기 revoke 403.

### Condition Lab — `server/http/tests/kioskSessionActivation.emulator.test.js` (4/4 PASS)

- 등록 기기가 회원 A 세션을 시작하면 A의 active 추천만, 최소 필드로, 기본 추천 먼저 조회된다. 원본은 불변이다.
- 회원 범위: `memberId` 주입 400, 세션 ID 대입 403. B로 시작하면 A 세션은 403이고, 기기당 active 세션은 1개다.
- 시작 권한: 토큰 없음 401, 익명/Trainer/회원/세션 토큰/철회 기기/미등록 기기 403, 없는 회원/비회원 profile 404, 빈 값 400.
- 종료: close 후 재사용 403, 만료 403, 분당 12회 초과 429.

### Program Manager 브라우저 E2E — `npm run test:kiosk-recommendation:e2e` (7/7 PASS)

Chrome(Condition Lab의 Playwright)으로 실제 키오스크 UI를 Emulator에서 조작한다.

- A: 회원을 선택하면 그 회원의 active 추천만 자동으로 표시된다.
- B: 회원을 바꾸면 A 세션이 종료되고, 추천이 없는 회원에게는 카드 없이 기존 흐름이 이어진다.
- C: 수정해서 사용 → 출력 → `edited: true`.
- D: 그대로 사용 → `edited: false`, 순서·세트·메모가 유지된다.
- E: 직접 구성 → `source: manual`.
- F: API 중단 시 실패 안내와 기존 흐름.
- G: 원본 불변, Google/Firebase 운영 호스트 요청 0건, 페이지 오류 0건.

### Program Manager — `npm run test:member-workout-program:emulator` (12/12 PASS, 실제 PM 클라이언트 사용)

`scripts/verify-member-workout-program-integration.emulator.ts`. Condition Lab 서버 모듈을 `../condition-lab`에서 동적 import한다. Emulator 전용 가드가 있다.

1. Trainer 쓰기 API로 fixture 생성(회원 A 3개, 1개 archive; 회원 B 1개)
2. PM `mapProfileDocument`의 memberId로 PM 클라이언트(`createKioskRecommendationClient`)가 기기 identity로 세션 시작 후 자동 조회
3. 기본 추천 우선
4. 여러 active 추천
5. archived 제외
6. 회원 B로 시작하면 A 세션 403
7. `memberId` 주입 400, 다른 세션 ID 403, 다른 회원 응답은 클라이언트가 거부
8. 그대로 사용: 순서, canonical exerciseId, 세트, 메모 유지
9. `source: recommendation (edited=false)`, `normalizeWorkoutSource` 통과
10. 기존 builder 편집: `edited=true`, 원본 불변
11. 토큰 없음 401, 익명/Trainer 403, 추천 없는 회원은 빈 목록
12. close 후 재사용 403, Firestore 원본 불변, API 주소 검증

인증 우회나 클라이언트의 Firestore 직접 읽기는 없다.

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

### 최종 인증 모델: Trainer → Kiosk handoff (구현됨, Emulator 전용)

결정 이력 (2026-11-16): Trainer 로그인 안 → 철회. 키오스크 세션 + 모델 A → 운영 방식 확정으로 철회. 기기 신뢰(`eef6eeb`) → **최종 요구사항에 따라 Trainer handoff로 교체**.

원칙: Program Manager의 회원 선택은 화면 UX일 뿐, 권한 근거가 아니다. 추천 접근 권한은 서버가 발급한 handoff(기기 identity + 바인딩된 memberId + active 상태)로만 결정한다. 키오스크에는 Trainer 권한, 회원 PIN, 로그인이 없다.

- 저장: `authKioskHandoffs/{handoffId}` = `handoffId, deviceId, memberId, memberProgramId, issuedAt, expiresAt(15분, 최대 30분), status(active|closed|superseded), issuedBy`
- Trainer (Condition Lab):
  - `GET /v1/trainer/kiosk-devices`: 등록되고 철회되지 않은 기기 목록
  - `POST /v1/trainer/kiosk-handoffs { deviceId, memberId, programId }`
  - 서버가 검증하는 것: Trainer claim, 등록·미철회 기기, member profile(명시적인 비회원 role은 거부), 해당 회원 소유의 active program
  - 같은 기기의 기존 active handoff는 `superseded`로 바뀐다(기기당 1개).
- Kiosk (device-only identity: `basecampRole: 'kiosk'` + `deviceId`, session claim 없음):
  - `GET /v1/kiosk/handoff`: 이 기기의 active·미만료 handoff와 그 회원의 active 추천만 반환한다. 기본 추천이 먼저, archived와 다른 회원은 제외된다. query 파라미터는 모두 400이고, 읽은 뒤 handoff를 재확인한다.
  - `POST /v1/kiosk/handoff/close { handoffId }`: 발급받은 기기만 닫을 수 있고, 반복 호출해도 안전하다.
- 제거: device-trust `POST /v1/kiosk/session/start`, session-scoped `GET /v1/kiosk/session/workout-programs`. 추천 읽기 경로는 handoff 하나뿐이다.
- 기존 `createKioskSession`, `resolveKioskMemberScope`, scoped profile/logs, QR, close는 유지한다(`11062af` 상태).
- Condition Lab UI: 추천 프로그램 카드의 [키오스크로 보내기] → 대상 기기 라디오 목록 → [보내기]. 성공 시 유효 시각을, 실패 시 한국어 사유를 표시한다.

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

- 회원 선택 시 `useKioskRecommendation`이 기기 identity로 `GET /v1/kiosk/handoff`를 호출한다. 회원 ID는 보내지 않는다.
  - `handoff.memberId === 선택한 회원`일 때만 `KioskRecommendationCard`를 표시한다. 기본 추천이 먼저 나오고, 다른 추천은 칩으로 고르며, Trainer가 보낸 프로그램에는 "트레이너 전달" 표시가 붙는다.
  - 다른 회원이면 카드를 숨기고, handoff는 닫지 않는다(그 회원을 위해 유지).
- 그대로 사용 / 수정해서 사용(기존 4단계 편집기) / 직접 구성(기존 수동 선택기). 추천은 builder로 복사되고 원본은 불변이다.
- workoutSession `source = { type: "recommendation", memberProgramId, edited, handoffId }`. QR, sessionId, A5는 바꾸지 않았다.
- handoff close: 표시된 handoff는 회원을 바꿀 때, workoutSession을 저장한 직후, 화면을 벗어날 때 닫는다. 만료 시각이 되면 카드를 숨긴다. 이미 닫힌 handoff를 다시 닫아도 안전하다.
- API 주소가 없으면 기능을 끈다. 실패하면 "불러오지 못했습니다" 안내만 표시하고(원시 네트워크 오류는 노출하지 않음) 기존 흐름을 유지한다.
- 키오스크 기기 identity는 별도 Firebase app(local persistence)에 두고, 최초 1회 `globalThis.__kiosk_device_token`으로 등록한다.

## F. 검증 (Emulator)

- Condition Lab `server/http/tests/kioskSessionActivation.emulator.test.js` 4/4
  - Case 1/7/8: 정상 handoff, 최소 필드, 기본 추천 우선, archived 제외
  - Case 3/4: query 조작 400, 다른 기기 조회·close 불가
  - Case 5: Trainer 외 발급 401/403. 철회·미등록 기기, 다른 회원/archived/없는 program, 비회원 profile 거부
  - Case 6: supersede, close 재사용 불가, 반복 close, 만료, 발급 후 archived
- Condition Lab 브라우저 E2E `npm run test:e2e:trainer-programs` 2/2: 기존 Trainer 관리 + 키오스크로 보내기(기기 선택 → 기기 토큰으로 handoff 확인)
- Program Manager `npm run test:member-workout-program:emulator` 12/12: 실제 PM 클라이언트로 Case 1~11
- Program Manager 브라우저 E2E `npm run test:kiosk-recommendation:e2e` 8/8
  - A: 표시
  - B: 회원 변경 시 close
  - C: B 선택 시 숨김, handoff 유지
  - D: 수정 → `edited: true` + handoffId
  - E: 그대로 사용
  - F: 직접 구성
  - G: handoff 없음 / API 중단
  - H: 원본 불변, 운영 호스트 요청 0건

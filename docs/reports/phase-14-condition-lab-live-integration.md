# Phase 14 - Condition Lab Live Integration

## Architecture
Condition Lab
-> ConditionLabProvider
-> Recommendation Context
-> Member Intelligence
-> Rule Recommendation
-> AI Recommendation
-> Snapshot
-> Program Builder
-> Print

이번 Phase에서는 추천 로직을 바꾸지 않고, Quick Print가 사용하는 Provider 계층만 Mock에서 Live Condition Lab 데이터로 교체했다.

## Provider
새 파일
- `src/features/printing/providers/conditionLabProviders.ts`

구현 내용
- `createConditionLabMemberProvider(appId)`
- `createConditionLabWorkoutHistoryProvider(appId)`
- `createConditionLabRecommendationProvider(memberProvider, workoutHistoryProvider)`

기존 인터페이스는 그대로 유지했다.

## Live Data
### Member Live Data
- `profiles` 컬렉션을 직접 읽어 회원 목록을 로드
- 단건 프로필 조회도 동일한 live source 사용
- 이름, 전화번호, memo, status를 기본적으로 사용
- `gender`, `age`, `height`, `weight`, `goal`은 문서에 있으면 읽고, 없으면 안전하게 `undefined`
- 생년월일 문자열이 있으면 age를 계산하고, 없으면 추천은 계속 가능하도록 빈 값 유지

### Workout History Live Data
- 별도 mock JSON 대신 실제 `printHistory` 컬렉션을 live workout history source로 사용
- 최근 회원별 최대 20회 기록을 조회
- `programSnapshot`의 운동/세트 정보를 `WorkoutHistoryRecord`로 변환
- 날짜는 `requestedAt` 또는 `createdAt` 기반으로 안전하게 매핑
- 누락 필드는 기본값으로 보정

## Recommendation Context Live
`QuickPrintPage`에서 mock provider 주입을 제거하고 live provider를 생성해 `QuickPrintFlow`에 전달하도록 변경했다.

- 변경 파일: `src/features/printing/pages/QuickPrintPage.tsx`
- mock import 제거
- `VITE_CONDITION_LAB_APP_ID` 기반 live provider 생성

## Member Intelligence Live
`analyzeMemberIntelligence` 로직은 변경하지 않았다.
입력 데이터만 mock history에서 실제 Condition Lab history로 교체했다.
Firestore 직접 접근은 provider 내부로만 제한했다.

## AI Prompt Live Data
AI prompt 구조와 AI recommendation 로직은 그대로 유지했다.
단, AI에 전달되는 회원/최근운동/운동이력 기반 문맥이 live provider 결과를 사용하도록 바뀌었다.

## Error Handling
- provider 조회 실패 시 예외를 그대로 상위로 전달
- `QuickPrintFlow`의 기존 member loading / intelligence error 상태가 그대로 동작
- 회원 없음, 최근 운동 없음, 운동기록 없음 상황에서도 추천은 중단되지 않도록 `null`/빈 배열 기반 기본값을 유지
- 누락 데이터는 안전한 기본값으로 치환

## Loading
- 회원 목록 로딩: 기존 LoadingState 유지
- 추천 문맥 로딩: Member Intelligence Card의 loading indicator / linear progress 유지
- 추가 skeleton 컴포넌트는 만들지 않았고, 현재 dark theme 로딩 카드 흐름을 재사용했다

## Cache
메모리 캐시 적용
- 회원 목록 캐시
- 회원 프로필 캐시
- 회원 운동기록 캐시
- 동일 조건의 recommendation context 캐시

같은 회원을 다시 선택하거나 같은 조건으로 재조회할 때 불필요한 Firestore 호출을 줄인다.

## Logging
`console.debug` 추가
- provider 호출 시간(ms)
- 조회 성공
- 조회 실패
- 조회 건수

로그 prefix
- `[ConditionLabProvider]`

## Mock Provider 제거
- `src/features/printing/providers/mockProviders.ts` 삭제
- Quick Print flow에서 mock provider 참조 제거

## Performance
- recommendation context 재구성은 provider cache를 우선 사용
- 동일 member/condition 조합 재요청 시 네트워크 재호출 없이 메모리 결과 사용
- 최근 기록 조회는 limit 20으로 제한

## 회귀 테스트
확인 범위
- Member Search 흐름 유지
- Condition 입력 유지
- Rule Recommendation 유지
- AI Recommendation 유지
- Snapshot Builder 유지
- Print Preview / Print Workflow 유지
- Program Repository 변경 없음
- Exercise Catalog / Resolver 변경 없음

## Build 결과
- `npm run build` 성공
- `tsc -b` 포함 성공
- TypeScript Error 0
- Vite chunk size warning만 존재, 실패 아님

## lint
- `package.json` 기준 lint script 없음

## 남은 개선사항
- Condition Lab에 별도 workout logs 컬렉션이 확정되면 `printHistory` 기반 history provider를 해당 source로 바로 교체 가능
- provider failure 메시지를 Step2 UI에서 더 구체적으로 노출하면 운영 디버깅이 쉬워질 수 있음
- live history 문서에 reps/weight/duration 필드가 표준화되면 workout analysis 정밀도를 더 높일 수 있음

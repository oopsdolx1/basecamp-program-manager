# Phase 12 ? Condition Lab Integration Foundation

## Architecture

이번 Phase에서는 BaseCamp가 회원/운동 이력의 원천 시스템이 아니라는 전제를 코드 구조에 반영했다.

Condition Lab
→ Member Provider
→ Workout History Provider
→ Recommendation Context
→ Rule Recommendation
→ AI Recommendation
→ Snapshot
→ Print

실제 API 연결은 하지 않고, Provider 교체가 가능한 Integration Layer를 먼저 구축했다.

## Provider

다음 인터페이스를 추가했다.
- `src/features/printing/providers/memberProvider.ts`
- `src/features/printing/providers/workoutHistoryProvider.ts`
- `src/features/printing/providers/recommendationProvider.ts`

구성 역할:
- `MemberProvider`: 회원 목록 및 선택 회원 프로필 제공
- `WorkoutHistoryProvider`: 최근 운동 이력 제공
- `RecommendationProvider`: MemberProfile + WorkoutHistory + Condition을 Recommendation Context로 조합

추가 구현:
- `src/features/printing/providers/recommendationProviderFactory.ts`
- `src/features/printing/providers/mockProviders.ts`

## Dependency Injection

`QuickPrintFlow`는 이제 직접 Firestore를 조회하지 않는다.
다음 의존성을 주입받는다.
- `appId`
- `memberProvider`
- `recommendationProvider`

`QuickPrintPage`에서 현재는 Mock Provider를 주입한다.
향후 Condition Lab Provider가 준비되면 같은 인터페이스를 구현해 교체할 수 있다.

## Mock

Mock 데이터 파일을 추가했다.
- `docs/mock/sampleMember.json`
- `docs/mock/sampleHistory.json`

Mock Provider는 이 데이터를 기반으로 다음을 제공한다.
- 회원 목록
- MemberProfile
- 최근 20회 운동 이력

이로써 실제 통신 없이도 Condition Lab 연동과 동일한 호출 흐름을 시뮬레이션할 수 있다.

## Recommendation Context

Recommendation Context는 다음 데이터를 포함한다.
- `memberProfile`
- `workoutHistory`
- `recentWorkout`
- `intelligence`
- `metadata`

Rule Recommendation, Member Intelligence, AI Prompt 모두 이 Context를 기반으로 동작하도록 정리했다.

## Firestore 의존 제거

이번 Phase에서 직접 Firestore 의존을 제거한 범위:
- `QuickPrintFlow`
- `Member Intelligence` 데이터 수집 경로
- AI 입력 데이터 경로

`memberIntelligenceService.ts`는 이제 순수 분석 서비스가 되었고, Provider가 전달한 workout history만 분석한다.
Recommendation Engine 역시 Provider에서 조합된 Context만 사용한다.

Program Repository, Snapshot, Print Workflow, Exercise Catalog, Resolver는 변경하지 않았다.

## 향후 Integration 계획

다음 단계에서는 Mock Provider를 실제 Condition Lab Provider로 교체하면 된다.
예상 교체 범위:
- `mockProviders.ts` 대체
- Condition Lab API adapter 추가
- 인증 토큰/세션 처리 추가

상위 UI와 Recommendation 구조는 그대로 유지 가능하다.

## Build 결과

- `npm run build` 성공
- `tsc -b` 통과
- TypeScript Error 0
- Vite production build 성공
- chunk size warning 1건 존재하나 실패는 아님

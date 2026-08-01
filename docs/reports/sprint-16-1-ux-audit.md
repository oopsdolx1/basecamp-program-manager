# Sprint 16-1 UX Audit

작성일: 2026-08-01

## 범위

이번 Sprint에서는 기능 추가, UI 수정, 삭제 없이 현재 구현과 기존 설계의 차이를 점검했다.
분석 기준은 현재 코드와 기존 로컬 설계 보고서(`phase-4`, `phase-7-2`, `phase-9`)이며, 별도의 PDF 원본은 저장소 내에서 확인되지 않았다.

## 1. 현재 Wizard 흐름

현재 실제 진입 경로:

- `/program-manager/print` -> `QuickPrintPage`
- `QuickPrintPage` -> `QuickPrintFlow`
- `/program-manager/quick-print` 는 별도 화면이 아니라 `/program-manager/print` 로 redirect 된다.

현재 `QuickPrintFlow` 기준 실제 흐름:

1. 회원 선택
2. Today's Condition 입력
3. 추천 프로그램 확인
4. Snapshot Program Builder
5. 출력 미리보기
6. 인쇄

코드 근거:

- `src/features/printing/pages/QuickPrintPage.tsx`
- `src/app/AppRouter.tsx`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`

현재 Step label:

- Step1: 회원 선택
- Step2: 오늘의 컨디션
- Step3: 추천 프로그램
- Step4: 운동 수정

따라서 현재 구현에는 Today's Condition Step이 실제로 존재하며, 삭제되지 않았다.

## 2. 회원 선택 검색 UX 문제

### 현재 동작

회원 선택 화면에서는 검색어가 비어 있어도 전체 회원 Card가 표시된다.

코드 경로:

- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`
- `src/features/members/services/memberService.ts`

원인:

`filterMembers()` 내부에 아래 동작이 있다.

- query 정규화 결과가 비어 있으면 `members` 전체를 그대로 반환한다.

즉 현재 구조는:

1. `memberQuery` 기본값은 `""`
2. `filteredMembers = filterMembers(members, memberQuery).slice(0, 40)`
3. 빈 query일 때 `filterMembers()` 가 전체 회원 목록을 반환
4. `QuickPrintFlow` 가 그 결과를 그대로 카드로 렌더링

결론:

- 문제는 렌더링 버그가 아니라 필터 함수의 기본 정책 때문이다.
- 현재 구현은 "검색 전 전체 목록 노출" 정책이다.
- 원래 설계인 "검색 결과만 노출, 검색어 비어 있으면 placeholder만 표시" 정책과 다르다.

### 설계 대비 차이

원래 기대 동작:

- 검색어 없음 -> 회원 Card 표시 안 함
- placeholder 또는 안내 화면만 표시
- 검색어 입력 후 결과만 표시

현재 구현:

- 검색어 없음 -> 최대 40명까지 회원 Card 표시
- 별도 placeholder 없음
- 빈 검색 상태와 검색 결과 상태가 분리되지 않음

## 3. Today's Condition Step 점검

### 존재 여부

존재한다.

현재 `QuickPrintFlow` 는 Step2에서 다음 입력을 직접 렌더링한다.

- condition
- sleep
- fatigueAreas
- stress
- alcohol
- AI 추천 사용 여부
- Member Intelligence card
- Training Trend card

### 삭제 여부

- 삭제되지 않음
- Route만 남은 상태도 아님
- Component만 남고 연결이 끊긴 상태도 아님
- UI만 없고 기본값만 전달되는 구조도 아님

### 연결 상태

Step2 입력값은 `condition` state에 저장되고, 이 값이 `recommendationProvider.getRecommendationContext(selectedMember.memberId, condition)` 로 전달된다.

또한 추천 실행 시에도 아래 값으로 직접 사용된다.

- `recommendProgram(programs, condition, recentWorkout, intelligence, periodization)`
- `requestAiRecommendation({ ..., condition, ... })`
- `savePrintSnapshot({ ..., condition, ... })`

즉 현재 Today's Condition은 실제 추천 컨텍스트와 snapshot 저장에 연결되어 있다.

### 기본값만 전달되는가

아니다.

다만 회원 선택 직후 Step2로 이동하면 초기값은 다음과 같다.

- `condition: null`
- `sleep: null`
- `fatigueAreas: []`
- `stress: 3`
- `alcohol: null`

이 상태에서는 `canRecommend` 가 false 이므로 추천 버튼이 비활성화된다.
조건을 입력해야만 추천이 실행된다.

## 4. Recommendation Flow 실제 코드 기준 문서화

현재 구현 흐름은 아래와 같다.

1. 회원 목록 로드
2. 회원 선택
3. Step2로 자동 이동
4. Today's Condition 입력
5. `recommendationProvider.getRecommendationContext()` 로 운동 이력, 최근 운동, intelligence 조회
6. 추천 버튼 클릭
7. Rule Recommendation 실행
8. 선택된 기존 Program을 Snapshot history로 복사
9. 선택적으로 AI Recommendation 실행
10. Step3에서 추천 결과 표시
11. Step4에서 Snapshot Program Builder 수정
12. `savePrintSnapshot()` 으로 세션 저장
13. Print Preview route 이동
14. Preview에서 print request 생성 후 브라우저 인쇄

현재 코드상 중간의 `???` 는 없다.
실제 흐름은:

회원 선택
↓
Today's Condition
↓
추천 프로그램
↓
Snapshot Program Builder
↓
출력 미리보기
↓
인쇄

## 5. 삭제된 Step / 연결되지 않은 Component 점검

### 삭제된 Step

기존 보고서 기준 비교:

- Phase 4: 회원 선택 -> 카테고리 선택 -> 프로그램 선택 -> 확인/출력
- Phase 7-2: 회원 선택 -> 프로그램 선택 -> 확인/출력
- Phase 9: 회원 선택 -> Today's Condition -> 추천 -> Snapshot 수정 -> 출력
- 현재: 회원 선택 -> Today's Condition -> 추천 -> Snapshot 수정 -> 출력

판단:

- 현재 기준으로 삭제된 것은 Today's Condition Step이 아니라 예전의 "카테고리 선택"과 "수동 프로그램 선택" 단계다.
- Phase 9 이후 의도된 설계와 현재 구현은 큰 흐름이 같다.

### 연결되지 않은 Component

이번 점검 범위 안에서 확인된 disconnected UI component는 없다.

확인 결과:

- `QuickPrintPage` 는 실제 라우트에 연결됨
- `QuickPrintFlow` 는 실제 페이지에서 사용됨
- Today's Condition UI는 실제 Step2에서 렌더링됨
- Print Preview 흐름도 실제 route에 연결됨

다만 아래는 확인되었다.

- `/program-manager/quick-print` 는 독립 화면이 아니라 `/program-manager/print` 로 redirect 되는 legacy route다.
- 즉 route 잔재는 있지만 비정상 상태는 아니다.

## 6. 기존 설계와 현재 구현 비교

| 항목 | 초기 설계 / 기존 보고서 | 현재 구현 | 차이 판단 |
|---|---|---|---|
| 진입 경로 | 초기는 `/program-manager/quick-print`, 이후 Print로 통합 | `/program-manager/print`, legacy quick-print는 redirect | 정상적인 진화 |
| 회원 선택 | 검색 중심 선택 UX | 빈 검색어에서도 전체 회원 카드 노출 | 설계 불일치 |
| 검색어 없음 상태 | placeholder 성격 유지가 의도됨 | 최대 40명 카드 즉시 표시 | 수정 필요 |
| Step 구성 | Phase 9 기준 4단계: 회원 선택 / Today Condition / 추천 / Snapshot | 동일 4단계 유지 | 일치 |
| Today's Condition UI | 존재해야 함 | 실제 존재하고 추천에 연결됨 | 일치 |
| 수동 Program 선택 | Phase 7-2에는 존재 | 현재는 없음 | Phase 9 이후 의도된 제거 |
| 카테고리 선택 | Phase 4에는 존재 | 현재 없음 | 구 설계 대비 제거됨 |
| Recommendation Context | Today Condition 반영 | 실제 반영됨 | 일치 |
| Snapshot 단계 | 추천 후 수정 | 실제 존재 | 일치 |
| Preview/Print | 기존 route 유지 | 실제 유지 | 일치 |

## 7. 수정이 필요한 목록

이번 Sprint에서는 수정하지 않았고, 필요한 항목만 기록한다.

1. 회원 검색 UX 정책 정리 필요
   - 빈 검색어일 때 `filterMembers()` 가 전체 목록을 반환하지 않도록 정책 변경 필요
   - 회원 선택 화면에 placeholder 상태를 분리할 필요가 있음

2. 회원 선택 화면 상태 분기 보강 필요
   - 현재는 "검색 전", "검색 결과 없음", "검색 결과 있음"의 세 상태가 분리되지 않음
   - 원래 설계 기준으로는 검색 전 placeholder가 필요함

3. 설계 기준 문서 최신화 필요
   - 현재 저장소에는 이번 감사에서 직접 대조할 PDF 원본이 없음
   - 실제 기준 문서를 로컬에 추가하거나 최신 설계 보고서 하나로 정리할 필요가 있음

## 8. 결론

현재 Wizard에서 Today's Condition Step은 삭제되지 않았고, 실제 추천 흐름에 정상 연결되어 있다.
현재 UX 상 가장 분명한 불일치는 회원 선택 검색 단계다.

현재 코드 기준 핵심 문제는 다음 하나로 수렴된다.

- 빈 검색어 상태에서 전체 회원 Card가 노출되도록 필터 정책이 구현되어 있어, 원래 의도한 "검색 결과만 표시" UX와 다르다.

그 외 Recommendation -> Snapshot -> Preview 흐름은 현재 구현과 최근 설계(Phase 9 이후) 사이에 큰 불일치가 보이지 않았다.

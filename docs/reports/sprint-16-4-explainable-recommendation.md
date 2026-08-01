# Sprint 16-4 Explainable Recommendation

## Overview

Sprint 16-4B의 목적은 기존 Rule Recommendation 결과를 변경하지 않고, 추천 과정을 구조적으로 기록하고 화면과 AI 설명 경로에 노출하는 Explainable Recommendation을 완성하는 것이다.

## Architecture

Member Intelligence

↓

Periodization

↓

Rule Recommendation

↓

RecommendationTrace

↓

AI Explanation

↓

Snapshot

## RecommendationTrace Schema

실제 구현 타입은 `src/features/printing/types/condition.types.ts`에 추가되었다.

- `RecommendationTraceFactorKey`
- `RecommendationTraceFactor`
- `RecommendationTraceCandidate`
- `RecommendationTraceScore`
- `RecommendationTrace`
- `RecommendationResult.trace`
- `ProgramSnapshotPayload.recommendationTrace?`

Trace는 다음 정보를 포함한다.

- 상위 candidatePrograms 최대 5개
- selectedProgram
- decisionFactors
- scores
- engineVersion
- generatedAt

## Decision Factors

`src/features/printing/services/conditionRecommendationService.ts`에서 기존 점수 계산 중간값을 별도 재계산 없이 동시에 기록한다.

기록 대상은 다음과 같다.

- Today's Condition
- History / RecentWorkout
- Recovery
- Risk
- Program Repeat
- Bias
- Periodization
- Plateau
- Weekly Frequency
- Favorite
- Usage

기존 score weight, 정렬, tie-break는 유지했다.

## Candidate Programs

같은 서비스에서 정렬 완료 후 상위 5개 candidate를 `selected.trace.candidatePrograms`와 `selected.trace.scores`에 저장한다.

선정 기준은 기존과 동일하다.

- score 내림차순
- 동점 시 `updatedAt` 최신 우선

## UI

`src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`

Step3에 `RecommendationTraceCard`를 추가했다.

포함 내용

- 최종 추천 Program
- Final Score
- 선택 기준
- 긍정 요인 목록
- 감점 요인 목록
- 후보 프로그램 보기 / 숨기기
- Selected 표시
- trace 없음 상태에서 안전한 fallback 카드

Candidate 영역은 기본 접힘이며 버튼으로만 펼친다.

## AI Integration

`src/features/printing/prompts/recommendationPrompt.ts`

AI prompt에 다음 trace 정보를 추가했다.

- selectedProgram
- finalScore
- decisionFactors
- candidatePrograms
- engineVersion

`src/features/printing/prompts/systemPrompt.ts`에는 다음 원칙을 유지 및 명시했다.

- Rule recommendation is the final decision.
- AI must not replace or override the selected program.
- AI may only explain the recommendation and adjust the editable snapshot within existing constraints.
- Trace와 rule context에 없는 근거를 확정적으로 말하지 않도록 제약 추가

## Snapshot

`src/features/printing/services/printSnapshotSession.ts`

- snapshot 저장 시 `recommendationTrace` 저장
- 복원 시 `recommendationTrace ?? null`로 정규화

`ProgramSnapshotPayload.recommendationTrace`는 optional-compatible하게 선언하여 과거 snapshot에도 복원 실패가 발생하지 않도록 했다.

## Debug

`src/features/printing/services/conditionRecommendationService.ts`

Development mode에서만 다음 내용을 출력한다.

- selected program
- engine version
- candidate score table
- decision factor table

출력 방식

- `console.group`
- `console.log`
- `console.table`
- `console.groupEnd`

Production UI에는 별도 debug 요소를 추가하지 않았다.

## Regression Verification

추천 로직 회귀는 코드 기준으로 다음을 확인했다.

- 기존 score weight 변경 없음
- 기존 factor 계산 분기 유지
- 기존 candidate 정렬 유지
- tie-break 유지 (`updatedAt`)
- selected program 결정은 여전히 정렬 결과 1위 사용

Trace는 계산 기록과 표시 용도로만 추가되었고 선택 로직 자체를 변경하지 않았다.

## Build

실행 일자: 2026-08-01

실행 결과

- `npm run build` 성공
- `tsc -b` 성공
- TypeScript Error 0

참고

- Vite large chunk warning은 유지되었으나 이번 Sprint 실패 조건은 아님

## Remaining Issues

- 없음

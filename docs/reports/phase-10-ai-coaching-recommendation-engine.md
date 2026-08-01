# Phase 10 ? AI Coaching & Recommendation Engine

## 구현 목적

기존 BaseCamp 출력 흐름의 Rule Recommendation 위에 AI Recommendation Layer를 추가했다.
이번 Phase의 목적은 기존 Program Repository를 유지한 상태에서, AI가 추천 이유를 설명하고 운동 강도와 순서를 조정하며 회원 안내 문구를 생성하되, 실제 수정은 Snapshot에만 반영되도록 만드는 것이다.

## Prompt 구조

다음 파일로 Prompt를 분리했다.
- `src/features/printing/prompts/systemPrompt.ts`
- `src/features/printing/prompts/recommendationPrompt.ts`

구성 원칙:
- JSON only 응답 강제
- 새 Program 생성 금지
- Repository / Catalog 수정 금지
- Snapshot 조정만 허용
- 보수적인 강도 조정 우선

## AI Service

`src/features/printing/services/aiRecommendationService.ts`

역할:
- Prompt 조합
- AI 호출
- JSON Parsing
- 유효성 보정
- Snapshot-only 변경 적용

현재 구현은 `VITE_GEMINI_API_KEY`가 있으면 Gemini API를 호출하고, 없으면 AI Recommendation을 생략한다.
`VITE_GEMINI_MODEL`은 기본값 `gemini-2.0-flash`를 사용한다.

## Parsing

AI 응답은 JSON만 허용한다.
파싱 대상 필드:
- `reason`
- `coach`
- `warning`
- `changes[]`

`changes[]`는 다음 필드를 허용한다.
- `exercise`
- `sets`
- `reps`
- `memo`
- `order`

Parsing 실패 또는 schema mismatch 시 예외 처리 후 Rule Recommendation 그대로 유지한다.

## Fallback

다음 경우 모두 Rule Recommendation 유지로 fallback한다.
- AI 토글 OFF
- API Key 없음
- 네트워크/API 오류
- 빈 응답
- JSON Parsing 실패
- JSON schema mismatch

이 경우 Program Repository는 변경되지 않고, Rule 기반 Snapshot만 출력 단계로 이어진다.

## Snapshot 반영 방식

AI는 Snapshot에만 반영된다.
허용한 반영 범위:
- 세트 수 조정
- 메모 추가
- 반복수 제안 문자열을 메모에 병합
- 운동 순서 재정렬

금지 사항은 유지했다.
- Program Repository 수정 없음
- Exercise Catalog 수정 없음
- Firestore 구조 변경 없음

## UI

Quick Print Flow에 `AI 추천 사용` 토글을 추가했다.

AI 사용 시 다음 UI가 표시된다.
- `AI Applied` / `AI Snapshot` Badge
- 추천 이유 Card
- 회원 코칭 Card
- 주의사항 Card

AI 실패 시에는 경고 메시지를 띄우고 Rule Recommendation 유지 상태를 명시한다.

## 회귀 테스트

설계상 다음 영역은 유지했다.
- Program CRUD
- Exercise Catalog
- Exercise Resolver
- Print Preview
- Print History
- Archive / Restore
- Snapshot 기반 출력
- Authentication

실제 변경 범위는 Printing feature 내부의 Prompt / Service / Snapshot / QuickPrintFlow에 한정했다.

## Build 결과

- `npm run build` 성공
- Vite production build 성공
- chunk size warning 1건 존재하나 실패는 아님

## TypeScript 결과

- `tsc -b` 통과
- TypeScript Error 0

## 남은 개선사항

- 운영 환경에서 실제 AI provider 인증 전략을 서버 경유 방식으로 전환하면 보안성이 더 좋아진다.
- 현재 회원 성별/연령 데이터는 UI 타입에 노출되지 않아 `unknown`으로 prompt에 전달한다. 향후 profile read model 확장 시 AI 품질을 더 높일 수 있다.
- `reps`는 현재 Snapshot 메모에 병합하는 방식으로 표현한다. 향후 출력 템플릿이 반복수 필드를 지원하면 구조화된 반영이 가능하다.

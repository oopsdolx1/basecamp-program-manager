# Phase 11 ? Member Intelligence Engine

## Architecture

이번 Phase에서는 추천 이전 단계에 `Member Intelligence Engine`을 추가했다.
흐름은 다음과 같다.

Member
→ Workout History
→ Member Intelligence Engine
→ Rule Recommendation
→ AI Recommendation
→ Snapshot
→ Print

AI는 분석 결과를 설명하는 역할만 수행하고, 추천 결정은 Rule Engine이 수행한다.

## Recovery 계산

`src/features/printing/services/memberIntelligenceService.ts`

Recovery Score는 0~100 범위의 Rule 기반 점수로 계산한다.
반영 요소:
- 최근 운동 시점
- 최근 7일 빈도
- 운동 공백 일수
- Program 반복 횟수
- 오늘 컨디션
- 수면
- 스트레스
- 피로 부위 수
- 음주 여부

대표 규칙:
- 최근 운동이 아주 가까우면 감점
- 운동 공백이 길면 일부 가점
- 최근 7일 빈도가 높으면 감점
- 수면 부족, 스트레스 높음, 피로 부위 선택, 음주 여부는 감점
- 컨디션 좋음은 가점

## Risk 계산

Risk Score는 0~100 범위이며, 높을수록 위험 신호가 크다.
반영 요소:
- 최근 동일 Program 반복 횟수
- 운동 부위 편중 비율
- 운동 공백 일수
- 최근 7일 과빈도

대표 규칙:
- 동일 Program 연속 반복이 많을수록 위험 증가
- 특정 부위 편중 비율이 높을수록 위험 증가
- 14일 이상 공백, 30일 이상 공백은 추가 위험으로 반영

## Bias 계산

최근 최대 20회 운동을 기준으로 Category별 빈도를 계산한다.
`bodyPartBias`는 각 Category의 count와 ratio를 저장하며, UI에는 상위 편중 부위를 퍼센트로 표시한다.

## Frequency / Volume 분석

분석 항목:
- 최근 운동 시점
- 최근 7일 운동 횟수
- 최근 30일 운동 횟수
- 운동 공백 일수
- 최근 동일 Program 반복 횟수
- 최근 10회 Program 다양성
- 최근 10회 Category 다양성
- 누적 totalSets
- 누적 totalExercises

logs 데이터가 없거나 부족하면 기존 Print History를 fallback 데이터로 사용한다.

## Rule 변경

Rule Recommendation은 이제 Member Intelligence 결과를 입력으로 사용한다.

추가 반영 규칙:
- Recovery Score < 40: Recovery 우선, 고강도 감점
- Risk Score > 70: 편중된 동일 부위 Program 감점
- Program Repeat > 3: 다른 Program 우선
- Body Bias 비율이 높을 때 같은 부위 Program 감점
- 긴 운동 공백이 있으면 재적응 방향으로 조정

Program Repository는 여전히 읽기 전용이며, 추천은 기존 Program만 선택한다.

## Metadata

Snapshot 세션 저장소에 다음 메타데이터를 추가 저장한다.
- `recoveryScore`
- `riskScore`
- `bodyBias`
- `frequency7`
- `frequency30`
- `recommendationVersion: "3"`

또한 전체 Member Intelligence summary를 Snapshot payload에 함께 저장해 이후 출력/설명 흐름에서 활용 가능하도록 했다.

## UI

Quick Print Flow에 `Member Intelligence Card`를 추가했다.
표시 항목:
- Recovery Score
- Risk Score
- 최근 운동
- 최근 7일 빈도
- 최근 30일 빈도
- 운동 공백
- Program 반복
- 다양성
- 운동 편중

색상 규칙:
- Recovery: 높을수록 Green 계열
- Risk: 높을수록 Orange / Error 계열

Step2, Step3, Step4 모두에서 동일 카드를 확인할 수 있도록 배치했다.

## 회귀 테스트

유지한 사항:
- Firestore Collection 구조 변경 없음
- Program Repository 변경 없음
- Exercise Catalog 변경 없음
- Exercise Resolver 변경 없음
- Snapshot 기반 수정 유지
- Print Workflow 유지
- Print History 유지
- Authentication 변경 없음

변경 범위는 Printing feature 내부의 분석 서비스, 추천 서비스, AI prompt/service, Snapshot session, QuickPrintFlow에 한정했다.

## Build 결과

- `npm run build` 성공
- `tsc -b` 통과
- TypeScript Error 0
- Vite build 성공
- chunk size warning 1건 존재하나 실패는 아님

## 남은 개선사항

- 현재 logs 문서 스키마는 운영 환경마다 차이가 있을 수 있어, 실제 로그 필드명이 확정되면 분석 정확도를 더 높일 수 있다.
- 완료 여부와 sets 정보가 logs에 더 충실하게 들어오면 Volume / Risk 계산 정밀도가 개선된다.
- Snapshot metadata를 향후 print request payload metadata와 연결하면 히스토리 기반 분석 추적성이 더 좋아질 수 있다.

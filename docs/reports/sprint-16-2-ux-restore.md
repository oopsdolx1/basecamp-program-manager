# Sprint 16-2 UX Restore

작성일: 2026-08-01

## 변경 범위

이번 작업은 기능 추가 없이 `QuickPrintFlow`의 UI/UX 복원 범위만 조정했다.
Recommendation 로직, Provider, Repository, Program 선택 규칙은 변경하지 않았다.

## 검색 UX 변경

적용 내용:

- 빈 검색어 상태에서는 회원 카드가 표시되지 않도록 변경
- 대신 placeholder 상태를 표시하도록 변경
- 검색어가 입력된 경우에만 검색 결과 카드가 렌더링되도록 변경

구현 방식:

- `hasSearchQuery` 상태 파생값 추가
- `filteredMembers`를 빈 검색어일 때 빈 배열로 제한
- Step1에서 `검색 전 / 검색 결과 없음 / 검색 결과 있음` 상태를 분기 렌더링

## Step Header 수정

적용 내용:

- Step label을 실제 wizard 기준에 맞게 정리
- `오늘의 컨디션` 헤더를 `Today's Condition`으로 정렬
- `운동 수정` 헤더를 `Snapshot 수정`으로 정렬

현재 Step label:

1. 회원 선택
2. Today's Condition
3. 추천 프로그램
4. Snapshot 수정

## Progress Indicator 변경

적용 내용:

- 현재 단계 수를 텍스트로 표시
- active / complete / pending 상태가 더 명확하게 보이도록 카드형 indicator로 변경
- 완료 단계에는 체크 표시를 사용

## Layout 변경

적용 내용:

- 회원 선택 화면에서 검색 전 placeholder 상태 복원
- Step header와 wizard indicator의 용어 정합성 개선

이번 변경에서 유지한 것:

- Member Intelligence 카드 기능
- Training Trend 카드 기능
- AI Recommendation 기능
- Snapshot Builder 기능
- Recommendation scoring

## PDF 비교

복원 방향:

- 검색 전 전체 카드 노출 제거
- 실제 step 명칭과 상단 indicator 용어 정렬
- 현재 단계 인지성 강화

이번 반영에서 직접 수정하지 않은 영역:

- 추천 프로그램 화면 카드 순서의 추가 재배치
- Snapshot Builder 상단/하단 액션 레이아웃의 대규모 재구성

## Build 결과

- `npm run build` 성공
- `tsc -b` 포함 성공
- TypeScript Error 0

## 메모

이번 작업은 빌드 안정성을 우선해 검색 UX, step header, progress indicator 복원에 집중했다.

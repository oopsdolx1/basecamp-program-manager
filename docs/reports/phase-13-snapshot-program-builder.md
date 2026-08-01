# Phase 13 - Snapshot Program Builder

## 변경 목적
Phase 13의 목적은 추천 완료 이후 Program Repository를 다시 계산하거나 수정하지 않고, Snapshot만 빠르게 편집해서 Print Preview와 출력으로 연결하는 Program Builder를 구축하는 것이다.

## Architecture
Recommendation
-> Snapshot 생성
-> Snapshot Program Builder
-> Print Preview
-> Print

Repository, Firestore, Provider, Recommendation Engine은 그대로 유지하고 Step4 편집 레이어만 Snapshot 기반으로 확장했다.

## 구현 내용
- `src/features/printing/services/snapshotBuilderService.ts`
  Snapshot 편집 전용 서비스 추가 및 정리
  Undo/Redo 히스토리 10단계
  move up/down, duplicate, delete, add blank, replace/patch, preset, global action 지원
- `src/features/printing/components/SnapshotExerciseBuilderRow/SnapshotExerciseBuilderRow.tsx`
  운동 단위 카드 편집 UI 유지
  Replace, 세트/횟수/무게/휴식/메모 수정, preset 버튼 제공
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`
  Step4를 Snapshot Program Builder로 전환
  추천 결과를 builder history로 초기화
  recommendation 재실행 없이 snapshot만 수정
  Undo/Redo 버튼 및 `Ctrl+Z`, `Ctrl+Y` 연결
  Global Actions와 실시간 Print Preview 연결

## Builder
Builder는 `SnapshotBuilderHistory`의 `past/present/future` 구조를 사용한다.
`present`만 UI에 바인딩하고, 출력 직전 `ProgramFormValues`로 변환하여 기존 Print Workflow에 전달한다.
원본 Program은 수정하지 않는다.

## Undo / Redo
- 메모리 전용 히스토리
- 최근 10단계 유지
- 버튼 지원
- 키보드 단축키 지원: `Ctrl+Z`, `Ctrl+Y`

## Replace
Exercise Catalog autocomplete를 유지하면서 동일 위치에서 운동 교체가 가능하도록 구성했다.
Repository 수정은 없고 snapshot exercise만 변경된다.

## Quick Presets
지원 preset
- `+1 Set`
- `-1 Set`
- `8~10회`
- `10~12회`
- `12~15회`
- `15~20회`
- `Failure`
- `Drop Set`
- `Super Set`
- `Tempo`
- `Rest Pause`

Preset 적용 시 snapshot exercise의 세트/반복/메모만 갱신된다.

## Global Actions
- 전체 세트 +1
- 전체 세트 -1
- 휴식 +30초
- 휴식 -30초
- 전체 메모 삭제
- 추천 상태로 복원

## Performance
- builder 상태에서 `useMemo`로 snapshot form values 및 validation 계산
- exercise card는 `React.memo` 기반 `SnapshotExerciseBuilderRow` 사용
- Step4는 snapshot history의 `present`만 구독하여 불필요한 재추천을 방지

## Snapshot 구조
Snapshot 편집 데이터는 메모리에서 `SnapshotBuilderHistory`로 유지된다.
Print Preview 저장 시에만 `ProgramFormValues`로 변환하여 기존 snapshot session payload에 전달한다.
Firestore 저장 구조 변경은 없다.

## 회귀 테스트
수동 확인 범위
- Member Search 흐름 유지
- Condition 입력 -> Rule Recommendation 유지
- AI Recommendation 사용 시 snapshot만 수정
- Step4에서 move/duplicate/delete/preset/global action 적용
- Print Preview 저장 경로 유지

## Build 결과
- `npm run build` 성공
- Vite production build 성공
- chunk size warning만 존재, 실패 아님

## TypeScript 결과
- TypeScript Error 0

## lint
- `package.json` 기준 lint script 없음

## 남은 개선사항
- Exercise Replace를 `snapshotBuilderService.replaceExercise`로 직접 연결하면 service 책임이 더 명확해질 수 있음
- reps/weight/rest 표현을 향후 별도 snapshot field 저장 포맷으로 분리하면 print payload 변환이 더 단순해질 수 있음
- 대형 번들 경고 해소를 위한 code splitting 검토 가능

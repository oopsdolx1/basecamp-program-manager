# Phase 8 — Exercise Catalog Management Suite

## 변경 목적

Exercise Catalog를 단순 목록/Seed 화면에서 운영 가능한 관리 화면으로 확장했다. 새로운 운동 시스템을 만들지 않고, 기존 Exercise Catalog 데이터의 품질 관리, 검색, 편집, Resolver 테스트, Import/Export를 한 화면에서 수행할 수 있도록 개선했다.

변경하지 않은 항목:

- Program Repository
- Print Workflow
- Print Request
- Firestore Collection 구조
- Exercise Resolver 알고리즘
- OCR Pipeline
- A5 Print Template
- Firebase 인증 구조

## 변경 파일

- `src/features/exercise-catalog/components/ExerciseCatalogDashboard.tsx`
- `src/features/exercise-catalog/components/ExerciseCatalogEditorDialog.tsx`
- `src/features/exercise-catalog/components/ExerciseCatalogFilters.tsx`
- `src/features/exercise-catalog/components/ExerciseCatalogImportExport.tsx`
- `src/features/exercise-catalog/components/ExerciseCatalogList.tsx`
- `src/features/exercise-catalog/components/ExerciseCatalogStatistics.tsx`
- `src/features/exercise-catalog/components/ExerciseResolverTestPanel.tsx`
- `src/features/exercise-catalog/domain/exerciseCatalog.types.ts`
- `src/features/exercise-catalog/hooks/useExerciseCatalog.ts`
- `src/features/exercise-catalog/pages/ExerciseCatalogPage.tsx`
- `src/features/exercise-catalog/services/exerciseCatalogService.ts`
- `docs/reports/phase-8-exercise-catalog-management-suite.md`

## Dashboard

Exercise Catalog 상단에 Dashboard 카드를 추가했다.

표시 항목:

- 전체 운동 수
- 활성 운동 수
- Archive 운동 수
- Alias가 없는 운동 수
- English Name 없는 운동 수
- Memo 없는 운동 수
- Category 누락 수
- Primary Muscle 누락 수

숫자는 현재 Firestore 구독 데이터인 `items`를 기준으로 렌더 직전에 계산한다.

## Filter

검색/필터를 조합 가능하도록 확장했다.

검색 대상:

- name
- displayName 성격의 표시명
- englishName
- aliases

필터:

- Category
- Primary Muscle
- Equipment
- 상태: Active / Archived / All
- 품질: Alias 없음 / English Name 없음 / Memo 없음

기존 `includeArchived` boolean 대신 Catalog 화면에 맞는 `status` 필터를 사용한다.

## Editor

운동 등록/수정 Dialog를 추가했다.

필드:

- 한글명
- Display Name
- 영문명
- Category
- Primary Muscle
- Equipment
- Memo
- Active 여부 표시
- Alias

Firestore 구조 변경을 피하기 위해 Display Name은 별도 저장 필드로 만들지 않고, 현재 표준 한글명을 표시하는 읽기 전용 값으로 처리했다.

## Alias 관리

Alias는 Chip Editor 방식으로 구현했다.

- Enter 입력으로 Chip 생성
- 추가 버튼으로 Chip 생성
- Chip 삭제 가능
- 공백 Alias 저장 금지
- 중복 Alias 자동 제거
- Import 시에도 Alias 정규화 적용

## 품질 검사

저장 전 자동 검사를 추가했다.

Error:

- 동일 name 존재
- Alias 충돌
- 필수 선택값 누락

Warning:

- Alias 없음
- English Name 없음
- Memo 없음
- 동일 englishName 존재

Warning은 저장 가능하고, Error는 저장 불가하다.

## Resolver Panel

Catalog 화면에 Resolver Test Panel을 추가했다.

- 텍스트 입력
- Enter 또는 버튼으로 Resolver 실행
- Resolved / Ambiguous / Unknown 표시
- confidence 표시
- match reason 표시
- matched alias 표시
- 후보 운동 목록 표시

기존 Resolver 알고리즘은 수정하지 않았고 `resolveExercise` 호출만 사용했다.

## Statistics

Statistics 영역을 추가했다.

새 Chart 라이브러리는 설치하지 않고 MUI 기반 비율 바 형태로 표시했다.

표시 항목:

- Category 분포
- Equipment 분포
- Alias 보유율
- English Name 보유율
- Archive 비율

## Import / Export

JSON Export:

- 현재 Exercise Catalog 전체를 JSON 파일로 다운로드한다.

JSON Import:

- 기존 Catalog Merge 방식
- 옵션:
  - Skip Existing
  - Overwrite

Import 보고서:

- 생성 수
- 덮어쓰기 수
- 건너뜀 수
- ID 충돌 수
- name 충돌 수
- alias 충돌 수

Repository 구조와 Firestore Collection 구조는 변경하지 않았다. Import ID는 충돌 보고용으로만 사용하며, 새 문서 생성 시 기존 create 흐름을 사용한다.

## 회귀 테스트

코드 기준 확인:

- Program Editor Autocomplete는 기존 `useExerciseCatalog`와 catalog option 흐름 유지
- Program 저장/수정 Repository 미변경
- Print Workflow 파일 미변경
- Print Preview 미변경
- Print History 미변경
- Archive/Restore는 Exercise Catalog Repository 기존 메서드 사용
- Resolver 알고리즘 미변경
- Dashboard 구현 확인
- Statistics 구현 확인
- Import/Export 구현 확인

## Build 결과

성공.

```text
npm run build
✓ 1075 modules transformed.
✓ built in 4.29s
```

Vite chunk size warning은 남아 있으나 빌드 실패가 아니다.

## TypeScript 결과

성공.

- `tsc -b` 통과
- TypeScript Error 0

## lint 결과

`package.json`에 lint script가 없어 실행하지 않았다.

## 남은 개선사항

- 실제 운영 Firestore 데이터로 Import/Overwrite acceptance를 수동 확인할 필요가 있다.
- 실제 브라우저에서 Escape Dialog 종료, Tab focus loop, Enter alias 입력을 수동 확인하면 좋다.
- 향후 필요 시 Statistics를 별도 route/tab으로 분리할 수 있다.
- Display Name을 별도 저장 필드로 승격할지는 Firestore 구조 변경 승인이 있을 때만 결정하는 것이 좋다.

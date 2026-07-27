# Phase 7-3 — Print Workflow Data & Category UX Enhancement

## 변경 목적

Phase 7-2에서 정리한 Print 3-step wizard를 유지하면서, 실제 사용 중 선택 정확도와 시각적 인지성을 높이는 작업을 진행했다.

- 회원 검색 결과 필터링 보강
- Program Editor와 Firestore Exercise Catalog 연동 UX 보강
- Print Step 2 카테고리 선택 UI를 이미지형 카드로 개선
- 기존 도메인, Repository, Print Request, Firestore 경로, A5 출력 템플릿은 변경하지 않음

## 변경 파일

- `src/features/members/services/memberService.ts`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`
- `src/features/programs/components/ExerciseSortableRow/ExerciseSortableRow.tsx`
- `src/features/programs/components/ProgramEditor/ProgramEditor.tsx`
- `src/features/programs/components/ProgramList/ProgramList.tsx`
- `src/features/programs/config/programOptions.ts`
- `src/features/exercise-catalog/constants/exerciseCatalogOptions.ts`
- `src/features/exercise-catalog/pages/ExerciseCatalogPage.tsx`
- `docs/reports/phase-7-3-print-data-category-ux-enhancement.md`

## 회원 검색 필터 구현 방식

- 검색 결과는 별도 state로 저장하지 않고 렌더 직전 `useMemo`에서 계산한다.
- 검색어가 비어 있으면 기존 목록을 그대로 표시한다.
- 검색어가 있으면 이름, 기존 searchText, 전화번호 숫자만 비교한 값 중 하나라도 일치하는 회원만 표시한다.
- 회원 이름은 trim, 공백 정규화, `ko-KR` lowercase 기준으로 비교한다.
- 검색 결과가 없으면 Empty State를 표시한다.

## Exercise Catalog 연동 구조

- Program Editor는 기존 `useExerciseCatalog(appId)`를 통해 Firestore `exerciseCatalog` 데이터를 구독한다.
- Program Repository와 Exercise Catalog Repository는 계속 분리되어 있다.
- Program 저장 경로와 Exercise Catalog 저장 경로는 변경하지 않았다.
- Program Exercise Autocomplete 후보는 archive 제외 catalog option을 사용한다.
- 후보 검색 대상은 다음으로 보강했다.
  - name
  - displayName
  - englishName
  - aliases

## freeSolo 및 하위 호환성 보존 방식

- Autocomplete는 `freeSolo`를 유지했다.
- 카탈로그 항목을 선택하면 기존 Program Exercise 필드에 맞춰 저장한다.
  - `catalogExerciseId`
  - `displayName`
  - `name`
- 직접 입력하면 `catalogExerciseId`를 비우고 기존 문자열 운동명으로 저장한다.
- 과거 Program 데이터에 `catalogExerciseId`가 없어도 기존 운동명이 정상 표시된다.
- Resolver는 기존 상태와 계산 방식을 유지했다.
  - resolved
  - ambiguous
  - unknown

## 카테고리 이미지 자산 구조

- 외부 이미지 URL이나 사진 자산을 추가하지 않았다.
- Print Step 2 내부에서 일관된 SVG 기반 추상 운동 아이콘을 렌더링한다.
- 카테고리별 presentation 설정 객체를 사용해 조건문 반복을 피했다.
- 카드별 정보는 다음 형태로 분리했다.
  - value
  - label
  - description
  - accent color
  - SVG path list

## 접근성 처리

- 카테고리 카드는 `CardActionArea` button semantics를 사용한다.
- 선택 상태는 `aria-pressed`로 표시한다.
- 선택된 카드는 gold border, glow, check icon으로 구분된다.
- hover와 focus-visible 상태를 분리해 키보드 접근성을 유지했다.
- 회원/프로그램 선택 카드의 aria-label도 유지했다.

## 회귀 방지 확인

- 회원 선택 후 Step 2 자동 이동 흐름 유지
- 회원 변경 시 Step 1 복귀 및 selectedProgram 초기화 유지
- Category 변경 시 현재 선택된 Program이 새 category와 맞지 않으면 selectedProgram 초기화
- Program 선택 후 Step 3 이동 유지
- Program 수정 버튼은 Step 2로 돌아가며 선택 상태 유지
- Step 3 출력 버튼은 기존 Print Preview route로 이동
- Print Request 저장, usageCount, lastUsedAt, A5 Preview 로직 미변경
- Master > Programs, Master > Print History 구조 미변경
- Exercise Catalog 관리 화면 route 미변경
- 기존 사용자 노출 `Quick Print` 문구 없음 확인

## 빌드 결과

성공.

```text
npm run build
✓ 1068 modules transformed.
✓ built in 4.59s
```

Vite chunk size warning은 남아 있으나 빌드 실패가 아니다.

## TypeScript 결과

성공.

- `tsc -b` 통과
- TypeScript error 0

## lint 결과

`package.json`에 lint script가 없어 실행하지 않았다.

## 수동 acceptance 미수행 항목

- 실제 브라우저에서 회원명 예시 입력 후 DOM 클릭 검증
- 실제 Firestore catalog 데이터가 있는 환경에서 Autocomplete 후보 표시 육안 검증
- 실제 인쇄창 및 프린터 출력 검증
- 모바일/태블릿 실제 기기 확인

## 남은 이슈

- production build에서 큰 JS chunk warning이 남아 있다.
- Firestore index 관련 미해결 사항은 기존 Phase 5-1 범위 그대로 유지했다.
- 실제 운영 데이터 기준 카테고리별 카드 이미지 선호도는 현장 피드백 후 조정 가능하다.

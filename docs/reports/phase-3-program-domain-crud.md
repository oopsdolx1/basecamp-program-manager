# BaseCamp Program Manager Phase 3 Report

작성일: 2026-07-27

## 1. 생성 파일

- `src/features/programs/config/programOptions.ts`
- `src/features/programs/types/programViewModel.types.ts`
- `src/features/programs/mappers/programMapper.ts`
- `src/features/programs/repositories/programRepository.ts`
- `src/features/programs/services/programService.ts`
- `src/features/programs/hooks/usePrograms.ts`
- `src/features/programs/hooks/useProgramForm.ts`
- `src/features/programs/components/ProgramFilters/ProgramFilters.tsx`
- `src/features/programs/components/ProgramCard/ProgramCard.tsx`
- `src/features/programs/components/ProgramList/ProgramList.tsx`
- `src/features/programs/components/ExerciseSortableRow/ExerciseSortableRow.tsx`
- `src/features/programs/components/ProgramEditor/ProgramEditor.tsx`
- `src/features/programs/pages/ProgramListPage.tsx`
- `src/features/programs/pages/ProgramEditorPage.tsx`
- `docs/reports/phase-3-program-domain-crud.md`

## 2. 수정 파일

- `package.json`
- `package-lock.json`
- `src/app/routes.ts`
- `src/app/routeBuilder.ts`
- `src/app/AppRouter.tsx`
- `src/features/members/components/MemberSelector/MemberSelector.tsx`
- `src/features/members/components/SelectedMemberCard/SelectedMemberCard.tsx`
- `src/features/programs/index.ts`
- `src/features/programs/repositories/programRepository.types.ts`
- `src/features/programs/types/program.types.ts`
- `src/types/brandedIds.ts`

## 3. 설치 패키지

Drag & Drop 구현을 위해 설치 전 보고 후 다음 패키지를 추가했다.

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

기존 npm audit 경고는 유지된다.

- moderate: 12
- high: 2

자동 `npm audit fix`는 Phase 3 범위를 넘는 의존성 변경 가능성이 있어 실행하지 않았다.

## 4. Program CRUD 결과

구현 완료:

- 목록 실시간 구독: `subscribePrograms`
- 단건 조회: `getProgram`
- 생성: `createProgram`
- 수정: `updateProgram`
- 복사: `duplicateProgram`
- Archive: `archiveProgram`
- Restore: `restoreProgram`

삭제는 구현하지 않았다. `deleteDoc()` 사용도 없다.

Firestore 경로:

`artifacts/{appId}/public/data/programs`

실제 Firestore CRUD 동작은 `.env.local`이 없는 현재 환경에서는 실행 검증하지 못했다.

## 5. Repository

Repository는 Firestore I/O만 담당한다.

- `collection`
- `doc`
- `getDocs`
- `getDoc`
- `onSnapshot`
- `setDoc`
- `updateDoc`
- `serverTimestamp`

비즈니스 규칙은 Repository에 넣지 않았다.

## 6. Service

Service에 구현한 규칙:

- 프로그램 validation
- 운동 최소 1개, 최대 8개 제한
- 운동 순서 재정렬
- 운동명 trim
- 복사 제목 생성
- 프로그램 검색 및 필터링
- 프로그램 정렬
- form sanitize

복사 제목 규칙:

- `가슴1`
- `가슴1 (복사)`
- `가슴1 (복사2)`
- `가슴1 (복사3)`

## 7. Drag 동작

운동 행 순서는 `@dnd-kit` 기반으로 구현했다.

- Drag Handle 제공
- 버튼 기반 위/아래 이동 없음
- Drag 종료 후 `order`를 1부터 자동 재정렬

## 8. Autocomplete 동작

운동명 입력은 `TextField` 단독이 아니라 MUI `Autocomplete` 기반으로 구현했다.

- 현재는 `freeSolo`
- 직접 입력 가능
- options는 빈 배열
- 향후 Exercise Catalog는 options/provider만 교체하도록 설계

## 9. Archive 동작

Archive는 소프트 삭제로 구현했다.

- `isArchived: true`
- 기본 목록에서는 제외
- `Archive 보기` 필터 ON 시 표시
- Restore 지원

## 10. Build 결과

`npm run build` 성공.

첫 실행은 sandbox 권한에서 Vite 내부 실행 파일이 차단되어 실패했고, 승인된 권한으로 재실행하여 성공했다.

빌드 경고:

- bundle chunk가 500 kB를 초과

원인 후보:

- MUI
- Firebase
- dnd-kit

Phase 4 이후 route lazy loading 또는 manual chunk 분리를 검토할 수 있다.

## 11. 미해결 문제

- 실제 `.env.local`이 없어 Firestore CRUD 실동작은 검증하지 못했다.
- Firebase Security Rules는 수정하지 않았다.
- npm audit 경고가 남아 있다.
- 브라우저 기반 Drag & Drop 시각 검증은 아직 수행하지 못했다.
- Program 사용횟수 증가 Firestore 구현은 금지 범위라 구현하지 않았다.

## 12. Phase 4 권장 사항

1. 실제 Firebase 환경변수를 구성하고 `programs` CRUD 권한을 확인한다.
2. Program Editor의 브라우저 시각 QA를 진행한다.
3. Route lazy loading으로 bundle 경고를 줄인다.
4. Exercise Catalog 연결용 provider interface를 구체화한다.
5. 출력으로 넘어가기 전 Program 선택 UX와 회원 선택 상태 전달 범위를 확정한다.

## Stop Condition

Program Domain, Repository, Service, CRUD UI, List, Editor 구현을 완료했다.

Print, Print CSS, `window.print`, `printHistory`, AI, 회원 쓰기 기능으로 넘어가지 않았다.

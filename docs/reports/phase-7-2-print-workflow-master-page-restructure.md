# Phase 7-2 — Quick Print Multi-Step Workflow & Master Page Restructure

## 1. Existing Navigation Analysis

- 기존 상단 메뉴는 Quick Print, Programs, Print History, Exercise Catalog처럼 작업 단위가 나뉘어 있었다.
- 실제 운영 흐름에서는 출력이 시작점이고, Programs와 Print History는 관리 영역에 가까워 상단 메뉴가 다소 분산되어 있었다.
- `/program-manager/programs`, `/program-manager/print-history`는 기존 직접 접근 경로로 남아 있어 호환 리다이렉트가 필요했다.

## 2. Changed Three-Menu Structure

상단 메뉴를 다음 3개로 정리했다.

1. Print
2. Exercise Catalog
3. Master

## 3. Quick Print → Print

- 사용자에게 보이는 Quick Print 명칭을 Print로 변경했다.
- 내부 컴포넌트명과 파일명은 대규모 리네임 없이 유지했다.
- `/`, `/program-manager`, `/program-manager/quick-print`는 Print 화면으로 이동한다.

## 4. Print Three-Step Wizard

Print 화면은 한 번에 한 단계만 보이는 3-step wizard로 재구성했다.

1. 회원 선택
2. 프로그램 선택
3. 확인 및 출력

- 회원을 선택하면 자동으로 Step 2로 이동한다.
- 프로그램을 선택하면 자동으로 Step 3으로 이동한다.
- Step 2의 다음 버튼은 프로그램이 없으면 비활성화된다.
- Step 3의 프로그램 수정은 Step 2로 돌아가며 선택 상태를 유지한다.
- Step 3의 회원 변경은 Step 1로 돌아가며 선택 프로그램을 초기화한다.

## 5. Top Quick Print Box Removed

- 기존 상단 hero/summary 성격의 Quick Print 박스를 제거했다.
- Print 화면은 step indicator, 현재 단계 제목, 실제 선택 영역 중심으로 구성했다.

## 6. Centered Layout

- Print 메인 콘텐츠는 단일 중앙 컬럼 형태로 정리했다.
- Step별 카드 폭을 다르게 두어 회원 선택, 프로그램 선택, 최종 확인의 정보 밀도에 맞췄다.

## 7. Master Page Structure

신규 Master 영역을 추가했다.

- `MasterPage`
- `MasterTabs`
- `ProgramManagementSection`
- `PrintHistorySection`

Master route는 `/program-manager/master`를 사용한다.

## 8. Program Management Moved Content

- 기존 Program List/CRUD 화면을 Master의 `Programs` 탭으로 이동했다.
- Program Domain, Repository, Service, CRUD 동작은 변경하지 않았다.
- 생성, 수정, 복사, archive, restore, favorite 동작은 기존 흐름을 그대로 사용한다.

## 9. Print History Moved Content

- 기존 Print History 화면을 Master의 `Print History` 탭으로 이동했다.
- Print Request 조회 훅과 상세 다이얼로그는 그대로 사용했다.
- 기존 Firestore index 오류 안내 정책도 숨기지 않고 유지했다.

## 10. Route Compatibility

- `/program-manager/programs`는 `/program-manager/master?tab=programs`로 리다이렉트한다.
- `/program-manager/print-history`는 `/program-manager/master?tab=history`로 리다이렉트한다.
- Print History의 query filter는 가능한 범위에서 보존한다.
- 프로그램 신규/수정/상세 라우트는 기존 경로를 유지했다.

## 11. Navigation Active State

- Print는 `/program-manager/print` 및 legacy quick-print 접근에서 활성화된다.
- Exercise Catalog는 기존 top-level route에서 활성화된다.
- Master는 Master 페이지, 프로그램 관리 legacy route, Print History legacy route, 프로그램 편집 route에서 활성화되도록 보정했다.

## 12. State Management Approach

- Print wizard 상태는 화면 내부 local state로 관리했다.
- 선택 회원, 선택 카테고리, 선택 프로그램, 검색어를 분리했다.
- 회원 변경 시 프로그램 선택을 초기화하여 잘못된 출력 조합을 방지했다.

## 13. Print Request Logic Preservation

- Print Preview 진입 경로는 기존 `programId + memberId` route를 그대로 사용한다.
- 인쇄 버튼 이후의 Print Request 저장, program usage update, preview/browser print 흐름은 변경하지 않았다.
- A5 template, print mapper, 출력 document 구조는 수정하지 않았다.

## 14. Future Condition Lab Integration Considerations

- 이번 Phase에서는 Condition Lab 프로젝트를 수정하지 않았다.
- 현재 UI는 Condition Lab 계열의 어두운 운영 콘솔 톤과 이어지도록 presentation layer만 정리했다.
- 이후 통합 시 Master 탭 구조를 권한/관리 메뉴 확장 지점으로 사용할 수 있다.

## 15. Responsive

- Print wizard의 주요 action 영역은 모바일에서 세로 스택으로 전환된다.
- 회원/프로그램 카드는 `xs`, `sm`, `md` grid 기준으로 반응형 배치된다.
- Master 영역은 탭과 콘텐츠 폭을 제한해 데스크톱/태블릿에서 읽기 흐름을 유지한다.

## 16. Accessibility

- 회원 카드와 프로그램 카드에 선택 목적을 설명하는 `aria-label`을 유지했다.
- Print action 버튼에도 출력 미리보기 이동 목적을 명시했다.
- 한 단계만 표시되도록 하여 키보드/스크린리더 탐색 부담을 줄였다.

## 17. Manual Acceptance Result

- 메뉴가 `Print / Exercise Catalog / Master` 순서로 정리됨을 코드 기준 확인했다.
- Print 화면이 Step 1 → Step 2 → Step 3 흐름으로 구성됨을 확인했다.
- 회원 변경 시 프로그램 초기화, 프로그램 수정 시 Step 2 복귀 흐름을 확인했다.
- legacy route 리다이렉트와 query 보존 로직을 확인했다.
- 사용자 노출 Quick Print 문구가 남지 않도록 검색 확인했다.
- 신규/수정 화면, Repository, Firestore, Print template 변경이 없음을 확인했다.

## 18. npm run build Result

성공.

```text
✓ 1068 modules transformed.
✓ built in 4.11s
```

Vite chunk size warning은 기존 번들 크기 성격의 경고이며 빌드 실패가 아니다.

## 19. TypeScript Result

성공.

- `tsc -b` 통과
- TypeScript error 0

## 20. Changed Files

### Created

- `src/features/master/index.ts`
- `src/features/master/pages/MasterPage.tsx`
- `src/features/master/components/MasterTabs.tsx`
- `src/features/master/components/ProgramManagementSection.tsx`
- `src/features/master/components/PrintHistorySection.tsx`
- `docs/reports/phase-7-2-print-workflow-master-page-restructure.md`

### Modified

- `src/app/AppRouter.tsx`
- `src/app/routes.ts`
- `src/app/routeBuilder.ts`
- `src/components/layout/AppHeader/AppHeader.tsx`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`
- `src/features/printing/pages/PrintPreviewPage.tsx`
- `src/features/programs/components/ProgramList/ProgramList.tsx`

## 21. Unresolved Items

- 실제 브라우저 수동 클릭 acceptance는 별도 실행하지 않았다.
- Vite production build에서 500 kB 이상 chunk warning이 남아 있다.
- 기존 `QuickPrintPage`, `QuickPrintFlow` 내부 파일/컴포넌트명은 유지했다. 사용자 노출 문구는 Print로 정리했다.
- Firestore index 관련 미해결 사항은 Phase 5-1 범위 그대로 유지했다.

# Phase 5 — Print Request History & Program Usage Tracking

작성일: 2026-07-27

## 1. 생성 파일

- `src/features/print-history/domain/printRequest.types.ts`
- `src/features/print-history/domain/printRequest.errors.ts`
- `src/features/print-history/mappers/printRequestMapper.ts`
- `src/features/print-history/repositories/printRequestRepository.interface.ts`
- `src/features/print-history/repositories/firestorePrintRequestRepository.ts`
- `src/features/print-history/services/printRequestService.ts`
- `src/features/print-history/hooks/useCreatePrintRequest.ts`
- `src/features/print-history/hooks/usePrintRequests.ts`
- `src/features/print-history/components/PrintHistoryFilters.tsx`
- `src/features/print-history/components/PrintRequestList.tsx`
- `src/features/print-history/components/PrintRequestDetailDialog.tsx`
- `src/features/print-history/pages/PrintHistoryPage.tsx`
- `src/features/print-history/index.ts`
- `src/features/printing/gateways/browserPrintGateway.ts`

## 2. 수정 파일

- `src/app/routes.ts`
- `src/app/routeBuilder.ts`
- `src/app/AppRouter.tsx`
- `src/components/layout/AppHeader/AppHeader.tsx`
- `src/features/printing/constants/print.constants.ts`
- `src/features/printing/pages/PrintPreviewPage.tsx`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`

## 3. 설치 패키지

- 추가 설치 없음

## 4. Print Request CRUD 결과

- Create: Quick Print 미리보기의 `인쇄` 버튼 클릭 흐름에 인쇄 요청 저장을 연결했다.
- Read/List: `/program-manager/print-history`에서 최근 100개 인쇄 요청을 `requestedAt desc` 기준으로 조회한다.
- Filter: 검색어, 카테고리, `memberId`, `programId` 필터를 지원한다.
- Detail: 목록 카드 클릭 시 인쇄 요청 snapshot 상세를 확인할 수 있다.
- Archive: Repository에 `archivePrintRequest()`를 구현했다. UI 노출은 이번 Phase에서 필수 범위가 아니므로 추가하지 않았다.
- Delete: `deleteDoc()` 사용 없음.

## 5. Repository

- Firestore 경로: `artifacts/{appId}/public/data/printHistory`
- 문서 ID는 Firestore auto ID를 사용하며, 문서 내부 `id`와 동일하게 저장한다.
- `requestedAt`, `createdAt`, Program `lastUsedAt`은 Repository에서만 `serverTimestamp()`를 사용한다.
- 인쇄 요청 생성은 Firestore transaction으로 처리한다.
  - Program 문서 조회
  - 존재/Archive/운동 수/운동명/order 검증
  - Print Request 생성
  - Program `usageCount + 1`, `lastUsedAt = requestedAt` 갱신
- Program 사용 통계 갱신 시 `updatedAt`은 변경하지 않는다.

## 6. Service

- `createPrintRequestFromDocument()`에서 인증 사용자 확인, member/program snapshot validation, repository 호출을 담당한다.
- `filterPrintRequests()`에서 검색어, 카테고리, 회원, 프로그램 필터를 처리한다.
- Repository에는 비즈니스 판단을 넣지 않고 transaction 저장 책임만 둔다.

## 7. Drag 동작

- 이번 Phase에서는 Drag & Drop 변경 없음.
- 기존 Program Editor의 운동 순서 Drag & Drop은 유지된다.

## 8. Autocomplete 동작

- 이번 Phase에서는 Exercise Editor 변경 없음.
- 기존 freeSolo Autocomplete 구조는 유지된다.

## 9. Archive 동작

- Print Request는 삭제하지 않고 `isArchived: true`로 정리할 수 있도록 Repository를 추가했다.
- 검증 중 생성된 테스트 Program과 Print Request도 삭제하지 않고 archive 상태로 정리했다.

## 10. Build 결과

- `npm run build`: 성공
- TypeScript error: 0
- Vite chunk warning 있음
  - `index-*.js`가 500kB를 초과한다는 경고
  - 기능 실패는 아니며, Phase 6 이후 code splitting 검토 권장
- `npm audit --audit-level=moderate`: 실패
  - 기존 의존성 취약점 14개 보고됨
  - `esbuild`, `react-router`, `undici` 계열
  - 자동 수정 중 일부는 breaking change 가능성이 있어 이번 Phase에서 적용하지 않음

## 11. 미해결 문제

- 실제 Firebase 검증 중 `memberId + isArchived + requestedAt desc` 조합에서 composite index 필요 오류를 확인했다.
- 오류 링크:
  - `https://console.firebase.google.com/v1/r/project/basecamp-40f23/firestore/indexes?create_composite=ClNwcm9qZWN0cy9iYXNlY2FtcC00MGYyMy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcHJpbnRIaXN0b3J5L2luZGV4ZXMvXxABGg4KCmlzQXJjaGl2ZWQQARoMCghtZW1iZXJJZBABGg8KC3JlcXVlc3RlZEF0EAIaDAoIX19uYW1lX18QAg`
- Security Rules 변경과 index 생성은 이번 Phase 범위 밖이라 수행하지 않았다.
- 실제 `window.print()` 이후 사용자가 인쇄창에서 취소했는지는 추적하지 않는다. 기록명도 요구사항대로 “인쇄 완료”가 아니라 “인쇄 요청”으로 유지했다.

## 12. Phase 4 권장 사항

- Phase 4-2의 물리 출력 승인 보류 상태가 남아 있으므로, Template V1은 계속 `approvalStatus: "provisional"`로 저장한다.
- 실제 OS/Chrome 인쇄창 조작, PDF 저장 metadata 확인, 실제 프린터 출력 검증을 완료한 뒤 새 기록부터 승인 상태 상수를 변경하는 것을 권장한다.

## Phase 6 권장 사항

- 필요한 Firestore composite index를 확정하고 생성한다.
- `npm audit` 결과에 따라 Firebase, React Router, Vite 계열 의존성 업그레이드를 별도 안정화 Phase로 처리한다.
- Print History Archive UI, 기간 필터, 회원/프로그램 상세 화면의 “기록 보기” 링크를 추가한다.
- 번들 크기 경고를 줄이기 위해 route-level lazy loading을 검토한다.


# BaseCamp Program Manager Phase 4 Report

작성일: 2026-07-27

## 1. 생성 및 수정 파일 목록

생성:

- `src/features/printing/constants/print.constants.ts`
- `src/features/printing/utils/formatPrintDate.ts`
- `src/features/printing/utils/mapCategoryToBodyParts.ts`
- `src/features/printing/mappers/workoutPrintMapper.ts`
- `src/features/printing/components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1.tsx`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`
- `src/features/printing/hooks/usePrintPreview.ts`
- `src/features/printing/pages/QuickPrintPage.tsx`
- `src/features/printing/pages/PrintPreviewPage.tsx`
- `src/features/printing/styles/print.css`
- `docs/references/README.md`
- `docs/reports/phase-4-quick-print-a5-template.md`
- `.env.local` 생성, Git 제외 대상

수정:

- `src/features/printing/types/print.types.ts`
- `src/features/printing/index.ts`
- `src/features/programs/config/programOptions.ts`
- `src/features/programs/hooks/usePrograms.ts`
- `src/features/members/repositories/profileRepository.ts`
- `src/app/routes.ts`
- `src/app/routeBuilder.ts`
- `src/app/AppRouter.tsx`

## 2. Quick Print 최종 흐름

`/program-manager/quick-print`

1. 회원 선택
2. 카테고리 선택
3. 프로그램 선택
4. 확인 카드 검토
5. 출력 미리보기 이동
6. 브라우저 인쇄 버튼

## 3. 주요 클릭 수

일반 흐름 기준:

- 회원 카드 선택
- 카테고리 선택
- 프로그램 카드 선택
- 출력 미리보기
- 인쇄

총 4~5회 주요 클릭으로 출력 진입 가능.

## 4. Route 구조

- `/`
- `/program-manager/quick-print`
- `/program-manager/programs`
- `/program-manager/programs/new`
- `/program-manager/programs/:id`
- `/program-manager/programs/:id/edit`
- `/program-manager/print/:programId?memberId={memberId}`
- `/program-manager/settings`

Preview는 URL 기반으로 memberId와 programId를 복구한다.

## 5. Print Mapper 계약

`createWorkoutPrintDocument`

입력:

- `MemberSelectionItem`
- `Program`
- optional `printDate`

출력:

- `WorkoutPrintDocument`

검증:

- 회원 누락 오류
- 프로그램 누락 오류
- archive 프로그램 차단
- 운동 8개 초과 차단
- 운동명 누락 차단
- 원본 객체 불변
- rows 항상 8개

## 6. 8행 생성 결과

브라우저 preview에서 확인:

- exercise table body row: 8개
- 2개 운동 프로그램 입력 시 6개 blank row 생성

## 7. 5세트 렌더링 결과

브라우저 preview에서 확인:

- header cell: 운동 종목 + SET 1~5 = 6개
- 첫 운동 행 set cell: 5개
- 각 set cell 안에 `kg`, `횟수`, `수축` 수기 영역 렌더링

## 8. Category 자동 체크 매핑

- `CHEST` → 가슴
- `BACK` → 등
- `SHOULDER` → 어깨
- `ARMS` → 이두, 삼두
- `LOWER_BODY` → 대퇴사두, 햄스트링, 종아리
- `FULL_BODY` → 자동 체크 없음
- `RECOVERY` → 자동 체크 없음
- `ETC` → 자동 체크 없음
- `CUSTOM` → 자동 체크 없음

## 9. A5 CSS 규격

- `@page { size: A5 portrait; margin: 0; }`
- document width: `148mm`
- document height: `210mm`
- document padding: `7mm`
- screen preview 배경 분리
- print 시 app chrome 숨김

## 10. Chrome Print Preview 결과

인앱 브라우저에서 preview 화면 구조를 확인했다.

확인 결과:

- A5 문서 렌더링 성공
- 8개 exercise row 확인
- 5개 set column 확인
- footer 표시 확인
- preview route 직접 접근 성공

실제 OS 인쇄창은 자동화 안정성을 위해 열지 않았다. 코드상 인쇄 버튼은 `window.print()`에 연결되어 있다.

## 11. 단일 페이지 확인

브라우저에서 A5 문서 크기 확인:

- width: 약 559px
- height: 약 794px

CSS는 A5 비율과 일치한다. 실제 프린터 드라이버별 pagination은 사용자 환경에서 한 번 더 확인이 필요하다.

## 12. App chrome 인쇄 제외 결과

Print CSS:

- `.no-print` 숨김
- `body * { visibility: hidden; }`
- `.print-only-root`만 visible

따라서 AppHeader, Back button, Print button, preview 배경은 인쇄 대상에서 제외된다.

## 13. 새로고침 복구 결과

Preview URL이 memberId와 programId를 포함한다.

`/program-manager/print/:programId?memberId={memberId}`

브라우저 직접 접근으로 문서 복구를 확인했다.

## 14. 오류 상태 처리 결과

확인한 오류 화면:

- 잘못된 memberId/programId 접근
- 오류 메시지 표시
- Quick Print 복귀 버튼 표시
- 프로그램 관리 이동 버튼 표시

archive 프로그램 접근은 mapper에서 차단한다.

## 15. 테스트 결과

브라우저 확인:

- Quick Print 화면 렌더링
- 실제 profiles 조회
- 실제 programs 조회
- preview 문서 렌더링
- 8행/5세트 구조
- 오류 URL 복구

검증용 `[TEST] Phase 4 Print Preview` 프로그램은 생성 후 archive 상태로 정리했다.

## 16. npm run build 결과

성공.

- TypeScript error: 0
- Vite production build 성공

## 17. bundle warning 변화

Phase 4 build:

- JS chunk: `963.85 kB`
- gzip: `272.31 kB`
- CSS chunk: `2.79 kB`

Phase 3-1 대비 JS chunk가 약 5 kB 증가했다. 이번 Phase에서는 route-level lazy loading을 적용하지 않았다. 기능 안정성 우선으로 유지했다.

## 18. 참고 이미지 시각 비교 여부

참고 이미지는 아직 프로젝트에 없다.

추가한 placeholder:

- `docs/references/README.md`

구조 구현은 완료했지만, `basecamp-workout-log-v1.png` 기준의 pixel-level 시각 비교는 미완료다.

## 19. 미해결 문제

- 실제 OS/Chrome print dialog의 최종 1페이지 출력은 수동 확인 필요
- 참고 이미지 기반 시각 비교 미완료
- bundle size warning 유지
- npm audit warning 유지
- 테스트 프로그램은 삭제하지 않고 archive 상태로 유지

## 20. Phase 5 권장 범위

1. 실제 A5 인쇄물을 사용자 프린터 기준으로 확인
2. reference image 추가 후 시각 비교
3. PrintHistory 저장 설계 승인 후 구현
4. usageCount/lastUsedAt 업데이트 정책 승인 후 구현
5. route-level lazy loading 적용 검토

## Stop Condition

Quick Print Flow, A5 Print Preview, Browser Print 호출 연결까지 구현했다.

printHistory 저장, usageCount 증가, lastUsedAt 변경, 회원 쓰기, AI 기능으로 넘어가지 않았다.

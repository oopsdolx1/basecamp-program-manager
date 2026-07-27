# Phase 5-1 — Firestore Index & Print History Operational Verification

## 1. 검증 일시

- 2026-07-27

## 2. Firebase 환경

- 실제 Firebase production 프로젝트 대상으로 검증했다.
- Emulator 사용 없음.
- Firebase Console 접근은 Google 로그인 화면에서 차단되어 Console 상의 인덱스 생성은 완료하지 못했다.

## 3. 사용 appId 마스킹 정보

- appId namespace: `base***tion`
- Firebase API key, anonymous UID, 실제 회원명은 보고서에 기록하지 않았다.

## 4. Print History collection 경로

- `artifacts/{appId}/public/data/printHistory/{printRequestId}`
- 현재 코드는 collectionGroup이 아니라 고정 collection query를 사용한다.

## 5. 기존 query 오류

- 전체 History query, memberId query, programId query 모두 실제 Firebase에서 `failed-precondition` 오류가 발생했다.
- 오류 원인: Firestore composite index 미생성.

## 6. 생성한 Composite Index

- 생성하지 못함.
- 사유: Firebase Console이 Google 로그인 화면에서 차단됨.
- Firebase CLI와 gcloud도 로컬 환경에 설치되어 있지 않았다.

## 7. Index scope

- 필요한 scope: `Collection`
- 대상 collection: `printHistory`
- collectionGroup query가 아니므로 Collection group scope는 사용하지 않는다.

## 8. Index field와 정렬 방향

실제 Firestore 오류 링크 기준으로 필요한 index:

### 전체 History Query

- `isArchived`: Ascending
- `requestedAt`: Descending
- `__name__`: Descending

오류 링크:

`https://console.firebase.google.com/v1/r/project/basecamp-40f23/firestore/indexes?create_composite=ClNwcm9qZWN0cy9iYXNlY2FtcC00MGYyMy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcHJpbnRIaXN0b3J5L2luZGV4ZXMvXxABGg4KCmlzQXJjaGl2ZWQQARoPCgtyZXF1ZXN0ZWRBdBACGgwKCF9fbmFtZV9fEAI`

### Member Request Query

- `isArchived`: Ascending
- `memberId`: Ascending
- `requestedAt`: Descending
- `__name__`: Descending

오류 링크:

`https://console.firebase.google.com/v1/r/project/basecamp-40f23/firestore/indexes?create_composite=ClNwcm9qZWN0cy9iYXNlY2FtcC00MGYyMy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcHJpbnRIaXN0b3J5L2luZGV4ZXMvXxABGg4KCmlzQXJjaGl2ZWQQARoMCghtZW1iZXJJZBABGg8KC3JlcXVlc3RlZEF0EAIaDAoIX19uYW1lX18QAg`

### Program Request Query

- `isArchived`: Ascending
- `programId`: Ascending
- `requestedAt`: Descending
- `__name__`: Descending

오류 링크:

`https://console.firebase.google.com/v1/r/project/basecamp-40f23/firestore/indexes?create_composite=ClNwcm9qZWN0cy9iYXNlY2FtcC00MGYyMy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcHJpbnRIaXN0b3J5L2luZGV4ZXMvXxABGg4KCmlzQXJjaGl2ZWQQARoNCglwcm9ncmFtSWQQARoPCgtyZXF1ZXN0ZWRBdBACGgwKCF9fbmFtZV9fEAI`

## 9. Index Ready 확인

- 확인하지 못함.
- 사유: 인덱스 생성 자체가 Firebase Console 로그인 차단으로 완료되지 않음.

## 10. 전체 History query 결과

- 실패.
- `isArchived == false`, `requestedAt desc`, `limit(100)` query에서 composite index 필요 오류 발생.

## 11. memberId query 결과

- 실패.
- `memberId == selectedMemberId`, `isArchived == false`, `requestedAt desc`, `limit(100)` query에서 composite index 필요 오류 발생.

## 12. programId query 결과

- 실패.
- `programId == selectedProgramId`, `isArchived == false`, `requestedAt desc`, `limit(100)` query에서 composite index 필요 오류 발생.

## 13. URL 필터 복구 결과

- 코드 기준 확인:
  - `/program-manager/print-history?memberId=...`
  - `/program-manager/print-history?programId=...`
  - `/program-manager/print-history?category=...`
  - `/program-manager/print-history?search=...`
- URL query는 UI filter state로 복구되도록 구현되어 있다.
- 단, 실제 화면 데이터 렌더링은 Firestore index 미생성 때문에 최종 성공 확인 불가.

## 14. transaction 생성 결과

- 성공.
- 테스트 Program으로 Print Request 2건을 실제 Firestore transaction으로 생성했다.
- 테스트 문서는 검증 후 archive 처리했다.

## 15. usageCount 증가 결과

- 초기값: 0
- 1차 요청 후: 1
- 2차 요청 후: 2
- 누락 없음.

## 16. lastUsedAt 갱신 결과

- 1차 요청 후 Program `lastUsedAt`이 1차 Print Request `requestedAt`과 동일 timestamp로 materialize됨.
- 2차 요청 후 Program `lastUsedAt`이 2차 Print Request `requestedAt`과 동일 timestamp로 materialize됨.

## 17. updatedAt 유지 결과

- 1차 요청 후 `updatedAt` 유지 확인.
- 2차 요청 후 `updatedAt` 유지 확인.
- Firestore Timestamp의 `seconds / nanoseconds` 기준으로 비교했다.

## 18. 연속 요청 결과

- 동일 Program으로 연속 2회 요청 성공.
- Print Request ID는 서로 다름.
- `requestedAt` 순서 정상.
- usageCount는 0 → 1 → 2로 증가.
- updatedAt은 유지됨.

## 19. 실패 atomicity 결과

- archive 상태 Program으로 Print Request 생성 시도.
- 예상대로 `program-archived` 오류 발생.
- Print Request 추가 생성 없음.
- usageCount 변경 없음.
- lastUsedAt 변경 없음.
- updatedAt 변경 없음.

## 20. archive Program 차단 결과

- archive 상태 Program은 Print Request 생성이 차단됨.
- 운영 Program은 사용하지 않았고, 테스트 Program만 archive 상태로 전환해 검증했다.

## 21. window.print 호출 순서

코드 기준 확인:

1. 인쇄 버튼 클릭
2. saving 상태 진입
3. 버튼 disabled
4. Print Request transaction 실행
5. transaction 성공 시에만 `browserPrintGateway.print()` 호출
6. `browserPrintGateway.print()` 내부에서 `window.print()` 호출
7. saving 상태 해제

실패 흐름:

1. transaction 실패
2. 오류 표시
3. `window.print()` 미호출
4. 버튼 재활성화

## 22. 중복 클릭 방지 결과

- 코드 기준 확인:
  - `useCreatePrintRequest()`가 saving 중 추가 create 요청을 `null`로 무시한다.
  - Print Preview 버튼은 saving 중 disabled 처리된다.
- 실제 OS Print Dialog를 자동으로 여러 번 열어 검증하지는 않았다.

## 23. snapshot 불변성 결과

- Print Request 생성 후 테스트 Program 제목과 운동명을 변경했다.
- 기존 Print Request의 `programSnapshot.title`, `programSnapshot.exercises[0].name`은 변경되지 않았다.
- snapshot immutability 확인 완료.

## 24. 개인정보 미저장 확인

- `memberSnapshot` key는 `memberId`, `name`만 존재.
- 다음 금지 key 미저장 확인:
  - `phone`
  - `contact`
  - `address`
  - `birthDate`
  - `birthday`
  - `note`
  - `memberMemo`
  - `health`
  - `diagnosis`
  - `consultation`
- 실제 회원명, 전화번호, UID는 보고서에 기록하지 않았다.

## 25. template approvalStatus 확인

- 모든 테스트 Print Request의 `template.approvalStatus`는 `provisional`.
- Phase 4-2 물리 출력 최종 승인 전이므로 `approved`로 변경하지 않았다.

## 26. realtime 갱신 결과

- 실제 화면 realtime 렌더링은 index 미생성으로 최종 성공 확인 불가.
- 코드 기준 `onSnapshot()` 구독과 cleanup return은 구현되어 있다.

## 27. query limit

- Repository query limit: `limit(100)`
- 최근 100개만 구독한다.

## 28. 테스트 데이터 정리

- 테스트 Program title: `[TEST] Phase 5-1 Operational Verification`
- 테스트 Program: archive 처리
- 테스트 Print Request: 2건 archive 처리
- 물리 삭제 없음.

## 29. Security Rules 변경 여부

- 변경 없음.
- 발생 오류는 `permission-denied`가 아니라 `failed-precondition`이었다.

## 30. deleteDoc 사용 여부

- 사용하지 않음.

## 31. npm audit 결과

- `npm audit --audit-level=moderate`: 실패
- 총 14개 취약점
  - moderate: 12
  - high: 2
- 관련 패키지:
  - `esbuild`
  - `react-router`
  - `undici`
  - Firebase 하위 패키지
- `npm audit fix --force`는 Vite 8.x 등 breaking change 가능성이 있어 실행하지 않았다.
- High 항목은 Firebase dependency tree의 `undici` 계열에 포함되어 있어 별도 dependency upgrade Phase에서 처리 권장.

## 32. npm run build 결과

- 성공.

## 33. TypeScript 결과

- TypeScript error: 0

## 34. bundle warning

- Vite warning 있음:
  - 일부 chunk가 minification 후 500kB 초과
  - 현재 JS bundle 약 995kB
- 이번 Phase에서는 bundle 최적화 수행하지 않음.

## 35. 미해결 문제

- Firestore composite index가 아직 생성되지 않았다.
- Firebase Console 접근이 Google 로그인 화면에서 막혀 인덱스 생성/Ready 확인을 완료하지 못했다.
- 전체/member/program History query는 index 생성 전까지 실제 운영 화면에서 실패한다.
- npm audit 취약점이 남아 있다.

## 36. Phase 6 진행 가능 여부

- 현재 상태에서는 Phase 6 진행 보류를 권장한다.
- 이유:
  - Phase 5-1 Completion Criteria 중 Composite Index Ready, 전체/member/program query 성공, realtime 화면 검증을 충족하지 못했다.
- 다음 작업:
  1. 위 오류 링크로 Firebase Console 로그인
  2. 필요한 3개 composite index 생성
  3. Ready 상태까지 대기
  4. `/program-manager/print-history` query matrix 재검증


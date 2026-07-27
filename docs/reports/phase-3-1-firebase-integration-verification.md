# BaseCamp Program Manager Phase 3-1 Report

작성일: 2026-07-27

## 1. 사용한 Firebase 환경

기존 Condition Lab의 Firebase 초기화 코드에서 환경을 확인했다.

- Firebase project: 마스킹 처리하여 검증
- Auth domain: 마스킹 처리하여 검증
- appId namespace: `basecamp_production`
- profiles path: `artifacts/basecamp_production/public/data/profiles`
- programs path: `artifacts/basecamp_production/public/data/programs`

보고서에는 Firebase apiKey, 실제 projectId 전체값, token, uid 원문을 기록하지 않는다.

## 2. Auth 연결 결과

성공.

- Firebase Auth 초기화 성공
- anonymous sign-in 성공
- uid 존재 확인
- custom token은 사용하지 않음

## 3. profiles 실제 조회 결과

성공.

- 전체 profiles 문서 수: 29
- `role === "member"` 문서 수: 29
- profiles read 권한: 허용됨

개인정보 보호를 위해 이름, 전화번호, memo 내용은 기록하지 않았다.

## 4. role별 문서 수

- member: 29
- trainer: 0
- 기타 role 제외: 0
- role 누락: 0

## 5. legacy alias 진단 수

- `phone` 직접 사용 문서: 0
- `contact` fallback 문서: 0
- `memo` 직접 사용 문서: 0
- `note` fallback 문서: 26

## 6. ID 불일치 수

- Firestore document ID와 문서 내부 `id` 불일치: 0
- 이름 누락: 0

## 7. Program Firestore 최종 경로

최종 경로는 Phase 1/2 결정과 일치한다.

`artifacts/basecamp_production/public/data/programs/{programId}`

확인 결과:

- Path Builder가 위 경로를 생성함
- Repository에서 root-level `programs` 컬렉션을 사용하지 않음
- Repository에서 경로 문자열을 중복 하드코딩하지 않음
- Program 문서에 `memberId`를 저장하지 않음
- Program 문서에 승인 없는 `centerId`를 추가하지 않음

## 8. Create 결과

성공.

테스트 문서 제목:

`[TEST] Phase 3 Firebase Verification`

생성 확인:

- 문서 생성 성공
- 문서 내부 `id` 필드 존재
- `usageCount` 초기값 0
- `lastUsedAt` 초기값 null
- `isArchived` 초기값 false

## 9. Read 결과

성공.

- 생성된 테스트 프로그램 단건 조회 성공
- Firestore Timestamp 타입 변환 확인

## 10. Update 결과

성공.

- 제목 수정 반영
- memo 수정 반영
- favorite `true` 반영
- 실시간 구독 화면에 반영되는 snapshot 확인

## 11. Duplicate 결과

성공.

복사 제목:

`[TEST] Phase 3 Firebase Verification (복사)`

확인 결과:

- 원본과 다른 문서 ID
- `usageCount = 0`
- `lastUsedAt = null`
- `isArchived = false`
- 새 `createdAt`
- 새 `updatedAt`

## 12. Archive 결과

성공.

- `isArchived = true` 반영
- `deleteDoc()` 사용하지 않음

## 13. Restore 결과

성공.

- `isArchived = false` 복원 확인
- 이후 cleanup 정책에 따라 테스트 문서를 다시 archive 상태로 전환

## 14. 실시간 반영 결과

성공.

- create 이후 programs snapshot 반영 확인
- update 이후 programs snapshot 반영 확인

## 15. Timestamp 검증 결과

성공.

- `createdAt`은 Firestore Timestamp
- `updatedAt`은 Firestore Timestamp
- `serverTimestamp()`는 Repository에서만 사용

## 16. 필드 계약 검증 결과

성공.

생성 문서에서 확인한 필드:

- `id`
- `schemaVersion`
- `title`
- `category`
- `difficulty`
- `memo`
- `favorite`
- `usageCount`
- `createdAt`
- `updatedAt`
- `lastUsedAt`
- `createdBy`
- `updatedBy`
- `isArchived`
- `exercises`

운동 필드:

- `id`
- `name`
- `sets`
- `memo`
- `order`

금지 필드 부재 확인:

- `kg`
- `reps`
- `contraction`
- `restTime`
- `memberId`
- `centerId`

운동 order는 1부터 연속으로 저장됨을 확인했다.

## 17. 테스트 문서 정리 상태

물리 삭제하지 않았다.

- 테스트 문서 수: 2
- archive 상태 문서 수: 2
- cleanup 정책: `[TEST]` 접두어 문서를 archive 상태로 유지
- `deleteDoc()` 미사용

## 18. bundle warning 분석

`npm run build` 결과 가장 큰 chunk:

- `dist/assets/index-CsUMAdad.js`
- minified: 958.62 kB
- gzip: 270.18 kB

영향 후보:

- Material UI
- Firebase SDK
- dnd-kit

현재 Phase에서는 기능 변경 없이 검증이 목적이므로 무리한 최적화는 하지 않았다. Phase 4 이후 route-level lazy loading과 manual chunk 분리를 검토할 수 있다.

## 19. npm run build 결과

성공.

- TypeScript error: 0
- Vite production build 성공
- bundle size warning 존재

## 20. 미해결 문제

- npm audit 경고는 여전히 남아 있다.
- bundle size warning이 남아 있다.
- 테스트 문서는 정책에 따라 archive 상태로 유지되어 Firestore에 남아 있다.
- Security Rules는 수정하지 않았다.

## 21. Phase 4 진행 가능 여부

진행 가능.

확인된 근거:

- 기존 profiles read 가능
- role filter 결과 정상
- programs read/write 가능
- create/update/duplicate/archive/restore 가능
- 실시간 snapshot 반영 확인
- Timestamp 및 필드 계약 확인
- Program 경로가 Phase 1/2 승인 경로와 일치

단, Phase 4에서 Print로 진입하기 전에 테스트 archive 문서를 운영 목록에서 계속 제외하는 UI 정책을 유지해야 한다.

# Phase 6 — Exercise Catalog Foundation & Program Editor Integration

작성일: 2026-07-27

## 1. Domain 구조

- 신규 Feature: `src/features/exercise-catalog/`
- 구성:
  - `domain/`
  - `repositories/`
  - `services/`
  - `hooks/`
  - `components/`
  - `pages/`
  - `mappers/`
  - `constants/`
  - `index.ts`
- 다른 Feature에서는 public `index.ts`를 통해 접근하도록 구성했다.

## 2. Firestore Path

- 신규 Path Builder:
  - `exerciseCatalogCollectionPath(appId)`
- 실제 경로:
  - `artifacts/{appId}/public/data/exerciseCatalog/{exerciseId}`
- Repository 내부에서 path string을 하드코딩하지 않고 Path Builder를 사용한다.

## 3. Exercise Contract

- `ExerciseCatalogItem`
  - `id`
  - `schemaVersion`
  - `name`
  - `englishName`
  - `aliases`
  - `category`
  - `primaryMuscle`
  - `secondaryMuscles`
  - `equipmentType`
  - `movementPattern`
  - `difficulty`
  - `memo`
  - `isFavorite`
  - `isArchived`
  - `createdAt`
  - `updatedAt`
  - `createdBy`
  - `updatedBy`
- Program Category와 충돌하지 않도록 Exercise Catalog 전용 소문자 코드 체계를 사용했다.

## 4. Alias 정책

- `normalizeAliases()`에서 공백을 정리하고 중복을 제거한다.
- `name`은 aliases에 반드시 포함되도록 보정한다.
- 검색/OCR 준비를 위해 한글명, 영문명, 축약명, 흔한 표기 변형을 seed에 포함했다.

## 5. Search 정책

- Repository 검색이 아니라 Service 검색이다.
- 검색 대상:
  - `name`
  - `englishName`
  - `aliases`
- 대소문자와 공백 차이를 무시한다.
- 한글/영문 혼합 검색을 허용한다.
- 기본 정렬:
  1. Favorite
  2. Name

## 6. Repository

- `subscribeCatalog()`
- `getExercise()`
- `createExercise()`
- `updateExercise()`
- `archiveExercise()`
- `restoreExercise()`
- `deleteDoc()` 사용 없음.
- `serverTimestamp()`는 Repository에서만 사용한다.

## 7. Service

- Validation
- Duplicate Name 검사
- Alias Normalization
- Search
- Sort
- Category Filter
- Equipment Filter
- Primary Muscle Filter

## 8. Program Integration

- Program Editor 운동 Autocomplete를 Catalog 기반으로 연결했다.
- Catalog 선택 시:
  - `name`
  - `displayName`
  - `catalogExerciseId`
  를 함께 저장한다.
- 직접 입력은 계속 허용한다.
- 직접 입력 시:
  - `catalogExerciseId = undefined`
  - `name/displayName = 입력값`

## 9. Backward Compatibility

- 기존 Program의 `catalogExerciseId`가 없어도 정상 동작한다.
- Migration Script는 작성하지 않았다.
- 기존 Program 자동 변환도 하지 않았다.
- 기존 `name` 필드를 유지하고 `displayName`을 optional로 추가했다.

## 10. Seeder

- `initialExerciseCatalogSeed`를 추가했다.
- Catalog 화면에서 “초기 Seed” 버튼으로 실행한다.
- 자동 실행하지 않는다.
- 중복 name은 건너뛴다.

## 11. Catalog 개수

- Seed 항목: 80개
- 포함 범위:
  - 가슴
  - 등
  - 어깨
  - 팔
  - 하체
  - 코어
  - 전신
  - 유산소
  - 회복
  - 모빌리티

## 12. Category 종류

- `chest`
- `back`
- `shoulder`
- `arm`
- `lower_body`
- `full_body`
- `core`
- `cardio`
- `recovery`
- `mobility`
- `other`

## 13. Equipment 종류

- `barbell`
- `dumbbell`
- `machine`
- `cable`
- `bodyweight`
- `kettlebell`
- `smith`
- `resistance_band`
- `medicine_ball`
- `cardio_machine`
- `other`

## 14. Primary Muscle 종류

- `chest`
- `upper_back`
- `lats`
- `traps`
- `rear_delts`
- `front_delts`
- `side_delts`
- `biceps`
- `triceps`
- `forearm`
- `glutes`
- `quadriceps`
- `hamstrings`
- `calves`
- `abs`
- `obliques`
- `hip_flexors`
- `full_body`
- `other`

## 15. Build

- `npm run build`: 성공
- Vite production build 완료.

## 16. TypeScript

- TypeScript error: 0

## 17. 미해결 문제

- Phase 5-1의 Firestore Print History composite index Ready는 이번 Phase에서 수정하지 않았다.
- Template V1 실제 물리 출력 승인은 여전히 보류 상태다.
- `npm audit` 기존 취약점이 남아 있다.
  - 총 14개
  - moderate 12개
  - high 2개
  - breaking change 가능성이 있어 이번 Phase에서 강제 업그레이드하지 않았다.
- Exercise Catalog의 고급 관리 UI는 최소 구현만 완료했다.
  - 목록/필터/Seed는 제공
  - 상세 편집 Form UI는 다음 단계에서 확장 권장

## 18. Phase 7 권장 범위

- Exercise Catalog 상세 편집 화면 추가
- Favorite Toggle UI 추가
- Archive/Restore UI 버튼 추가
- OCR Resolver에서 `aliases` 기반 매칭 연결
- AI Recommendation 입력 계약 정리
- Condition Lab 연동용 Catalog export/import 전략 검토
- Firestore index 및 npm dependency 안정화 전용 Phase 별도 진행

## 검증 결과

- 실제 Firebase에서 테스트 Catalog 운동 1개 생성 성공.
- 조회 성공.
- 수정 성공.
- Archive 성공.
- Restore 성공.
- Alias 기반 조회 성공.
- 테스트 운동은 최종 archive 상태로 정리.
- 회원 데이터 수정 없음.
- Print 기능 변경 없음.
- Usage Tracking 변경 없음.
- OCR/AI/CSV Import/Condition Lab 통합 구현 없음.


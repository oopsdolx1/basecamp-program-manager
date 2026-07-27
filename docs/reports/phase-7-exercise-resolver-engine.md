# Phase 7 — Exercise Resolver Engine 1.0

작성일: 2026-07-27

## 1. Resolver Architecture

- 신규 Feature: `src/features/exercise-resolver/`
- 구성:
  - `domain/`
  - `services/`
  - `hooks/`
  - `utils/`
  - `constants/`
  - `tests/`
  - `index.ts`
- Resolver는 순수 Domain Service로 구현했다.
- Resolver는 Firestore, Repository, Program Feature에 직접 의존하지 않는다.
- Resolver의 외부 의존성은 `exercise-catalog`의 `ExerciseCatalogItem` 타입뿐이다.

## 2. Domain Model

- `ResolveRequest`
  - `text`
  - `catalog`
- `ResolveResult`
  - `status`: `resolved | ambiguous | unknown`
  - `exercise`
  - `confidence`
  - `matchedAlias`
  - `normalizedText`
  - `candidateExercises`
  - `reason`
- Batch resolver:
  - `resolveExercises({ texts, catalog })`

## 3. Normalize Rule

`normalizeExerciseText()` 규칙:

- `trim()`
- lowercase
- 연속 공백 제거
- 괄호 제거
- 특수문자 제거
- `-`, `_`, `/`, `.`, `,` 제거
- 한글/영문 혼합 문자열 유지
- 예:
  - `Lat Pull-Down` → `latpulldown`

## 4. Matching Rule

우선순위:

1. id exact match
2. name exact match
3. englishName exact match
4. aliases exact match
5. similarity match

exact 계열 비교는 normalize된 문자열 기준으로 수행한다.

## 5. Alias Rule

- Catalog의 `aliases`를 normalize한 뒤 입력값과 비교한다.
- alias exact match는 `matchedAlias`에 실제 alias 문자열을 반환한다.
- Catalog는 수정하지 않는다.
- Unknown을 자동으로 Catalog에 생성하지 않는다.

## 6. Similarity Algorithm

- Levenshtein distance 기반 similarity를 직접 구현했다.
- 무거운 NLP 라이브러리는 사용하지 않았다.
- 외부 패키지 추가 없음.
- similarity 후보는 confidence 70 이상만 candidate로 유지한다.

## 7. Confidence Policy

- Exact: 100
- Alias Exact: 95
- Normalized Match: 90
- Similarity Max: 80
- Unknown: 0

Threshold:

- 90 이상: 자동 resolved 가능
- 70~89: ambiguous
- 69 이하: unknown

Similarity는 최대 80으로 제한되어 자동 선택하지 않고 후보 안내로 남긴다.

## 8. Resolve Flow

1. 입력 text normalize
2. 빈 입력이면 unknown
3. Catalog normalize cache 조회
4. id/name/englishName/aliases exact match
5. exact 후보 1개면 resolved
6. exact 후보 여러 개면 ambiguous
7. exact 실패 시 similarity 후보 계산
8. 후보 confidence 70 이상이면 ambiguous
9. 후보가 없으면 unknown

## 9. Performance

- Catalog normalize 결과를 `WeakMap`으로 cache한다.
- 같은 catalog 배열 기준으로 반복 resolve 시 normalize를 반복하지 않는다.
- Firestore 접근이 없으므로 150개 catalog / batch 100개 기준 목표에 맞는 구조다.

## 10. Cache Strategy

- `WeakMap<ExerciseCatalogItem[], NormalizedCatalogEntry[]>`
- catalog 배열 identity가 같으면 normalized entry를 재사용한다.
- Catalog가 새로 구독되어 배열이 바뀌면 새 cache가 생성된다.

## 11. Program Integration

- Program Editor freeSolo 입력에 Resolver 후보 안내를 연결했다.
- 자동 치환은 하지 않는다.
- Catalog 선택 시 기존 Phase 6 동작대로:
  - `name`
  - `displayName`
  - `catalogExerciseId`
  저장.
- 직접 입력 시:
  - `catalogExerciseId` 없음
  - Resolver 결과는 helper text 후보로만 표시.

## 12. OCR Ready 여부

- OCR 자체는 구현하지 않았다.
- `resolveExercises()` batch API를 제공해 OCR 결과 배열을 바로 처리할 수 있다.
- Unknown Queue는 만들지 않았다.

## 13. AI Ready 여부

- AI 자체는 구현하지 않았다.
- AI 추천 기능은 향후 Resolver 결과만 사용하면 되도록 `ResolveResult` 계약을 분리했다.
- AI 내부에서 직접 문자열 매칭을 구현하지 않아도 되는 구조다.

## 14. Build 결과

- `npm run build`: 성공
- Vite production build 완료.
- 기존 bundle size warning은 계속 존재한다.

## 15. TypeScript 결과

- TypeScript error: 0
- Resolver test case 파일도 `src` 아래에 있어 타입검사 대상에 포함된다.

## 16. 미해결 사항

- Phase 5-1 Print History Composite Index Ready는 이번 Phase에서 수정하지 않았다.
- Template V1 Approval은 여전히 보류 상태다.
- `npm audit` 기존 취약점은 남아 있다.
  - 총 14개
  - moderate 12개
  - high 2개
  - breaking change 가능성이 있어 이번 Phase에서 강제 업그레이드하지 않았다.
- 별도 테스트 러너는 아직 없다.
  - `src/features/exercise-resolver/tests/exerciseResolver.test.ts`에 검증 케이스와 runner 함수를 추가했다.

## 17. Phase 8 권장 사항

- Condition Lab 통합 전 Resolver API 확정
- OCR 결과 배열 → `resolveExercises()` 연결
- ambiguous 후보 선택 UI 설계
- unknown 입력 리뷰 UI 또는 운영 큐 검토
- Resolver test runner 도입
- Print History composite index Ready 후 History 화면 재검증

## Out of Scope 준수

- OCR 구현 없음
- Gemini/AI 구현 없음
- Program Recommendation 없음
- Firestore Rules 변경 없음
- Catalog CRUD 변경 없음
- Favorite 변경 없음
- CSV Import 없음
- Condition Lab Migration 없음
- 기존 Program Migration 없음
- 자동 Catalog 생성 없음
- 자동 Program 수정 없음
- `deleteDoc()` 사용 없음


# BaseCamp Program Manager Phase 4-1 Report

작성일: 2026-07-27

## 1. 검증 환경

- 앱: BaseCamp Program Manager
- URL: local Vite dev server
- 브라우저 검증: Codex in-app browser
- OS 인쇄창 직접 조작: 미완료
- PDF 저장: 미완료
- 실제 프린터 출력: 미완료

실제 회원 이름, 전화번호, Firebase 비밀값은 보고서에 기록하지 않았다.

## 2. Chrome 인쇄 설정

자동화 환경에서 OS/Chrome 인쇄창의 세부 설정을 안정적으로 조작하지 못했다.

권장 운영 설정:

- 대상: PDF로 저장 또는 실제 A5 지원 프린터
- 용지: A5
- 방향: 세로
- 배율: 기본값 또는 100%
- 머리글/바닥글: 끔
- 배경 그래픽: 켬

## 3. 선택한 A5 CSS 전략

Strategy B를 유지했다.

- `@page margin: 0`
- 문서 자체가 안전 여백을 포함
- document width: `148mm`
- document height: `210mm`
- document padding: `7mm`

이중 여백 적용을 피하고, 브라우저 기본 margin 영향을 최소화하는 방식이다.

## 4. 최종 @page 설정

```css
@page {
  size: A5 portrait;
  margin: 0;
}
```

## 5. 최종 문서 크기와 안전 여백

- width: `148mm`
- height: `210mm`
- padding: `7mm`
- box sizing: `border-box`
- print transform: `none`
- print shadow: 제거

브라우저 측정값:

- width: 약 559px
- height: 약 794px
- overflow: 없음

## 6. PDF 페이지 수

PDF 저장은 자동화 환경에서 완료하지 못했다.

브라우저 DOM 기준 A5 문서 컨테이너는 1페이지 높이 안에 들어오도록 확인했다.

## 7. PDF 용지 규격

PDF 저장 미완료로 PDF metadata 확인은 하지 못했다.

CSS 규격은 A5 portrait로 고정되어 있다.

## 8. 8행 / 5세트 확인

브라우저 검증 결과:

- 운동 row: 8개
- SET column: 5개
- 첫 행 set cell: 5개
- footer 표시: 정상

## 9. 최소 구성 프로그램 결과

Phase 4에서 2개 운동 입력 시 blank row가 채워지는 구조를 확인했다.

Phase 4-1에서는 최대 구성과 긴 텍스트 안정성을 우선 검증했다. Mapper 계약상 1개 운동이면 7개 blank row가 생성된다.

## 10. 최대 구성 프로그램 결과

검증용 `[TEST]` 프로그램:

- 운동 8개
- memo 포함
- configuredSets 1~5 혼합
- 한글/영문 혼합 운동명 포함

결과:

- blank row 없음
- row 높이 균일
- A5 document overflow 없음
- footer 잘림 없음

## 11. 긴 텍스트 결과

적용 정책:

- 프로그램 제목: 1줄 ellipsis
- 운동명: 1줄 ellipsis
- 운동 memo: 1줄 ellipsis
- 프로그램 memo: 고정 높이 overflow hidden
- Mapper에서 출력 snapshot 문자열 길이 제한

긴 텍스트로 인한 문서 높이 증가와 2페이지 생성 위험을 줄였다.

## 12. category mapping 결과

최종 자동 체크 정책:

- `CHEST` → 가슴
- `BACK` → 등
- `SHOULDER` → 어깨
- `ARMS` → 이두, 삼두
- `LOWER_BODY` → 대퇴사두, 햄스트링, 종아리
- `FULL_BODY` → 자동 체크 없음
- `RECOVERY` → 자동 체크 없음
- `ETC` → 자동 체크 없음
- `CUSTOM` → 자동 체크 없음

Phase 4-1 검증 케이스는 `BACK`으로 진행했고, 등 체크 표시가 적용되는 계약을 확인했다.

## 13. App chrome 제외 결과

Print CSS:

- `.no-print` 숨김
- `.print-only-root`만 visible
- AppHeader, 버튼, preview 배경 제외
- print shadow 제거
- print transform 제거

## 14. 실제 프린터 출력 결과

실제 프린터 출력은 미완료다.

사유:

- 현재 자동화 환경에서 OS 인쇄창과 프린터 장치 선택을 안정적으로 제어할 수 없다.
- 사용자 프린터의 A5 지원 여부와 하드웨어 margin은 로컬 장치에서 수동 확인이 필요하다.

## 15. 적용한 CSS 보정

적용:

- body/html print margin 제거
- print transform 제거
- page-break/break-inside 회피
- exercise row 높이 `15.4mm` → `13.4mm`
- handwriting grid 높이 `12.6mm` → `10.6mm`
- print section padding `2.4mm` → `2mm`
- memo 영역 고정 높이 축소
- 긴 텍스트 ellipsis/line clamp

## 16. Template V1 계약

고정:

- `templateKey`: `basecamp-workout-log-v1`
- `templateVersion`: `1`
- `format`: `A5-portrait`
- exercise rows: 8
- set columns: 5

## 17. templateVersion 정책

이번 변경은 patch 수준으로 판단한다.

이유:

- row 수 변경 없음
- set column 수 변경 없음
- snapshot 계약 변경 없음
- 필수 섹션 변경 없음
- CSS 안정화와 overflow 보정만 수행

따라서 `templateVersion = 1` 유지.

## 18. bundle warning 상태

최종 build:

- CSS: `3.46 kB`, gzip `1.22 kB`
- JS: `964.43 kB`, gzip `272.54 kB`

bundle warning은 유지된다.

이번 Phase에서는 출력 안정성만 다루므로 route lazy loading이나 manualChunks는 적용하지 않았다.

## 19. npm audit 상태

`npm audit --json` 결과:

- total: 0
- low: 0
- moderate: 0
- high: 0
- critical: 0

## 20. npm run build 결과

성공.

- Vite production build 성공
- bundle size warning 존재

## 21. TypeScript 결과

- TypeScript error: 0

## 22. 검증 체크리스트

- [ ] Chrome 인쇄창 직접 실행: 미완료
- [ ] A5 선택: 수동 확인 필요
- [ ] 세로 방향 확인: CSS 기준 확인
- [x] 1페이지 DOM 높이 확인
- [x] 빈 두 번째 페이지 없음: DOM overflow 없음
- [ ] 머리글/바닥글 제외: 수동 인쇄 설정 필요
- [x] AppHeader 제외 CSS 확인
- [x] 버튼 제외 CSS 확인
- [x] Preview 배경 제외 CSS 확인
- [x] 운동 row 8개
- [x] SET column 5개
- [x] kg 영역 확인
- [x] 횟수 영역 확인
- [x] 수축 영역 확인
- [x] 긴 텍스트 overflow 확인
- [ ] PDF 1페이지 확인: PDF 저장 미완료
- [ ] PDF A5 규격 확인: PDF 저장 미완료
- [x] footer 잘림 없음
- [ ] 실제 프린터 출력: 미완료
- [x] build 성공
- [x] TypeScript error 0

## 23. 미해결 문제

- OS/Chrome print dialog 직접 검증 미완료
- PDF 저장 파일 검증 미완료
- 실제 프린터 출력 미완료
- 참고 이미지 `docs/references/basecamp-workout-log-v1.png` 없음
- bundle size warning 유지

## 24. Phase 5 진행 가능 여부

조건부 진행 가능.

코드와 브라우저 DOM 기준으로는 Template V1이 A5 1페이지에 안정적으로 들어오도록 보정되었다.

다만 PrintHistory 또는 usageCount 구현 전, 사용자 환경에서 한 번은 실제 Chrome PDF 저장 또는 실제 A5 출력으로 최종 물리 검증을 완료하는 것을 권장한다.

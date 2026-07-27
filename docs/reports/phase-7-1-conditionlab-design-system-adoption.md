# Phase 7-1 — Condition Lab Design System Adoption

작성일: 2026-07-27

## 1. Condition Lab Design 분석

Condition Lab의 `docs/design/design-system-v1.md`, `styles.css`, Header 및 공통 UI 컴포넌트를 기준으로 다음 원칙을 추출했다.

- Dark operations interface
- Gold는 primary action, selected state, 중요 metric에만 사용
- Slate/black 기반 workspace background
- Card는 `rounded-2xl` 또는 `rounded-3xl` 계열
- Button은 `rounded-xl`, 최소 높이 40~44px
- Card border는 slate 계열
- Typography는 compact하지만 굵게
- Focus ring은 gold 계열로 명확히 표시
- Hover/transition은 150ms 전후로 미묘하게 적용

## 2. 추출한 Design Token

- Background: black
- Surface: slate 900 계열
- Border: slate 800 계열
- Primary: gold
- Text primary: white
- Text secondary: slate 400
- Radius:
  - Button: 12px
  - Card: 24px
  - Chip: pill
- Shadow:
  - black 기반 soft shadow
- Typography:
  - Page title: heavy / tracking tight
  - Section title: heavy
  - Body/supporting text: bold

## 3. 적용한 Component

- Theme palette
- Theme typography
- MUI Button override
- MUI Card override
- MUI TextField override
- MUI Chip override
- App Header
- Page Container
- SearchField
- EmptyState
- LoadingState
- Quick Print workspace UI

## 4. Layout 변경

- Quick Print를 Condition Lab workspace 방식으로 재구성했다.
- Desktop:
  - Left: selection workflow
  - Right: sticky summary panel
- Tablet/Mobile:
  - single column flow
- 기능 흐름은 유지했다.

## 5. Header 변경

- 기존 `Quick Print Foundation` 문구 제거.
- Condition Lab Header와 유사한 glass/dark sticky header 적용.
- 좌측 Brand:
  - `BASECAMP`
  - `PROGRAM MANAGER`
- 우측 Navigation:
  - Quick Print
  - Programs
  - Exercise Catalog
  - Print History
- 현재 route 기준 active nav pill 표시.

## 6. Navigation 변경

- Condition Lab의 active pill navigation 스타일을 MUI Button으로 재현했다.
- active 상태는 gold background + black text.
- inactive 상태는 slate text + hover slate surface.

## 7. Card 변경

- Card 기본 스타일을 dark surface, slate border, rounded-3xl에 가깝게 변경했다.
- Quick Print의 Member/Category/Program/Summary 영역을 같은 card language로 정리했다.
- 선택된 card는 gold border와 subtle gold background로 표시한다.

## 8. Button 변경

- Primary Button은 gold background + black text.
- Disabled는 MUI dark mode 기준 disabled 상태 유지.
- Focus visible ring을 gold로 지정했다.
- Button radius와 height를 Condition Lab 기준에 맞췄다.

## 9. Search 변경

- SearchField에 search icon 유지.
- Clear button 추가.
- Label/placeholder 문구를 실제 검색 대상 중심으로 정리했다.
- TextField surface를 dark workspace에 맞게 조정했다.

## 10. Typography

- Pretendard 기반 유지.
- H1/H2/H3 weight와 tracking을 Condition Lab 기준으로 보정했다.
- Section eyebrow는 uppercase/letter spacing/gold를 사용했다.

## 11. Spacing

- PageContainer를 더 넓은 workspace 기준으로 조정했다.
- Quick Print section gap은 8px grid 기반으로 정리했다.
- Card padding은 주요 section 기준 24px 전후로 적용했다.

## 12. Animation

- Hover transition:
  - border-color
  - background-color
  - transform
- Operational UI를 해치지 않도록 큰 scale animation은 사용하지 않았다.

## 13. Accessibility

- 주요 선택 card에 `aria-label` 추가.
- Print Preview button에 명확한 label 유지.
- Button/Card focus-visible 상태를 gold outline으로 보강했다.
- color만으로 상태를 구분하지 않고 text/chip label을 함께 제공한다.

## 14. Build 결과

- `npm run build`: 성공.
- Vite production build 완료.
- 기존 bundle size warning은 유지된다.
  - JS bundle 약 1,023kB

## 15. TypeScript 결과

- TypeScript error: 0

## 16. 향후 공통 Component 후보

- `WorkspaceHeader`
- `WorkspaceSectionCard`
- `SelectableCard`
- `SummaryPanel`
- `StatusChip`
- `SearchField`
- `EmptyState`
- `LoadingState`

이번 Sprint에서는 공통 패키지 분리나 Condition Lab 코드 직접 공유 구조는 만들지 않았다.

## Out of Scope 준수

- Program Domain 변경 없음
- Exercise Catalog 변경 없음
- Resolver 변경 없음
- Print 기능 변경 없음
- OCR/AI 변경 없음
- Firebase/Repository/Service/Transaction 변경 없음
- Firestore Rules 변경 없음


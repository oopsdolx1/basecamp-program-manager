# Sprint 16-5A Design System Audit

작성일: 2026-08-01

## Scope

이번 Sprint는 코드 수정 없이 Condition Lab과 BaseCamp Program Manager의 UI Design System을 비교 감사하는 작업이다.

중요한 전제

- 현재 워크스페이스에는 `basecamp-program-manager`만 존재한다.
- Condition Lab 실제 소스 코드는 현재 로컬에서 확인할 수 없다.
- 따라서 Condition Lab을 Source of Truth로 둔 "실코드 기준 양방향 비교"는 이번 워크스페이스만으로는 완료할 수 없다.
- 본 보고서는 BaseCamp의 실제 코드 기반 측정값과, Condition Lab 코드 부재로 인해 추가 확보가 필요한 항목을 명확히 구분한다.
- Print Template / A5 출력 스타일은 감사 대상에서 제외한다.

## Condition Lab Design Tokens

현재 워크스페이스에는 Condition Lab 코드가 없어 실제 토큰을 코드 기준으로 검증할 수 없었다.

확인 결과

- Condition Lab 프로젝트 디렉터리: 없음
- Condition Lab theme/styles source: 없음
- Condition Lab 실측 hex / rgba / radius / shadow / spacing: 확인 불가

참고 문서

- `docs/reports/phase-7-1-conditionlab-design-system-adoption.md`

주의

- 위 문서는 과거 요약 문서이며, 이번 Sprint 요구사항의 "실제 코드 기준 조사"를 대체할 수 없다.
- 따라서 Condition Lab 값은 이번 보고서에서 제안 출처로는 사용하지 않고, 확보 필요 항목으로만 다룬다.

## BaseCamp Design Tokens

실제 코드 기준 위치

- `src/theme/palette.ts`
- `src/theme/basecampTheme.ts`
- `src/theme/componentOverrides.ts`
- `src/theme/typography.ts`

### Color

`src/theme/palette.ts`

- app background: `#000000`
- surface / paper: `#0F172A`
- card background default override: `rgba(15, 23, 42, 0.72)`
- elevated surface examples:
  - `rgba(2, 6, 23, 0.68)`
  - `rgba(2, 6, 23, 0.72)`
  - `rgba(2, 6, 23, 0.58)`
  - `rgba(2, 6, 23, 0.45)`
- input background: `rgba(2, 6, 23, 0.6)`
- primary gold: `#D9C54B`
- primary gold darker tone: `#BCA72F`
- primary gold muted usages:
  - `rgba(217, 197, 75, 0.14)`
  - `rgba(217, 197, 75, 0.18)`
  - `rgba(217, 197, 75, 0.24)`
  - `rgba(217, 197, 75, 0.45)`
- primary text: `#FFFFFF`
- secondary text: `#94A3B8`
- muted text: `#94A3B8`
- border: `#1E293B`
- divider: `#1E293B`
- success: `#10B981`
- warning: `#F59E0B`
- error: `#EF4444`
- info: `#3B82F6`

추가 하드코딩된 background 계열

- header background: `rgba(17, 17, 17, 0.8)`
- nav hover surface: `rgba(30, 41, 59, 0.75)`
- stat bar muted fill: `rgba(148, 163, 184, 0.16)`

### Radius / Border

실제 코드 기준 반복값

- general button radius: `12px`
- text/input radius: `12px`
- dialog radius: `18px`
- theme card radius: `24px`
- chip radius: `999px`
- many local cards / panels: `4` spacing unit (`theme.shape`가 아닌 sx shorthand)
- tab container radius: `3`
- list container radius: `2`
- header icon radius: `2.5`

Border

- 대부분 `1px solid divider`
- divider token: `#1E293B`
- opacity 별도 token 없음
- 일부 포커스 효과는 border 대신 gold box-shadow 사용

### Shadow

- card shadow: `0 18px 42px rgba(0, 0, 0, 0.22)`
- button shadow: none
- app bar shadow: none
- print stylesheet shadow는 audit scope 제외
- dropdown / floating element / modal shadow의 공통 token은 확인되지 않음
- dialog는 radius만 override되고 shadow token은 별도 정의 없음

### Typography

`src/theme/typography.ts`

- font-family:
  - `"Pretendard", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- h1:
  - size `1.875rem`
  - weight `950`
  - letterSpacing `-0.03em`
- h2:
  - size `1.25rem`
  - weight `950`
  - letterSpacing `-0.02em`
- h3:
  - size `1.1rem`
  - weight `900`
  - letterSpacing `-0.02em`
- body1:
  - letterSpacing `0`
- body2:
  - weight `700`
  - letterSpacing `0`
- button:
  - weight `900`
  - letterSpacing `0`

확인 불가 / 미정

- base body font size token 명시 없음
- label/caption line-height token 별도 정의 없음
- line-height는 대부분 MUI 기본값 의존

### Spacing

반복적으로 확인된 값

- page content max width:
  - header toolbar `1152px`
  - quick print / flow cards `880`, `1040`, `1180`
- page horizontal padding:
  - header `px: 2`
- section gap:
  - `1`, `1.25`, `1.5`, `2`, `2.5`, `3`, `4` 혼용
- card padding:
  - `p: 4`
  - quick print cards `p: { md: 4, xs: 2.5 }`
- form gap:
  - `spacing={1.5}` 빈도가 높음
- button height:
  - theme `minHeight: 40`
  - 주요 CTA는 `minHeight: 56`
- input size:
  - TextField default `size="small"`
  - 실제 fixed height token 없음

## Component 비교

Condition Lab 실코드가 없으므로 다음 표는 BaseCamp 실측과 Condition Lab 비교 불가 상태를 함께 표기한다.

### App Shell

BaseCamp

- background: `background.default` = `#000000`
- header background: `rgba(17, 17, 17, 0.8)`
- header blur: `blur(12px)`
- header height: `64px`
- content width: `maxWidth 1152px` 기준 사용
- nav active: gold fill + black text
- nav inactive hover: `rgba(30, 41, 59, 0.75)`

Condition Lab

- 실제 코드 부재로 검증 불가

### Card

BaseCamp

- theme card bg: `rgba(15, 23, 42, 0.72)`
- border: `1px solid #1E293B`
- radius: `24px`
- shadow: `0 18px 42px rgba(0, 0, 0, 0.22)`
- local override card variants 다수 존재

Condition Lab

- 검증 불가

### Button

BaseCamp

- border radius: `12px`
- min height: `40px`
- weight: `700` root / typography button `900`
- focus ring: `0 0 0 2px #D9C54B`
- primary button uses theme gold
- disabled state mostly MUI default

Condition Lab

- 검증 불가

### Input

BaseCamp

- small size default
- outlined input radius: `12px`
- bg: `rgba(2, 6, 23, 0.6)`
- search field uses start icon + conditional clear icon

Condition Lab

- 검증 불가

### Badge / Chip

BaseCamp

- chip radius: `999px`
- weight: `900`
- selected states often rely on primary color

Condition Lab

- 검증 불가

### Modal

BaseCamp

- dialog radius: `18px`
- modal surface/shadow token not fully centralized

Condition Lab

- 검증 불가

### Table

BaseCamp

- fully centralized token system 확인 안 됨
- borders and containers mostly local `borderRadius: 2~3`

Condition Lab

- 검증 불가

### Empty State

BaseCamp

- border box
- `borderRadius: 4`
- `p: 4`
- centered vertical layout

Condition Lab

- 검증 불가

### Loading State

BaseCamp

- simple inline spinner + body2 text
- `gap: 1.5`, `py: 3`

Condition Lab

- 검증 불가

### Step Indicator

BaseCamp

- QuickPrintFlow local hard-coded styles
- uses gold for active/completed state and multiple slate rgba layers
- not theme-centralized

Condition Lab

- 검증 불가

## Gold Accent 사용 방식

BaseCamp 실제 사용

- primary CTA background
- active navigation
- selected card border / surface tint
- focus ring
- app brand accent text
- important chip / score highlight
- step indicator active and completed states

관찰

- Gold가 단순 CTA 외에도 Step Indicator, selected cards, focus ring, navigation, badge 등에 폭넓게 사용된다.
- 그러나 대부분 token화되어 있지 않고 개별 `rgba(217, 197, 75, ...)`로 분산되어 있다.
- 이 분산 사용은 Condition Lab 기준으로 통제된 accent 사용인지 현재 검증할 수 없다.

## BaseCamp Difference Matrix

Condition Lab 실코드 부재로 비교값은 `확인 불가`로 표기한다.

| Element | Condition Lab | BaseCamp | Action |
|---|---|---|---|
| Page BG | 확인 불가 | `#000000` | Condition Lab 코드 확보 후 비교 |
| Surface | 확인 불가 | `#0F172A` | 비교 필요 |
| Card BG | 확인 불가 | `rgba(15, 23, 42, 0.72)` | 비교 필요 |
| Elevated Surface | 확인 불가 | `rgba(2, 6, 23, 0.45~0.72)` 혼용 | 정리 필요 |
| Card Radius | 확인 불가 | theme 24px, local 4/3/2 혼용 | 변경 후보 |
| Button Radius | 확인 불가 | 12px | 비교 필요 |
| Input Radius | 확인 불가 | 12px | 비교 필요 |
| Modal Radius | 확인 불가 | 18px | 비교 필요 |
| Border | 확인 불가 | `1px solid #1E293B` | 비교 필요 |
| Primary Gold | 확인 불가 | `#D9C54B` | 비교 필요 |
| Gold Muted | 확인 불가 | rgba 하드코딩 다수 | 정리 필요 |
| Text Primary | 확인 불가 | `#FFFFFF` | 비교 필요 |
| Text Secondary | 확인 불가 | `#94A3B8` | 비교 필요 |
| Shadow | 확인 불가 | `0 18px 42px rgba(0,0,0,0.22)` | 비교 필요 |
| Header BG | 확인 불가 | `rgba(17,17,17,0.8)` | 비교 필요 |
| Search/Input BG | 확인 불가 | `rgba(2,6,23,0.6)` | 비교 필요 |
| Step Indicator | 확인 불가 | local hard-coded | 변경 후보 |

## Hard-coded Style 목록

Print CSS 제외, application UI 기준 주요 하드코딩

Theme / global

- `rgba(15, 23, 42, 0.72)`
- `rgba(2, 6, 23, 0.6)`
- `0 18px 42px rgba(0, 0, 0, 0.22)`
- `12`, `18`, `24`, `999`

Header / shell

- `rgba(17, 17, 17, 0.8)`
- `rgba(30, 41, 59, 0.75)`
- `blur(12px)`
- `64px` height

QuickPrintFlow

- `rgba(217, 197, 75, 0.14)`
- `rgba(217, 197, 75, 0.18)`
- `rgba(217, 197, 75, 0.24)`
- `rgba(217, 197, 75, 0.45)`
- `rgba(2, 6, 23, 0.58)`
- `rgba(2, 6, 23, 0.45)`
- `rgba(15, 23, 42, 0.8)`
- `rgba(2, 6, 23, 0.22)`
- `rgba(148, 163, 184, 0.12)`
- `1040`, `1180`, `880` width constants
- `56px`, `64px`, `96px` control heights

Other feature components

- `rgba(2, 6, 23, 0.68)`
- `rgba(148, 163, 184, 0.16)`
- local `borderRadius: 2`, `3`, `4`

## 변경 우선순위

### P0

- App Shell
- Card
- Button
- Input
- Search
- Navigation

근거

- theme와 local hard-coded style이 동시에 존재
- 제품 전체 인상에 미치는 영향이 큼
- Condition Lab 정렬 시 가장 먼저 공통 token화가 필요한 영역

### P1

- Step Indicator
- Recommendation Card
- Member Intelligence Card
- Training Trend Card
- RecommendationTraceCard

근거

- Quick Print 내에서 local style 분산이 가장 심함
- gold tint, radius, panel surface가 재사용되지만 token화되어 있지 않음

### P2

- Modal
- Empty State
- Badge / Chip
- Table

근거

- 현재 구현 범위가 비교적 단순하거나 영향 면이 좁음
- 상위 공통 토큰 정리가 선행되면 후속 반영이 수월함

## Proposed Shared Design System

주의

- 아래는 Condition Lab 실코드 검증 전의 "BaseCamp 기준 초안"이다.
- 최종 공유 토큰은 Condition Lab 코드 확보 후 재정의해야 한다.

```ts
export const designTokens = {
  color: {
    background: "#000000",
    surface: "#0F172A",
    surfaceElevated: "rgba(15, 23, 42, 0.72)",
    surfaceOverlay: "rgba(2, 6, 23, 0.6)",
    border: "#1E293B",
    divider: "#1E293B",
    primary: "#D9C54B",
    primaryHover: "#BCA72F",
    textPrimary: "#FFFFFF",
    textSecondary: "#94A3B8",
    textMuted: "#94A3B8",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    pill: 999,
  },
  shadow: {
    card: "0 18px 42px rgba(0, 0, 0, 0.22)",
    focusGold: "0 0 0 2px #D9C54B",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
};
```

## Sprint 16-5B 수정 계획

선행 조건

- Condition Lab 실제 소스 코드 확보
- 최소 다음 파일 또는 대응 경로 확인
  - theme / palette
  - global styles
  - card/button/input component styles
  - layout shell styles
  - typography tokens

실행 계획

1. Condition Lab 실코드에서 실제 토큰 추출
2. BaseCamp theme token과 1:1 비교표 재작성
3. 공통 token 파일 설계
4. BaseCamp P0 컴포넌트부터 theme 우선 통일
5. Quick Print local hard-coded surface/radius/gold tint 제거
6. P1 컴포넌트 토큰 치환
7. 필요 시 P2 정리
8. 회귀 빌드 및 화면 확인

## Audit Conclusion

확인된 사실

- BaseCamp는 dark + gold + card 중심 언어를 사용 중이다.
- 그러나 theme token과 local hard-coded style이 함께 존재한다.
- 특히 Quick Print와 일부 feature card에서 surface, gold tint, radius가 분산되어 있다.
- Condition Lab을 Source of Truth로 삼으려면 Condition Lab 실코드 확보가 반드시 필요하다.

이번 Sprint 결과

- BaseCamp 실제 Design Token과 하드코딩 위치는 코드 기준으로 정리 완료
- Condition Lab 실측 비교는 현재 워크스페이스 기준으로 미완료
- 16-5B 착수 전 Condition Lab 소스 확보가 선행되어야 함

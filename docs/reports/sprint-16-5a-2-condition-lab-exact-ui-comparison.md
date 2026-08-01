# Sprint 16-5A-2 Condition Lab Exact UI Comparison

작성일: 2026-08-01

## 1. Condition Lab Source Paths

Condition Lab 실제 소스 경로

- `C:\Users\zzomb\OneDrive - 전주화산초등학교\condition-lab`

실제 조사 파일

- `index.html`
- `src/styles.css`
- `src/app/AppHeader.jsx`
- `src/app/BottomNavigation.jsx`
- `src/App.jsx`
- `src/screens/HomeScreen.jsx`
- `src/screens/MemberSelectScreen.jsx`
- `src/components/common/Card.jsx`
- `src/components/common/Badge.jsx`
- `src/components/common/LoadingState.jsx`
- `src/components/ui/ActionButton.jsx`
- `src/components/ui/PageHeader.jsx`
- `src/components/ui/SectionCard.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/features/member/components/MemberForm.jsx`
- `src/features/exercise/components/ExerciseCatalogManager.jsx`

BaseCamp 비교 파일

- `src/theme/palette.ts`
- `src/theme/basecampTheme.ts`
- `src/theme/componentOverrides.ts`
- `src/theme/typography.ts`
- `src/components/layout/AppHeader/AppHeader.tsx`
- `src/components/common/SearchField/SearchField.tsx`
- `src/components/common/EmptyState/EmptyState.tsx`
- `src/components/common/LoadingState/LoadingState.tsx`
- `src/features/master/components/MasterTabs.tsx`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`

## 2. Exact Tokens

### Condition Lab

Source of truth는 Tailwind config + global CSS + shared UI component class 조합이다.

#### Color

`index.html`

- app background: `#000000` (`slate.900`)
- surface base: `#111111` (`slate.800`)
- border slate strong: `#262626` (`slate.700`)
- text muted families:
  - `#a3a3a3` (`slate.400`)
  - `#737373` (`slate.500`)
  - `#404040` (`slate.600`)
- primary gold: `#D9C54B` (`primary.500`)
- primary gold hover / darker: `#ca8a04` (`primary.600`)
- primary gold lighter: `#eab308` (`primary.400`)
- primary gold dark base: `#713f12` (`primary.900`)
- primary tint 50 / 100:
  - `#fefce8`
  - `#fef9c3`

`src/styles.css`

- body background: `#000000`
- body text: `#FFFFFF`
- glass panel background: `rgba(17, 17, 17, 0.8)`
- glass panel border: `1px solid rgba(217, 197, 75, 0.15)`
- scrollbar track: `rgba(0,0,0,0.2)`
- scrollbar thumb: `rgba(217, 197, 75, 0.4)`
- scrollbar thumb hover: `rgba(217, 197, 75, 0.6)`

Shared component and screen usage

- card dark surface recurring:
  - `bg-slate-900/40`
  - `bg-slate-900/50`
  - `bg-slate-900/60`
  - `bg-slate-900/80`
  - `bg-black/30`
  - `bg-black/40`
  - `bg-black/60`
  - `bg-black/70`
  - `bg-black/90`
- input background: `bg-black` or `bg-black/70`
- border default:
  - `border-slate-700`
  - `border-slate-800`
  - accent border `border-primary-500/30`, `/40`, `/80`
- success usage:
  - `text-emerald-300`
  - `bg-emerald-900/20`
- warning / amber usage:
  - `border-amber-500/40`
- error usage:
  - `text-red-300`
  - `border-red-500/30`
  - `border-red-500/50`
  - `bg-red-500/10`
- blue / alt accent usage:
  - `text-blue-400`
  - `border-blue-500/40`
  - `bg-blue-500/20`

#### Radius / Border

Recurring Condition Lab values

- card radius: `rounded-2xl` = `16px`
- large header / hero radius: `rounded-3xl` = `24px`
- button radius: `rounded-xl` = `12px`
- input radius: `rounded-xl` = `12px`
- search input on MemberSelect: `rounded-2xl` = `16px`
- badge radius: `rounded-full` = pill
- modal radius:
  - report modal container `rounded-2xl` = `16px`
  - member edit modal `rounded-3xl` = `24px`
- border width: mostly `1px`
- border opacity recurring:
  - `primary-500/15`
  - `primary-500/30`
  - `primary-500/40`
  - `primary-500/80`
  - `slate-700/50`
  - `slate-700/80`
  - `slate-800/80`

#### Shadow

Recurring Condition Lab values

- card hover glow: `hover:shadow-primary-500/20`
- CTA glow:
  - `shadow-[0_0_15px_rgba(217,197,75,0.25)]`
  - `shadow-[0_0_15px_rgba(217,197,75,0.3)]`
  - `shadow-[0_0_30px_rgba(217,197,75,0.4)]`
  - `shadow-[0_0_50px_rgba(217,197,75,0.6)]`
- glass panel / shell shadow:
  - `shadow-lg shadow-black/50`
  - `shadow-2xl`
- modal / floating backdrop:
  - `bg-black/90 backdrop-blur-sm`
  - bottom nav `bg-black/90 backdrop-blur-lg`
- drawer / overlay:
  - `shadow-2xl`
  - `shadow-[0_-12px_30px_rgba(0,0,0,0.45)]`

#### Typography

Global

- font-family: `'Pretendard', 'Inter', 'sans-serif'` from Tailwind config
- body actual CSS family: `'Pretendard', sans-serif`

Observed type scales

- Page title:
  - `text-3xl` = 30px
  - `font-black` = 900
  - tracking tight / tighter in key titles
- Section title:
  - `text-lg` = 18px or `text-2xl` = 24px depending on surface importance
  - `font-black`
- Card title:
  - usually `text-sm`, `text-base`, or `text-lg`
  - `font-black` or `font-bold`
- Body:
  - `text-sm`
  - `font-medium` or `font-bold`
- Caption:
  - `text-xs` or `text-[10px]`
  - often `font-bold`
- Button:
  - primary CTA `font-black`
  - utility buttons `font-bold`
- Input:
  - typically `font-bold`
- Letter spacing:
  - brand subtitle `tracking-[0.28em]`
  - page title `tracking-tight` / `tracking-tighter`
- Line height:
  - body prose often `leading-relaxed`
  - debug/pre blocks `leading-6`

#### Spacing

Observed recurring values

- page shell max width: `max-w-6xl` = 1152px
- page padding: `px-4`
- header height: `h-16` = 64px
- card padding:
  - `p-5` = 20px
  - `p-6` = 24px
  - `p-8` = 32px
- form gap: `gap-2`, `gap-3`, `gap-4`, `gap-5`
- section gap: often `mt-4`, `mt-6`, `mt-16`
- control heights:
  - many inputs use `py-3` or `py-3.5`
  - large CTA uses `py-5`
- navigation spacing:
  - header nav `gap-2`
  - shell right area `gap-4`
  - bottom nav `py-2 pb-4`

### BaseCamp

#### Color

`src/theme/palette.ts`

- app background: `#000000`
- surface: `#0F172A`
- border/divider: `#1E293B`
- primary gold: `#D9C54B`
- gold dark: `#BCA72F`
- primary text: `#FFFFFF`
- secondary / muted text: `#94A3B8`
- success: `#10B981`
- warning: `#F59E0B`
- error: `#EF4444`

Theme / local

- theme card bg: `rgba(15, 23, 42, 0.72)`
- text field bg: `rgba(2, 6, 23, 0.6)`
- header bg: `rgba(17, 17, 17, 0.8)`
- nav hover: `rgba(30, 41, 59, 0.75)`
- gold muted usages:
  - `rgba(217, 197, 75, 0.14)`
  - `rgba(217, 197, 75, 0.18)`
  - `rgba(217, 197, 75, 0.24)`
  - `rgba(217, 197, 75, 0.45)`

#### Radius / Border / Shadow

- button radius: `12px`
- input radius: `12px`
- dialog radius: `18px`
- theme card radius: `24px`
- chip radius: `999px`
- local card / panel radius mixed: `2`, `3`, `4`
- border width: mostly `1px`
- shadow:
  - card `0 18px 42px rgba(0, 0, 0, 0.22)`
  - button/appbar shadow none
  - many feature panels rely on no custom shadow

#### Typography

`src/theme/typography.ts`

- font-family: `"Pretendard", "Noto Sans KR", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- h1: `1.875rem`, `950`, `-0.03em`
- h2: `1.25rem`, `950`, `-0.02em`
- h3: `1.1rem`, `900`, `-0.02em`
- body2: `700`
- button: `900`

#### Spacing

- page max width examples: `880`, `1040`, `1180`, header `1152`
- header height: `64px`
- CTA min height: `56px`
- button root min height: `40px`
- local section gap heavily mixed
- QuickPrintFlow local spacing/radius values are not theme-centralized

## 3. Difference Matrix

| Element | Condition Lab | BaseCamp | Difference | Action |
|---|---|---|---|---|
| App BG | `#000000` | `#000000` | same | Keep |
| Surface Base | `#111111` / `bg-black` / `bg-slate-900/40~80` | `#0F172A` / `rgba(15,23,42,0.72)` | BaseCamp is bluer, Condition Lab is closer to black/neutral slate | Change |
| Glass Surface | `rgba(17,17,17,0.8)` + gold border 0.15 | `rgba(17,17,17,0.8)` header only | BaseCamp header matches, cards do not | Change |
| Card BG | `glass-panel` or `bg-slate-900/40` | `rgba(15, 23, 42, 0.72)` | BaseCamp cards are brighter and more blue | Change |
| Card Border | `rgba(217,197,75,0.15)` or `border-slate-800` / `border-slate-700` | `#1E293B` | Condition Lab uses softer neutral + occasional gold opacity | Change |
| Card Radius | common `16px`, large `24px` | theme `24px`, many local `16px` / `12px` equivalents mixed | BaseCamp lacks consistent radius language | Change |
| Button Radius | `12px` | `12px` | same core token | Keep |
| Input Radius | mostly `12px`, search often `16px` | `12px` | BaseCamp search lacks the larger search-field treatment | Change |
| Modal Radius | `16px` to `24px` | `18px` | BaseCamp sits between sizes | Change |
| Badge Radius | pill | pill | same | Keep |
| Border Width | `1px` | `1px` | same | Keep |
| Border Opacity | many `/15 /30 /40 /80` semantic opacities | mostly opaque solid color | BaseCamp is less nuanced | Change |
| Primary Gold | `#D9C54B` | `#D9C54B` | same | Keep |
| Gold Hover | `#ca8a04` and gradients from `#D9C54B` to `#ca8a04` | `#BCA72F` plus rgba local tints | not identical hover ramp | Change |
| Gold Muted | `rgba(217,197,75,0.15~0.6)` | `rgba(217,197,75,0.14~0.45)` | similar family, but Condition Lab uses more semantic opacity layers | Change |
| Text Primary | `#FFFFFF` | `#FFFFFF` | same | Keep |
| Text Secondary | `#a3a3a3`, `#737373`, `#404040` | `#94A3B8` single family | BaseCamp secondary text is cooler/bluer | Change |
| Input BG | `bg-black` or `bg-black/70` | `rgba(2,6,23,0.6)` | BaseCamp inputs are lighter and bluer | Change |
| Header Height | `64px` | `64px` | same | Keep |
| Header Width | `1152px` | `1152px` | same | Keep |
| Search Height | `py-4` / `rounded-2xl` | MUI small default + 12px radius | Condition Lab search is larger and more prominent | Change |
| Primary CTA Height | `py-5` large hero / `py-3~3.5` normal CTA | `minHeight 56` CTA, root minHeight 40 | close but not systematically mapped | Change |
| Card Shadow | `shadow-lg` / `shadow-2xl` / gold glow on CTA | `0 18px 42px rgba(0,0,0,0.22)` | BaseCamp uses one card shadow, Condition Lab uses tiered shadows | Change |
| Navigation Active | gold background + black text | gold background + black text | same pattern | Keep |
| Navigation Inactive | text-slate-400 hover slate-800 | text.secondary hover rgba(30,41,59,0.75) | similar, but BaseCamp token is not aligned to Condition Lab slate ramp | Change |

## 4. Component Language

### Condition Lab

#### App Shell

- black workspace foundation
- glass-panel header with blur and subtle gold border
- narrow neutral/slate surfaces inside a black frame
- active navigation is gold fill, inactive navigation is muted slate text
- mobile navigation keeps the same language with black translucent surface and gold active text

#### Card

- primarily border-led, not color-block-led
- uses dark translucent surfaces rather than one fixed opaque paper color
- radius hierarchy is meaningful:
  - standard cards `rounded-2xl`
  - hero / page header `rounded-3xl`
- hover states often add lift, glow, or border emphasis
- gold is used as accent border/glow, not as default card background

#### Button

- primary CTA often uses gold fill or gold gradient
- secondary button is dark slate with border
- hover motion includes scale on important CTA
- font is heavier than BaseCamp default visual weight perception because Tailwind classes consistently use `font-black`

#### Input / Search / Select

- black input background
- border-slate-700 default, primary gold border on focus
- search is visually larger and more intentionally framed
- many controls use `rounded-xl`, but search field in member selection uses `rounded-2xl`

#### Badge

- pill shape
- tinted backgrounds with matching tinted border and text
- accent color is semantic, not fill-solid

#### Modal

- black backdrop with blur
- dark neutral panel, strong border, large radius
- modal header often uses sticky top + layered surface in larger workflows

#### Table

- border-heavy, slate-700 grid language
- black/slate alternating surfaces
- accent text colors, not accent fills, are used for metrics

#### Empty / Loading

- empty states are dashed border, low-emphasis dark surfaces
- loading state is theatrical: concentric ring + gold gradient orb + message panel

### BaseCamp

#### App Shell

- dark + gold overall direction matches Condition Lab
- header is already very close to Condition Lab
- however content panels rely on MUI paper language rather than Condition Lab translucent black/slate layering

#### Card

- more shadow-led than border-led
- theme card is bluer and brighter than Condition Lab
- local feature cards vary widely, so the language is less consistent

#### Button

- primary semantics match
- motion and glow are less expressive
- component override is consistent, but some Condition Lab CTA emphasis is missing

#### Input / Search

- relies on MUI small input defaults
- less dramatic control height and less distinct search-field presence
- blue-black background diverges from Condition Lab pure black input treatment

#### Badge / Chip

- shape is aligned
- BaseCamp chip styling is more generic MUI, less semantically tinted than Condition Lab

#### Modal / Empty / Step Indicator

- modal tokenization is thinner
- empty state is simpler and less integrated with the dark shell language
- step indicator is locally hand-styled and not aligned to a shared shell system

## 5. Condition Lab Source of Truth Decision

Application UI Source of Truth

- Color: Condition Lab
- Radius: Condition Lab
- Border: Condition Lab
- Shadow: Condition Lab
- Typography: Condition Lab
- Spacing: Condition Lab
- Button: Condition Lab
- Input: Condition Lab
- Card: Condition Lab
- Navigation: Condition Lab

Independent

- Print Template / A5 print design: BaseCamp independent

## 6. Shared Semantic Tokens

Condition Lab actual values 기준 제안

```ts
export const sharedTokens = {
  color: {
    bgApp: "#000000",
    bgSurface: "#111111",
    bgSurfaceMuted: "rgba(17, 17, 17, 0.8)",
    bgElevated: "rgba(0, 0, 0, 0.7)",
    bgPanel: "rgba(17, 17, 17, 0.8)",
    bgInput: "#000000",
    borderDefault: "#262626",
    borderMuted: "rgba(217, 197, 75, 0.15)",
    textPrimary: "#FFFFFF",
    textSecondary: "#a3a3a3",
    textMuted: "#737373",
    accentPrimary: "#D9C54B",
    accentPrimaryHover: "#ca8a04",
    accentPrimarySoft: "rgba(217, 197, 75, 0.2)",
    success: "#10B981",
    warning: "#ca8a04",
    error: "#EF4444",
  },
  radius: {
    control: "12px",
    card: "16px",
    hero: "24px",
    pill: "999px",
  },
  shadow: {
    card: "0 10px 30px rgba(0, 0, 0, 0.35)",
    panel: "0 0 0 1px rgba(217, 197, 75, 0.15)",
    accentGlow: "0 0 15px rgba(217, 197, 75, 0.3)",
    accentGlowStrong: "0 0 30px rgba(217, 197, 75, 0.4)",
  },
  spacing: {
    pageX: "16px",
    headerH: "64px",
    cardPad: "24px",
    cardPadLg: "32px",
    gapSm: "8px",
    gapMd: "12px",
    gapLg: "16px",
    gapXl: "20px",
  },
  control: {
    heightMd: "48px",
    heightLg: "56px",
    searchPadY: "16px",
  },
};
```

## 7. BaseCamp Migration Order

### P0

1. Global Theme
2. App Shell
3. Card
4. Button
5. Input / Search

수정 대상 파일

- `src/theme/palette.ts`
- `src/theme/basecampTheme.ts`
- `src/theme/componentOverrides.ts`
- `src/theme/typography.ts`
- `src/components/layout/AppHeader/AppHeader.tsx`
- `src/components/layout/AppLayout/AppLayout.tsx`
- `src/components/common/SearchField/SearchField.tsx`

### P1

6. Navigation
7. Step Indicator
8. Recommendation UI
9. Member Intelligence
10. Training Trend
11. RecommendationTraceCard

수정 대상 파일

- `src/features/master/components/MasterTabs.tsx`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`
- `src/features/printing/components/SnapshotExerciseBuilderRow/SnapshotExerciseBuilderRow.tsx`
- 관련 printing common cards inside QuickPrintFlow local helpers

### P2

12. Modal
13. Empty State
14. Table
15. Badge

수정 대상 파일

- `src/components/common/EmptyState/EmptyState.tsx`
- `src/components/common/LoadingState/LoadingState.tsx`
- `src/features/members/components/MemberList/MemberList.tsx`
- `src/features/exercise-catalog/components/*.tsx`
- dialog/modal usage files across master and printing screens

## 8. File-level Change Plan

### Theme layer

- Replace BaseCamp blue-slate surface assumptions with Condition Lab neutral black/slate values.
- Introduce semantic border opacity variants.
- Split card radius into standard card vs hero/header.
- Add explicit input/search sizing tokens.

### Shell layer

- Keep current BaseCamp header structure but align inactive nav, selected profile pill, and hover surfaces to Condition Lab values.
- Add consistent shell spacing and content frame semantics.

### Component layer

- Card:
  - standardize around `rounded-2xl`, border-led surfaces, lower blue tint
- Button:
  - keep 12px radius
  - align primary hover and optional glow semantics
- Input/Search:
  - move from MUI small default look toward black input field with clearer focus gold border
  - differentiate large search field from compact form field
- Empty/Loading:
  - align border, surface, and feedback tone to Condition Lab

### Feature layer

- Remove local repeated `rgba(217, 197, 75, ...)` and `rgba(2, 6, 23, ...)` values from QuickPrintFlow and replace them with semantic tokens.
- Normalize Recommendation-related cards to the same card language as Condition Lab `Card`, `SectionCard`, and `PageHeader`.

## 9. Build Verification

BaseCamp

- `npm run build` 성공 on 2026-08-01
- TypeScript Error 0

Condition Lab

- `npm run build` 성공 on 2026-08-01

참고

- 두 프로젝트 모두 large chunk warning은 있으나 이번 Audit 실패 조건은 아님

## 10. Conclusion

정확 비교 결과, BaseCamp와 Condition Lab은 이미 같은 제품군의 방향성을 공유하지만 세부 언어는 다르다.

가장 큰 차이

- BaseCamp는 blue-slate MUI paper 언어가 남아 있다.
- Condition Lab은 black + neutral slate + subtle gold border/glow 언어가 더 강하다.
- BaseCamp는 radius, border opacity, control height, search prominence가 일관되지 않다.
- Condition Lab은 같은 골드를 써도 fill보다 border, tint, glow, focus에 더 정교하게 분배한다.

따라서 16-5B에서는 색만 맞추는 수준이 아니라 다음 네 가지를 함께 맞춰야 한다.

- radius hierarchy
- border opacity system
- control height system
- spacing and shell rhythm

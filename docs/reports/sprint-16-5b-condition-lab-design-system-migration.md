# Sprint 16-5B Condition Lab Design System Migration

## 1. Migration Overview

This sprint migrated BaseCamp application UI toward the Condition Lab design language without changing product logic, route structure, recommendation behavior, snapshot behavior, provider contracts, or print template behavior.

The migration focused on application-layer styling only:

- semantic theme tokens
- app shell surface language
- card system
- button system
- input/search system
- navigation styling
- wizard / recommendation surfaces
- empty, loading, and error states
- snapshot builder application UI surfaces

Excluded by design:

- print template / A5 output styles
- recommendation logic
- member intelligence logic
- periodization logic
- Firestore schema
- provider structure

## 2. Source of Truth

Condition Lab remained the visual source of truth.

Reference inputs used during migration:

- `docs/reports/sprint-16-5a-design-system-audit.md`
- `docs/reports/sprint-16-5a-2-condition-lab-exact-ui-comparison.md`
- Condition Lab source repository at `C:\Users\zzomb\OneDrive - 전주화산초등학교\condition-lab`

Core values mirrored from Condition Lab:

- app background: `#000000`
- surface base: `#111111`
- raised glass surface: `rgba(17, 17, 17, 0.8)`
- section surface: `rgba(17, 17, 17, 0.68)`
- primary gold: `#D9C54B`
- hover gold: `#ca8a04`
- neutral border: `#262626`
- gold accent border: `rgba(217, 197, 75, 0.4)`
- card radius: `16px`
- control radius: `12px`
- large radius: `24px`
- control height: `48px`
- large control height: `56px`

## 3. Applied Semantic Tokens

Applied in `src/theme/palette.ts`:

- Background
  - `appBackground`
  - `surface`
  - `surfaceRaised`
  - `surfacePanel`
  - `surfaceSection`
  - `surfaceInteractive`
  - `inputBackground`
- Border
  - `borderSubtle`
  - `borderDefault`
  - `borderStrong`
  - `borderAccent`
- Text
  - `textPrimary`
  - `textSecondary`
  - `textMuted`
- Accent
  - `primaryGold`
  - `primaryGoldHover`
  - `primaryGoldLight`
  - `primaryGoldDark`
  - `primaryGoldMuted`
  - `primaryGoldBorder`
  - `primaryGoldBorderStrong`
  - `primaryGoldGlow`
  - `primaryGoldGlowStrong`
- State
  - `success`
  - `warning`
  - `error`
  - `info`
- Radius
  - `radiusSm`
  - `radiusMd`
  - `radiusLg`
  - `radiusXl`
- Layout
  - `controlHeight`
  - `controlHeightLarge`
  - `pagePadding`
  - `sectionGap`
  - `cardPadding`
- Shadow
  - `shadowCard`
  - `shadowPanel`
  - `shadowAccent`
  - `shadowAccentStrong`

## 4. App Shell Changes

Updated app shell and global theme surface language:

- `src/theme/basecampTheme.ts`
- `src/theme/componentOverrides.ts`
- `src/theme/typography.ts`
- `src/components/layout/AppLayout/AppLayout.tsx`
- `src/components/layout/AppHeader/AppHeader.tsx`

Applied changes:

- black application background
- Condition Lab style glass header surface
- neutral border-led sections instead of blue/slate surfaces
- gold accent reserved for active / primary emphasis
- typography weights aligned to the Condition Lab visual hierarchy
- component-level button, input, dialog, chip, and card overrides centralized in theme

## 5. Card Changes

Card language was migrated toward Condition Lab:

- section cards use neutral dark surfaces
- border-led hierarchy is preferred over saturated slate panels
- card radius now follows `radiusMd`
- card shadow now uses centralized semantic shadows
- nested interactive cards use darker interactive surfaces instead of blue-tinted panels

Primary card targets updated:

- member list container
- exercise catalog dashboard stat cards
- recommendation trace card
- snapshot exercise builder rows
- global info card surfaces in `QuickPrintFlow`
- empty/loading/error surfaces

## 6. Button Changes

Condition Lab button language was migrated through theme overrides:

- primary CTA uses gold fill and black text
- outlined buttons use neutral border and restrained hover fill
- focus and hover states use semantic accent glow
- button radius follows `radiusSm`
- button height follows semantic control height

No button behavior or button routing logic changed.

## 7. Input Changes

Input system migration included:

- black input background
- neutral borders
- gold focus border and glow
- consistent medium outlined inputs
- search field control height aligned to Condition Lab large control height
- search field border radius aligned to theme token

Primary targets updated:

- global text field overrides
- search field
- snapshot builder field surfaces
- autocomplete surfaces

## 8. Navigation Changes

Top navigation styling was updated to better match Condition Lab:

- glass header surface
- refined active state emphasis
- gold accent constrained to active/high-priority states
- neutral border and shadow system
- stronger visual separation between header and content

Menu structure itself was not changed.

## 9. Wizard Changes

`QuickPrintFlow` application styling was partially migrated to use the shared token language:

- step indicator now uses Condition Lab neutral/gold surface logic
- selection cards now use token-based surfaces, border, radius, and hover behavior
- recommendation trace card uses Condition Lab section hierarchy
- recommendation result exercise rows use interactive nested surfaces
- snapshot builder nested exercise rows use interactive nested surfaces

Wizard step structure was not changed.

## 10. Feature Card Changes

Feature-facing cards updated in this sprint:

- Member search UI
- Empty state
- Loading state
- Error state
- Member list container
- Exercise catalog dashboard stat cards
- Recommendation trace card
- Recommendation result card nested exercise rows
- Snapshot exercise builder row cards

## 11. Hard-coded Style Reduction Results

Re-audit categories:

### A. Intentionally retained

- `src/theme/palette.ts`
  - design token source values are intentionally hard-coded because this file defines the semantic system
- `src/theme/componentOverrides.ts`
  - a small number of token-adjacent rgba values remain for hover / disabled / backdrop nuances
- `src/components/common/ErrorState/ErrorState.tsx`
  - localized red translucent alert styling remains intentional for severity clarity

### B. Print-only and excluded

- `src/features/printing/styles/print.css`
  - print template colors, borders, and paper surfaces remain intentionally independent

### C. Future migration candidates

- `src/components/layout/AppHeader/AppHeader.tsx`
  - local radius value `3`
- `src/features/master/components/MasterTabs.tsx`
  - local radius value `4`
- `src/features/exercise-catalog/components/ExerciseCatalogStatistics.tsx`
  - local progress bar background and radius values
- `src/features/exercise-catalog/components/ExerciseResolverTestPanel.tsx`
  - local section box radius value
- `src/features/programs/components/ExerciseSortableRow/ExerciseSortableRow.tsx`
  - local radius value
- `src/theme/componentOverrides.ts`
  - a few inline rgba values can be folded further into semantic tokens in a follow-up cleanup pass

### D. Removed or replaced in this sprint

- old blue/slate page and card surfaces used by migrated files
- local search field radius / height values replaced with theme tokens
- member list container hard-coded panel values replaced with theme tokens
- exercise catalog dashboard stat card hard-coded panel values replaced with theme tokens
- snapshot exercise builder row hard-coded panel value replaced with theme token
- empty/loading state surface values replaced with semantic token usage where appropriate
- quick print selection card surfaces migrated to token-based surfaces

## 12. Changed File List

Updated files:

- `src/theme/palette.ts`
- `src/theme/basecampTheme.ts`
- `src/theme/componentOverrides.ts`
- `src/theme/typography.ts`
- `src/components/layout/AppHeader/AppHeader.tsx`
- `src/components/layout/AppLayout/AppLayout.tsx`
- `src/components/common/SearchField/SearchField.tsx`
- `src/components/common/EmptyState/EmptyState.tsx`
- `src/components/common/LoadingState/LoadingState.tsx`
- `src/components/common/ErrorState/ErrorState.tsx`
- `src/features/master/components/MasterTabs.tsx`
- `src/features/members/components/MemberList/MemberList.tsx`
- `src/features/exercise-catalog/components/ExerciseCatalogDashboard.tsx`
- `src/features/printing/components/QuickPrintFlow/QuickPrintFlow.tsx`
- `src/features/printing/components/SnapshotExerciseBuilderRow/SnapshotExerciseBuilderRow.tsx`

Reference reports present in repo:

- `docs/reports/sprint-16-5a-design-system-audit.md`
- `docs/reports/sprint-16-5a-2-condition-lab-exact-ui-comparison.md`

## 13. Regression Check

Regression verification performed:

- `QuickPrintFlow` build-path verified after style migration
- recommendation logic untouched
- route structure untouched
- provider structure untouched
- snapshot save/restore code untouched in this sprint
- print preview flow untouched
- exercise catalog and master screens remain build-safe

The migration was constrained to application UI styling and token usage.

## 14. Build Results

Executed on August 1, 2026:

1. `npm run build`
   - Result: success
   - Vite production build completed successfully
   - Existing large chunk warning remains, but it is not a sprint failure condition

2. `tsc -b`
   - Result: success
   - TypeScript error count: 0

## 15. Remaining UI Differences

Remaining differences after this sprint:

- some low-priority local radius / rgba values remain outside the main shared token path
- `QuickPrintFlow` still contains legacy copy/text strings that should be normalized separately from design migration work
- some secondary screens still use local shape values that should be folded into semantic tokens in a follow-up cleanup sprint
- print-specific styling remains intentionally independent from the Condition Lab application theme

## 16. Sprint Conclusion

Sprint 16-5B completed the main Condition Lab design language migration for BaseCamp application UI while preserving product behavior.

Most visible application surfaces now follow the same neutral-dark, border-led, gold-accented design system as Condition Lab. Remaining mismatches are localized cleanup candidates rather than structural theme gaps.

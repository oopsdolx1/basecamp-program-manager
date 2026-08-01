# Phase 15 Adaptive Periodization Engine

## Architecture

Phase 15 adds a new `periodizationEngine.ts` service in the printing domain and keeps the existing repository, rule engine ownership, AI ownership, snapshot builder ownership, print workflow, and Firestore structure intact.

The execution flow is:

1. `RecommendationProvider` continues to return member profile, workout history, recent workout, and member intelligence.
2. `QuickPrintFlow` derives periodization context from workout history and today's condition.
3. `conditionRecommendationService` applies periodization signals as additional score adjustments while still selecting only existing programs.
4. Snapshot session metadata stores a `periodization` block for downstream preview and history usage.
5. AI receives periodization context in the prompt, but the prompt explicitly keeps rule recommendation ownership final and limits AI to explanation plus snapshot-only adjustments.

## Engine

New file:

- `src/features/printing/services/periodizationEngine.ts`

Responsibilities:

- Detect recent program sequence
- Detect repeated program usage
- Infer current cycle from recent titles and categories
- Estimate recovery trend from recent load and spacing
- Recommend `NORMAL`, `VARIATION`, `RECOVERY`, `DELOAD`, or `RESTART`
- Suggest a next-cycle hint for UI and scoring

## Cycle Analysis

The engine inspects the most recent training titles and categories and maps them into cycle labels such as:

- `Upper`
- `Lower`
- `Push`
- `Pull`
- `Leg`
- `Full`
- `Recovery`

It then computes:

- recent program sequence
- cycle distribution ratio
- inferred current cycle
- next program hint
- weekly frequency

## Plateau

Plateau is detected when the same program repeats 5 times or more.

Recommendation impact:

- same recent program receives a score penalty
- alternate existing programs receive a variation boost

No new program is created.

## Deload

Deload is recommended when sustained load combines with low recovery or a downward recovery trend, or when high weekly frequency combines with low readiness today.

Signals used:

- frequency in the last 7 and 30 days
- aggregate recent set volume
- computed recovery trend
- today's sleep, stress, alcohol, and condition

Recommendation impact:

- `RECOVERY` programs receive a bonus
- `GENERAL` and `BEGINNER` intensity programs receive a bonus
- `ADVANCED` programs receive a penalty

## Trend

Recovery trend is reported as:

- `UP`
- `DOWN`
- `STABLE`

The Step 2 UI now includes a new `Training Trend` card below `Member Intelligence` showing:

- current cycle
- recovery trend
- plateau
- next recommendation
- mode
- deload state
- weekly frequency
- repeated count
- recent program sequence

## Metadata

Snapshot session metadata now stores:

```ts
periodization: {
  currentCycle,
  plateau,
  deload,
  recoveryTrend,
  weeklyFrequency,
  recommendedMode,
  nextProgramHint,
  engineVersion,
}
```

This was added without changing Firestore schema.

## Recommendation Integration

`conditionRecommendationService` now accepts periodization context and applies additive scoring only.

Examples:

- `VARIATION`: penalize the same repeated program and reward alternate existing programs
- `RECOVERY`: boost recovery-oriented programs
- `DELOAD`: boost lower intensity programs and penalize advanced ones
- `RESTART`: bias toward re-adaptation friendly programs

## AI Integration

The AI prompt now includes periodization data, but the system prompt explicitly states:

- rule recommendation is final
- periodization is explanation context only
- AI may adjust the snapshot only
- AI may not create a new program
- AI may not modify any repository or catalog

## Regression Testing

Regression focus for this phase:

- existing recommendation flow still runs without provider changes
- ConditionLab provider remains untouched
- snapshot builder behavior remains intact
- print preview snapshot loading remains intact
- AI recommendation remains optional and non-authoritative

## Build Result

Commands to verify:

- `npm run build`
- `tsc -b`

## TypeScript

Target for this phase:

- TypeScript errors: `0`

# Reliable Set Inputs Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Reliable defaults, editable numeric inputs, parent synchronization, and safe completion without changing workout styling or unit semantics.

**Architecture:** Keep the parent's functional immutable merge as the persisted source of truth. Use keyed input components and one small numeric-draft hook for temporary input; synchronize only when the corresponding parent value changes. Keep units parent-controlled. Record intentional weight clearing with optional local-cache metadata so remounting does not reapply a historical default.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library; no new dependencies.

**Spec:** User's ten-part SetInProgress request in this session; user authorized proceeding with blank weights allowed.

## Global Constraints
- Preserve start → stop → results → complete → next-set behavior and existing CSS classes.
- Blank weight is allowed; reps/distance are required for their respective completion flows.
- Zero is valid; reps must be integers; weight/distance may be decimals; all numbers must be finite and nonnegative.
- Unit changes relabel values; no conversion.
- No broad union/schema rewrite, unrelated lint cleanup, commits, or pushes.

## Review Focus
- Restoring cleared weight must not bring back history defaults.
- Parent changes must replace stale drafts without ordinary rerenders discarding edits.
- Invalid drafts must not complete using the last saved valid value.
- Enter repeats, blur, and button clicks must not duplicate completion or submit enclosing forms.
- Missing, malformed, or future start times must not produce invented durations.

### Task 1: Keyed, synchronized, validated result inputs

**Files:** `src/components/SetInProgress.tsx`, `src/types/gym.ts`, `src/__tests__/setInProgress.test.tsx`, `src/__tests__/setInProgressState.test.tsx`.

**Interfaces:** Preserve SetInProgress props and onUpdate signature. Optional `WeightRepSet.weightCleared?: boolean` distinguishes an explicit clear from legacy unset/null values in the local cache. Add internal `useNumericDraft(value, onChange, integer)` returning draft input handlers, parsed value, and validity.

- [x] Add tests for set switches, parent updates/restores, defaults and explicit clears, partial update payloads, label-only unit changes, and invalid/zero/decimal values.
- [x] Run `npm test -- src/__tests__/setInProgressState.test.tsx`; confirm new regressions fail for expected reasons.
- [x] Implement keyed children, shared numeric drafts, controlled units, and field-specific updates; preserve explicit cleared weights across remounts.
- [x] Run focused tests; confirm passing.

### Task 2: Completion and timer safety

**Files:** `src/components/SetInProgress.tsx`, `src/__tests__/setInProgress.test.tsx`, existing parent lifecycle tests as needed.

**Interfaces:** Shared internal completion hook guards valid input, Enter default/repeat behavior, and duplicate completion. Keep parent `updateSet` functional merge unchanged unless a regression demonstrates a defect.

- [x] Add tests for Complete Set button, invalid completion, blur without updates, Enter prevention/repeat/duplicates, all modes, and invalid/missing/future timestamps.
- [x] Observe failing tests before implementation.
- [x] Add existing-style Complete Set buttons, shared completion handling, safe Stop guards and timer rendering; remove unsafe timestamp assertions.
- [x] Run focused and lifecycle tests; confirm passing.

### Task 3: Verify and review

- [x] Run `npm test`, `npm run build`, changed-file ESLint, full lint, and `git diff --check`.
- [x] Read-only review of changes and connected lifecycle; address substantive findings.
- [x] Summarize checks, design choices, and any remaining limitations. Leave changes uncommitted.

## Execution record
- Worked inline on the existing requested feature branch, preserving the earlier uncommitted fix and unrelated `.opencode/` directory.
- Tasks 1–2 share input validation/completion state; exercised together before implementation: 33 expected failures in 38 initial cases, then green after the refactor.
- An additional invalid-draft/unit-change regression failed before its fix; it now passes.
- Parent merging/cache regression characterizes existing correct behavior; no production parent or storage changes were needed.
- Final review found one missing explicit-clear update when both the saved weight and blank draft were null. Added a delayed-history regression, observed RED, delivered explicit valid blank changes through the numeric hook, and verified GREEN with the entire suite.
- Review boundary: physical mobile/browser partial-number behavior remains untested; no timer repair flow, union/schema redesign, or backend-limit changes were added because these were outside the requested lifecycle fix.
- Verification: 110/110 tests pass; TypeScript/build, changed-file ESLint and whitespace checks pass. Vite retains existing chunk-size/mixed-import warnings. Full lint reports 90 errors/87 warnings in unrelated virtualenv dependencies, AuthContext, scripts, and existing hook warnings.

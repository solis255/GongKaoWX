source visual truth path: `design/screens/*.png`

verification environment: WeChat Developer Tools Nightly 2.02.2606172, iPhone 12/13 (Pro), 390 × 844 class viewport

rendered routes inspected: home, bank module mode, bank mixed mode, practice setup, question, wrong answers, profile, daily goal

functional routes covered by automated structure tests: all 12 registered pages

**Findings**

- No P0/P1/P2 rendering issue remained in the inspected routes.
- The home, bank, wrong-answer and profile content begins below the WeChat capsule.
- The question and custom-header pages also reserve the capsule area.
- Mixed practice renders a distinct selection state and a distinct setup screen.
- New-user counters render as zero instead of demo values.
- Wrong-answer legacy data renders without contradictory demo counts.
- Daily-goal controls and the 1–200 input path render correctly.

**Automated evidence**

- Full Node test suite: 65 passed, 0 failed.
- Question banks: six banks, 360 questions valid.
- JavaScript syntax checks: app, services, components and all pages passed.
- Alternate-timezone progress test: passed under `America/Los_Angeles`.

**Follow-up polish**

- Production icon assets may replace the current minimal text-first navigation marks later; this is visual polish, not a functional blocker.

patches made since the previous QA pass: dynamic safe area, real user-progress data, mixed practice, daily goal, favorites, per-question history, wrong-answer empty states, and corrected statistics/navigation.

## 2026-06-20 question review navigation pass

- Added a registered question-card route with current/correct/wrong/locked states.
- Question header uses the measured horizontal capsule clearance for the card action and an independently centered number.
- Analysis content now uses a full-height `scroll-view` with bottom action clearance; long stems, options and explanations are no longer clipped.
- Existing JSON `sourceRefs` render as an expandable list and copy local URLs without web search.
- Profile metrics now expose three separate tap targets.
- Developer Tools compiled all 13 pages with zero reported problems. Automated structure and session navigation tests cover the new route and locked-state behavior.

final result: passed

## 2026-06-20 question header and toolbar pass

- Verified in WeChat Developer Tools Nightly 2.02.2606172 using the iPhone 12/13 (Pro) simulator.
- The question header now keeps only a circular back/previous control and an independently centered question number below the WeChat capsule.
- The question-card action is available from the bottom toolbar on both the question and analysis pages.
- The analysis page uses the shared circular back UI and renders the return/card/next controls without overlap.
- Home and wrong-answer pages now derive wrong counts only from answer events; a user with no answer events starts with zero wrong answers, regardless of legacy wrong-ID storage.
- No P0/P1/P2 issue remained in the inspected question and analysis routes.

final result: passed

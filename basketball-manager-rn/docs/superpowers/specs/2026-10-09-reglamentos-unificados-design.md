# Unified Ruleset Catalogue — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give both apps one shared, data-driven catalogue of three rulesets — Pasarela 8P, Pasarela 6P and Libre 4P — read from a single team field. Adds the standard-basketball option the web lacks, and fixes the mobile bug where choosing "Pasarela 6P" still draws an 8-period matrix.

**Architecture:** `team.rulesetId` becomes the single source of truth, resolved through a catalogue that both clients carry in the same shape. The legacy mobile field `team.mode` is read as a fallback and never written again, so no data migration is needed. A `freeSubstitutions` flag marks Libre, short-circuiting all Pasarela validation and gating the mobile's live timer.

**Tech Stack:** React Native / Expo SDK 55 (`src/constants/ruleset.js`, `MatchMatrixScreen`, `TeamDetailScreen`, `useMatches`) and the vanilla-React web app (`basketball-manager/index.html`). No new dependencies.

---

## The problem this fixes

The same concept is stored in two different fields that neither client reads from the other:

| | Field | Values | Model |
|---|---|---|---|
| Mobile | `team.mode` | `pasarela`, `pasarela6`, `libre` | Bare enum, hardcoded `if` branches in the screen |
| Web | `team.rulesetId` | `fbcv_8p`, `fbcv_6p` | Data-driven catalogue (`index.html:385-404`) |

Three consequences today, before any change:

1. **"Pasarela 6P" does nothing on mobile.** `MatchMatrixScreen.js:146` computes `basePeriods = isLibre ? 4 : DEFAULT_RULESET.totalPeriods`, which is always 8, and validation uses the 8-period constants throughout. A coach who picks 6P gets an 8-period matrix validated by 8-period rules.
2. **The web has no Libre option**, so standard 4-period basketball with free substitutions cannot be recorded there at all.
3. **The two apps disagree** about any team whose ruleset is not the default: a team created on the web carries `rulesetId` and no `mode`, so mobile falls back to Pasarela 8P; a team configured on mobile carries `mode` and no `rulesetId`, so the web falls back to `fbcv_8p`.

---

## Decisions taken during design

| Question | Decision |
|---|---|
| Which field wins? | `rulesetId`. The web's model is data-driven; the mobile's enum needs a catalogue anyway to mean anything, so adopting it would land in the same place with a worse name. |
| Migrate existing data? | No. Read `rulesetId`, fall back to a mapped `mode`, write only `rulesetId`. Old teams keep working and convert themselves when next edited. |
| How is Libre expressed? | An explicit `freeSubstitutions: true` flag, not an interpreted `checkPeriod: 0`. Validation short-circuits on the flag. |
| Does the web get the live timer? | No. The timer and per-player minutes stay mobile-only — it is operated during the game with the phone in hand. The web's Libre is 4 periods with no validation. |
| Is the timer removed from mobile? | No. It works, it is tested, and the federation API cannot supply minutes as a substitute (see below). |

**Why the timer has no alternative:** a read-only probe of the FBCV API established that the project's token returns `ACCESS DENIED` for every method beyond `FCBQWeb/getTeamCard`, `FCBQWeb/resultats`, `FCBQWeb/fitxaPartit` and `Team/getDisplayModeStats`; and that even an allowed match card (`fitxaPartit/65938`, a senior fixture) carries `idRecord: null`, `partials: null` and null per-quarter scores, meaning no digital match record was ever filed. There are no per-player minutes to download.

---

## Section 1 — The catalogue

One object, carried in the same shape by both clients. Mobile keeps it in `src/constants/ruleset.js`; the web keeps it in its existing `RULESETS` constant.

| id | Name | totalPeriods | checkPeriod | minPlay | maxPlay | minRest | freeSubstitutions |
|---|---|---|---|---|---|---|---|
| `fbcv_8p` | Pasarela 8 periodos | 8 | 6 | 2 | 4 | 2 | `false` |
| `fbcv_6p` | Pasarela 6 periodos | 6 | 5 | 2 | 3 | 2 | `false` |
| `libre_4p` | Libre 4 periodos | 4 | — | — | — | — | `true` |

`fbcv_8p` and `fbcv_6p` keep exactly the numbers the web already uses (`index.html:386-403`); `fbcv_8p` also matches the mobile's current `DEFAULT_RULESET`. Nothing about existing Pasarela behaviour changes.

For `libre_4p` the Pasarela fields are absent rather than zero. Any code that reads them must check `freeSubstitutions` first.

The default for a team with neither field is `fbcv_8p`, which is what both apps already fall back to today.

---

## Section 2 — Resolving a team's ruleset

A single resolver in each client, and the only place the legacy field is ever read:

```
resolveRuleset(team, match):
    id = match?.rulesetId
      || team?.rulesetId
      || LEGACY_MODE_MAP[team?.mode]
      || 'fbcv_8p'
    return CATALOGUE[id] || CATALOGUE['fbcv_8p']
```

`LEGACY_MODE_MAP` is `{ pasarela: 'fbcv_8p', pasarela6: 'fbcv_6p', libre: 'libre_4p' }`.

An unknown id falls back to `fbcv_8p` rather than throwing, so a ruleset added later to one client cannot break the other.

**`match.rulesetId` wins over the team's.** The web already does this (`index.html:1993`), and it is the correct behaviour: changing a team's ruleset mid-season must not retroactively re-validate matches already played under the old one. The mobile does not yet snapshot it — Section 4 adds that.

**Writes:** both clients write `rulesetId` only. `mode` is never written again. It is left in place on existing documents, harmless, and stops being consulted once a team is saved.

---

## Section 3 — Making the mobile data-driven

This is where the bug lives and where most of the work is.

`src/constants/ruleset.js` already takes a `ruleset` argument in `validatePlayerSelection` and `getPlayerStatusClasses` — the plumbing exists, nothing passes a real value. The file gains `RULESETS`, `LEGACY_MODE_MAP` and `resolveRuleset`, and keeps exporting `DEFAULT_RULESET` as an alias of `RULESETS.fbcv_8p` so nothing breaks mid-change.

`MatchMatrixScreen` has **eleven** direct uses of the constant, plus the import at line 25 (lines 146, 198, 463, 508, 599, 601, 606, 607, 608, 609, 610). Each becomes a read from a single `ruleset` resolved once near the top of the component. Specifically:

- `:145` `const isLibre = team?.mode === 'libre'` → `ruleset.freeSubstitutions`. All **fifteen** lines that branch on `isLibre` — the timer, the minutes column, the column widths, the `Min`/`Tot` header — keep working unchanged, now driven by the catalogue.
- `:146` `basePeriods = isLibre ? 4 : 8` → `ruleset.totalPeriods`. **This single line is the 6P bug.**
- `:198`, `:463`, `:508`, `:599-610` → the resolved ruleset's fields.

`TeamDetailScreen`'s "Modo de partido" selector keeps its three options and its labels, but its keys become catalogue ids and it writes `rulesetId`:

- `:204` seeds the form from `team.rulesetId || LEGACY_MODE_MAP[team.mode] || 'fbcv_8p'`
- `:215-216` write `rulesetId` instead of `mode`

---

## Section 4 — Snapshotting the ruleset on new matches

`useMatches.addMatch` (`src/hooks/useMatches.js:54-71`) builds `newMatch` without a ruleset. It gains `rulesetId: <the team's resolved id>` so that a match records the rules it was played under.

Existing matches have no `rulesetId` and therefore fall through to the team's — the same behaviour as today. Nothing retroactive.

The web already sets `rulesetId` on matches it creates and needs no change here.

---

## Section 5 — The web

Smaller, because the model is already right.

- Add `libre_4p` to `RULESETS` (`index.html:385`) with `freeSubstitutions: true`.
- Add `freeSubstitutions: false` to the two existing entries, so the flag is always present.
- Add the `LEGACY_MODE_MAP` fallback where the ruleset is resolved (`:1993`), so teams configured on mobile are honoured.
- Short-circuit the validation block (`:2174-2216`) when `freeSubstitutions` is set: no period-count errors, no checkpoint warnings, no rest requirements. The matrix still renders and still enforces the five-on-court cap, which is a rule of basketball, not of Pasarela.
- Add "Libre 4 periodos" to the ruleset selector on team creation (`:3083`).

The web does not get the timer, the minutes column, or any way to edit a team's ruleset after creation — that last one is out of scope and unchanged from today.

---

## Section 6 — Errors, edge cases and verification

**A match in progress when the ruleset changes.** Matches created from now on snapshot their ruleset, so they are unaffected. A match created *before* this change, on a team whose ruleset is then changed, will re-render under the new rules. This is the existing behaviour on both clients and is not made worse; the snapshot stops it recurring.

**A ruleset with fewer periods than already played.** Switching a team from 8P to 4P when a match already has entries in periods 5-8 must not lose them. Both clients already render `Math.max(ruleset.totalPeriods, currentPeriod)` (`index.html:1998`) or equivalent; the mobile adds the same guard. Extra periods render beyond the nominal total rather than being hidden.

**Unknown or missing ids** fall back to `fbcv_8p` silently.

**Verification is manual.** The project has no test suite or linter. Checklist:

1. Mobile, team set to Pasarela 6P: the matrix draws **6** periods and validates with maxPlay 3 at checkpoint 5. This is the bug; confirm it is fixed.
2. Mobile, Pasarela 8P: unchanged from today — 8 periods, checkpoint 6, maxPlay 4.
3. Mobile, Libre: 4 periods, no validation colours, timer and minutes column still work.
4. Web, each of the three rulesets: correct period count; Libre shows no Pasarela errors.
5. Set a team's ruleset on mobile, open the same team on the web: both show the same reglamento. Then the reverse.
6. An old team with only `mode` and no `rulesetId`: both apps honour the mapped ruleset.
7. Open a match played before this change: periods and validation unchanged.
8. Create a match on mobile, check `matches/{id}.rulesetId` is written in Firestore.
9. A team with matches in periods 7-8, switched to Libre 4P: those periods still render, nothing is lost.

**Rollback.** Four files, no schema change, nothing written that the old code cannot ignore — old clients keep reading `mode`, which is still there. Reverting the commits is sufficient.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `basketball-manager-rn/src/constants/ruleset.js` | Modify | `RULESETS`, `LEGACY_MODE_MAP`, `resolveRuleset`; keep `DEFAULT_RULESET` as an alias |
| `basketball-manager-rn/src/screens/MatchMatrixScreen.js` | Modify | Resolve once; replace the ten constant uses and the `isLibre` definition |
| `basketball-manager-rn/src/screens/TeamDetailScreen.js` | Modify | Selector writes `rulesetId`; form seeds from the resolver |
| `basketball-manager-rn/src/hooks/useMatches.js` | Modify | Snapshot `rulesetId` on new matches |
| `basketball-manager/index.html` | Modify | Add `libre_4p`, the `freeSubstitutions` flag, the legacy fallback, the validation short-circuit and the selector option |

---

## Out of scope

- **Removing `team.mode` from Firestore.** Left in place deliberately as the fallback for clients that have not updated. A cleanup once every client writes `rulesetId`.
- **Editing a team's ruleset on the web after creation.** Not possible today; unchanged.
- **Per-ruleset period duration.** The mobile's timer normalises to a hardcoded 10-minute period (`MatchMatrixScreen.js:283`). Making that a catalogue field is a sensible follow-up but is not needed for any of the three rulesets here.
- **Syncing players from the federation.** A separate piece of work. The probe behind this design established it is feasible via `getTeamCard`, which returns a `players[]` array; the agreed scope there is to import **name and `idFederated` only** and to persist none of the `nif`, `passaport`, `birthDate`, `catsalut`, address, phone, email or photo fields that the same payload carries.

---
name: aip-accessibility
description: 'Make and prove AI Platform pages accessible to WCAG 2.2 AA (GOV.UK requirement): POUR principles, the criteria most often broken on GOV.UK-style pages (with correct numbers), automated axe scans with reflow and no-JavaScript checks via a bundled script, the manual keyboard, zoom, text spacing and screen-reader checks automation cannot do, and how to report evidence. Use when building or reviewing any page, form or component, or testing accessibility.'
license: OGL-UK-3.0
---

# Accessibility (WCAG 2.2 AA)

GOV.UK requires [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) and both automated and manual testing ([testing for accessibility](https://www.gov.uk/service-manual/helping-people-to-use-your-service/testing-for-accessibility)). Automated tools find only a minority of issues; never report "accessible" from axe alone.

## Build it right (most common failures)

| Criterion                    | Check                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text content       | Meaningful images have alt text; decorative ones `alt=""`                                    |
| 1.3.1 Info and relationships | Real headings in order, labels tied to inputs, `fieldset`/`legend` for groups, table headers |
| 1.4.3 / 1.4.11 Contrast      | Text 4.5:1; focus indicators and control borders 3:1 (keep GOV.UK focus styles)              |
| 1.4.4 Resize text            | 200 percent text zoom without loss                                                           |
| 1.4.10 Reflow                | Usable at 320 CSS px wide (400 percent zoom) without horizontal scrolling                    |
| 1.4.12 Text spacing          | No clipping with increased line, letter and word spacing                                     |
| 2.1.1 / 2.1.2 Keyboard       | Everything works by keyboard, no traps                                                       |
| 2.4.1 / 2.4.2                | Skip link; unique, descriptive page title                                                    |
| 2.4.3 / 2.4.7 / 2.4.11 Focus | Logical order, always visible, never hidden behind sticky content                            |
| 2.4.4 / 2.4.6                | Link text makes sense alone; headings and labels describe purpose                            |
| 2.5.8 Target size            | Targets at least 24 by 24 CSS px                                                             |
| 3.2.6 Consistent help        | Help and contact in the same place on every page                                             |
| 3.3.1 to 3.3.3 Errors        | Error summary plus inline message saying how to fix                                          |
| 3.3.7 / 3.3.8                | Do not ask again for what was entered; sign-in needs no memory or puzzle test                |
| 4.1.2 / 4.1.3                | Custom controls expose name, role, value; status updates announced                           |

Use GOV.UK Design System components unchanged: they already meet most of these.

## Prove it

1. **Automated** (evidence for each new or changed page, running locally):

   ```powershell
   node <this skill>/scripts/axe-scan.mjs http://localhost:3000/<path> [more urls] [--no-js] [--out <run>/gates/axe.json]
   ```

   Runs axe with WCAG 2.0 to 2.2 A and AA rules, plus a 320 px reflow check; `--no-js` repeats without JavaScript. Needs Playwright and `@axe-core/playwright` from `ai-platform-discovery-docs` (`npm ci` there once) or `AIP_AXE_FROM=<dir>`. Signed-in pages: use the browser tool after signing in with the mock OIDC provider.

2. **Manual, by the agent with the browser tool:** tab through the journey (order, focus visible, no trap, skip link), submit with errors (summary focus, links jump to fields), 320 px width, no JavaScript.
3. **Manual, by a person** (mark `NEEDS HUMAN`, never "pass"): screen reader (NVDA or JAWS, VoiceOver), voice control, magnifier, text spacing bookmarklet. A full audit is needed before public beta.

## Report

One line per page in `review.md`: `{url} axe {PASS|n issues} reflow {ok|fail} no-js {ok|fail} keyboard {ok|issue} NEEDS HUMAN: screen reader`. Each issue: criterion number, element, what happens, who it affects.

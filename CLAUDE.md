# Playbook CBP — project instructions

> **Guía (ES):** archivo en inglés para gastar menos tokens. Secciones: 1 Reglas permanentes · 2 Protocolo según tamaño · 3 Contexto · 4 Modelos y esfuerzo · 5 Cierre. Las reglas de rama, pruebas sin base de datos y estilo sin narrar viven en la memoria, no aquí.

App for Club Baloncesto Palencia. Functional spec: `ESPECIFICACION-v2.1.md` (wins over any assumption). Progress log: `PROGRESO-PIZARRA.md`.

## 1. Permanent rules

- **Spanish output**: replies, code comments, test names, commit messages and reports are in Spanish.
- **Verify before done**: every pure module has a test bank (`eval-*.mjs`) in `tools/`, `taller/tools/` or `equipos/tools/`, run with `node <path>`. All must be green before finishing anything.
- **Report what doesn't fit; don't fix it on your own.**
- **Don't invent requirements.** If a decision matters and can't be inferred from code or spec, ask.
- **Minimal changes**: touch only what's needed. Keep existing design and behavior. Reuse existing components and patterns; don't duplicate logic. No new dependencies unless necessary. Don't remove features without asking. Before editing, check what depends on it.
- My explicit requirements outrank your suggestions.

## 2. Protocol by change size

Applies to any modification, improvement, new feature or bug fix.

**Small** (copy, CSS, clear localized bug, no data or logic side effects): inspect, do it, run the relevant banks, report in 3-4 lines (what changed, tests green).

**Medium, large or uncertain** (logic, data/DB, several files, ambiguity). If unsure of the size, treat it as this:
1. Understand: what is asked, what must be found out, side effects, edge cases, undefined design/UX decisions.
2. Ask with AskUserQuestion (options, small related batches). Only what can't be deduced.
3. Inspect the code: components, data, APIs involved; reusable code; partial solutions to modify instead of building parallel ones.
4. Suggest improvements only if relevant to this change; brief; never apply without my approval.
5. Give a very brief plan (files, logic, new elements, data/DB, what stays untouched, how it will be verified, side effects to review) and ask whether to proceed. Don't execute before I confirm, unless I say otherwise.
6. Execute. If the approved plan must change substantially, stop and consult.
7. Verify: feature works, banks green, related features intact, no console errors, visual coherence, data saves/loads/updates, loading/empty/error states, key edge cases. Fix problems that belong to the same change.

## 3. Context

- Never read `ESPECIFICACION-v2.1.md` or `PROGRESO-PIZARRA.md` whole (~45k and ~22k tokens). Grep first, then read only the relevant section.
- Same for any large file: search, then read ranges.
- Don't re-read files already read or just edited.

## 4. Models and effort

The app blocks changing this session's model or effort, so:
- Before a task, if the current model or effort is clearly wrong for it, say so in one line (routine: Sonnet, medium; hard logic such as the Pizarra engine or algorithms: Opus, high) so I can switch in the model menu.
- Hard, isolated logic: propose delegating it to a subagent with `model: "opus"` and a self-contained brief (goal, files, constraints, banks to run). Launch it only after I say yes.

## 5. Closing

When a step or task closes: update `PROGRESO-PIZARRA.md` concisely, then suggest opening a new session before the next task.

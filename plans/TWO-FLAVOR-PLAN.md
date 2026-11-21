# Quest Lab — two faithful flavors and prompt-created adventures

**Implementation proposal, 21 November 2026. Owner: Loom.** This is the next-batch plan, not a claim that the conversion has been built. The current public release is v0.5.2. The intended product is a personal game and creation laboratory, playable locally on Windows and in an Android browser, with offline content and prompt-driven editing handled here.

## 1. The outcome

Deliver two independently qualified presets:

| Preset | Gameplay authority | Player experience |
|---|---|---|
| **VGA 1992** | The selected VGA edition's scripts, rules, sequences and documented deviations | Point-and-click verbs, inventory targeting and its original conversation behavior |
| **EGA 1989** | The selected Hero's Quest edition's scripts, vocabulary, rules and sequences | Typed actions and typed conversation subjects, with original movement/combat semantics |

These are **two edition packages, not a mouse/keyboard toggle over one story**. Share mechanics only when comparison proves they agree. Preserve edition-specific puzzles, topics, schedules, prices, skill checks, encounters, endings and failure behavior. A fact verified in VGA is not automatically an EGA fact.

Presentation is a separate choice. Both can eventually use modern paintings while retaining their edition's gameplay and spatial contracts. Do not impose EGA's original palette merely because the input is typed. Keep reference artwork selectable. Modern graphics, convenient save tools and phone controls are permitted presentation changes; changing clues, exposing undiscovered topics, rebalancing combat or skipping sequences requires an explicit, versioned deviation.

Retain the **Original** reference players separately. They remain original programs running in js-dos/DOSBox, not proof that the editable flavors are complete. Keep their saves separate from remake saves.

### Player promise and first screen — Meridian's product review

The product promise is: **play either classic adventure style from beginning to end, then ask for a new adventure that fits the world and works as a complete game.** Fidelity, usable phone controls and complete authored experiences are separate obligations.

The proposed play home has **Continue**, **New game** and **My adventures**. Continue resumes the exact edition/adventure campaign. New game presents “VGA — point and click” and “EGA — typed commands” equally clearly. Suggest VGA initially for mouse/touch convenience, then remember the player's choice; this is a proposed default, not a priority reduction for EGA. Put Lab and Original reference games in a secondary area. Keep backend selection, Source Preview terminology and diagnostics out of ordinary play.

Each edition shows a short **What changes?** statement: source baseline, presentation/device adaptations, named gameplay differences and current readiness. Choose artwork after edition, with a preview. Use qualified reference art as the development fallback; modern art becomes the play default only after the intended presentation passes. A painting must preserve clues, object identity and usable routes, not merely match quest flags. New story/puzzle rules belong to a named adventure variant. Missing content gets one guided install path with progress and recovery.

The creation journey is **request here → draft adventure card → playable preview → activate in a campaign → revise or restore**. The card states premise, editions/classes, intended play length, entry/ending, art scope and readiness. It is a clear scope summary, not another mandatory approval form; ordinary implementation choices and routine repair stay with me. Schemas and traces are advanced Lab inspection, not work Tal must perform.

## 2. What exists and what must change

Current evidence: 100 imported VGA room definitions, 1,553 extracted interaction cases, 168 native campaign rules, and source-timed presentation enabled in rooms301,311,314. These are different counting units, not a completion percentage. v0.5.2 adds six explicit view contracts, three targeted painting geometries, reversible creation points and accessible imports/version information. Forty regression commands and 23 published-file checks pass. Actual browser probes cover the scoped fixes; physical Android and complete ordinary campaigns remain unqualified.

Keep the useful work: Lab shell, content revisions, preserved originals, asset library, validated import/export, renderer experiments and known reproductions. Preserve v0.5.2 as a working checkpoint. Stop treating a connected background or passing prepared fixture as a finished original scene.

The central correction is **one authority for gameplay changes, and one resolved description of the active scene**. Presentation must no longer independently decide quest flags, permitted actions or when a transaction has succeeded.

## 3. Source and flavor baselines

Create an immutable manifest per edition containing game/resource checksums, interpreter/game version, language, decompiled-script repository commit, script hashes, vocabulary/messages, engine/patch configuration and provenance. Match source to the actual local game data; filenames and an edition label are insufficient.

The existing VGA manifest identifies `qfg1vga-dos-2.000` and source commit `870a8015b689474484bf3d8b41416956d4315432`. The EGA reference comes from the PCjs disk set Tal selected. Its exact matching script version still needs qualification. The public decompilation repository contains separate EGA DOS1.000,1.001,1.102,1.200 and VGA2.000 candidates. That confirms useful source availability, not that every candidate matches our disks or is a complete runnable game. [Source repository and usage guidance](https://github.com/sluicebox/sci-scripts/blob/main/README.md), [EGA1.000 candidate](https://github.com/sluicebox/sci-scripts/tree/main/qfg1-dos-1.000), [VGA2.000 candidate](https://github.com/sluicebox/sci-scripts/tree/main/qfg1vga-dos-2.000).

Produce an **edition difference ledger**: canonical location/quest, edition source IDs, commands/verbs, text, prerequisites, consequences, timing, geometry and evidence. Classify each entry as source-derived, observed in Original, inferred, unsupported or intentionally changed. Unknowns stay visible.

Decide a patch policy explicitly: original bugs preserved, or named fixes accepted. ScummVM workarounds can alter behavior; an interpreter with patches is not automatically an identical oracle to the selected DOS executable.

## 4. Behavior architecture and the early decision gate

**Preferred authoring model:** a typed, deterministic state engine with separately compiled edition behavior packages and inspectable source references. Retain current native mechanics only after qualification; remove room-specific story decisions from the large UI host. Do not keep adding unrelated special cases in `main.ts`.

Before committing the whole port, compare three bounded options:

| Option | Benefit | What must be proved |
|---|---|---|
| Native/compiled behavior packages | Direct extension authoring, headless tests, control over mobile presentation | Stateful source sequences, parser semantics, timing and conditional effects survive conversion; no missing branch becomes a fabricated refusal |
| Complete the existing SCI execution backend | Original object/script behavior can remain authoritative | Actual unsupported operations, SCI0 versus SCI1.1 compatibility, saves, timers, renderer handoff and extension compilation are manageable |
| Reuse/instrument a mature SCI engine | Avoid recreating an interpreter | Supported browser build, useful state/input/render boundaries and an authoring path really exist; no dependence on guessed memory offsets |

The existing js-dos player is already useful as a reference. It is not a demonstrated high-resolution render/extension API. ScummVM documents a WebAssembly build path, but that does not establish a ready Phaser integration or our required extension hooks. Treat that as a feasibility spike, not an available feature. [Official WebAssembly build documentation](https://github.com/scummvm/scummvm/blob/master/dists/emscripten/README.md).

**Backend gate:** demonstrate creation, a connected persistent quest, a timed NPC service, save/reload during a sequence, one edition-specific parser/dialogue case, a painted scene with correct masks, and a tiny compiled extension. Compare against Original/source. Select the credible route using measured behavior, unsupported-operation count and integration cost. Both reviewers favored a deterministic native authoring path, but their advice is not a substitute for this proof. Do not reject or approve an interpreter based on an untested assertion about its flexibility.

Exactly one backend owns a flavor's world state. No partial SCI execution followed by silent native fallthrough. Unsupported required semantics block that flavor's fidelity gate; they do not become a plausible-sounding “you cannot do that” line. A genuine original refusal is a valid, separately sourced result.

### Runtime boundary

```text
Edition package + versioned extension packs
                    ↓
mouse / touch / typed input → edition intent resolver
                    ↓
       authoritative engine: submit / advance / save
                    ↓
       world state + semantic events + resolved scene
                    ↓
       Phaser view, sound, dialogue and input targets

Original reference + source evidence → independent loop oracle
                                     ↓
                      engine and rendered comparisons
```

The boundary exposes proposed operations such as `submitIntent`, `advanceTicks`, `describeScene`, `drainEvents`, `save` and `restore`. These are interfaces to implement, not APIs claimed to exist today. Timers, random draws and asynchronous presentation acknowledgements are explicit inputs with sequence IDs. A renderer may report that a movement/animation completed; the engine validates the expected actor, phase, room and scene epoch before committing an effect.

## 5. How all gaming information is kept

Use canonical IDs such as `spielburg.guild`, mapped to each edition's actual room/script IDs. Allocate extension source IDs through the selected backend's supported range; never assume source numeric IDs match between editions.

| Content | Required information |
|---|---|
| Edition profile | Exact baseline, parser/icon semantics, time/skill/combat policies, source coordinate space, approved deviations |
| Room | View type, entry/exit scripts, active objects, local variables, interactions, geometry references, source provenance |
| Actor/object | Stable ID, presence conditions, position/foot anchor, approach rules, animation, verbs and lifecycle |
| State sequence | States, events, guards, timers, effects, interruptions, resume behavior and terminal states |
| Dialogue/parser | Speaker/topic prerequisites, replies/effects; EGA vocabulary and Said-style grammar/context; VGA topic visibility/order |
| Quest | Milestones, alternative solutions, cross-room dependencies, rewards, failure/recovery and ending effects |
| Geometry/art | Coordinate transform, walk boundaries, triggers, hotspots, depth/occlusion, layers, anchors, asset identity and review status |
| Gameplay loop | Preconditions, real player inputs, oracle assertions, room crossings, persistence checks, failure branches and evidence |

Room state is not an isolated list of pictures. It combines local state with world inventory, flags, time, skills, actors and running sequences. For example, ordering coffee starts a service sequence; drinking is permitted only after the correct delivery; changing rooms cancels stale callbacks. The same state must govern its visible prop, conversation offer, allowed action and outcome.

Compile a `ResolvedScene` from authoritative state: view/camera, visible entities, permitted discovery paths, walk regions, passages, interactions, dialogue and render layers. Rendering and hit testing consume that description. EGA's presentation must not reveal a hidden list of subjects just because the resolver knows them.

Keep typed original behavior and extension authoring in the same engine model. Extensions normally use declarative conditions, effects, sequences and registered mechanics. A prompt that needs a genuinely new mechanic produces a scoped engine capability change with tests; it is not silently reduced to the current verb list or executed as unrestricted runtime-generated code.

## 6. Scene, movement and layering contract

Make view type explicit: world, close-up, minigame, combat or cinematic as required by the qualified edition. A close-up board has no world actor, shadow or free walking. A game board may have its own hand/racer actor without spawning the walking hero.

For each art variant, store the art fingerprint, source-to-logical transform, walkable outer boundary and holes, trigger regions, approach points, hotspots, foreground masks, depth anchors, scale policy and reviewed examples. Do not hardcode the current VGA `320×190` conversion across EGA; qualify each edition's game viewport and pixel aspect. Modern presentation can remain1440×1080/4:3 while transforming all geometry consistently.

Distinguish four checks: the destination is walkable; every path segment is valid; the target can be reached within the original approach rule; the transition/action is allowed by current state. Reaching a padded click zone is not proof of any of those. A blocked/cancelled path never commits its pending door or item action.

Background art, walk masks, occluders and click targets are separate assets/data. Depth sorts by the actor's ground contact, with source-defined overrides where appropriate. Hero and shadow share the appropriate occlusion depth; they do not need identical shapes. Visual and input masking agree. Changing art invalidates its geometry review, including when the same filename's bytes change.

Verify a small matrix in every affected scene: blocked roof/wall, open ground, narrow gap, object approach, behind/in-front occluder, door outside/inside, exit/return and relevant state changes. Inspect actual movement, stops, direction changes and interaction/combat poses in the game, not just still-image bounds.

## 7. Gameplay loops: the main verification unit

A loop is a meaningful player journey across rooms that changes the world and proves the payoff persists. It is not a reducer-generated list of actions, a single screenshot, or every possible global-state combination.

Each loop records:

1. Stable ID, edition/class, source/resource hashes, engine/content/art/scenario fingerprints, required capabilities and coverage targets.
2. Setup provenance: fresh earned prefix, earned checkpoint, prepared fixture or debug injection. Normal release routes prohibit grants/teleports/Win shortcuts after a fresh start.
3. Source/Original oracle: what should happen and why, including exact qualified parser strings, milestones, messages, inventory/currency/skill changes, room destinations and timing ranges.
4. Semantic actions and independent real-input recipes: click visible target/verb/item for VGA; submit the qualified command for EGA; movement/approach/waits as needed.
5. Assertions after consequential steps, including what must **not** change on a failed attempt, and which visible feedback/affordances should appear.
6. Revisit, save/reload, interruption, repeat/reward-once and failure/recovery cases.
7. Expected branches and a final outcome. Receipts retain failures, screenshots at meaningful checkpoints, compact event traces and observed versus expected state.

Example loop family: **buy food → leave town → meet Brauggi → offer food → obtain gem → revisit and save/reload**. For the inspected VGA reconstruction,50fruit is the current source-backed requirement. EGA quantities, exact commands, exchange behavior and rewards must come from its matched baseline; do not copy them from VGA. Test insufficient fruit, wrong item, partial exchange if the edition supports it, repeat exchange and reward duplication. Then compose its earned gem outcome into the next gated quest loop.

Other required loop families include creation/arrival/Guild; ring→Healer; inn order→delivery→consume→stand/exit; class practice/skill gate; potion ingredients→brew→collect; bear/Kobold→Baron reward; fortress prerequisite→courtyard→dining→Yorick→Elsa→escape; Baba and ending conditions. This is a proposed coverage index, not an assertion that both editions use identical chains or ordering.

Represent the campaign as a dependency graph of milestones, with loops as executable proofs of its edges and return paths. Cover all mandatory milestones, each supported class solution and consequential failure/recovery branch. Use relevant-state partitions and boundary values—item counts, day/night thresholds, skill limits, dialogue stages and RNG outcomes—rather than pretending to exhaust all global combinations. Bounded graph analysis can find an unreachable reward or softlock in its abstraction; it is not a proof of the entire interpreter.

## 8. Independent truth and the test ladder

Keep three receipts independent: **reference/source oracle**, **engine trace**, **rendered player-input trace**. A tape generated by the same faulty reducer is useful regression data, not an independent oracle. Original/source observations should be established before accepting generated expected results. Unknown deep state may require an instrumented interpreter; visible inventory/messages/clock provide an initial observable oracle without guessed memory addresses.

Run cheap checks first, then the actual experience:

| Gate | Pass condition |
|---|---|
| Content/compile | Valid references and capabilities; no required unsupported semantics; source/edition/art bindings recorded |
| State/sequence | Deterministic state for a fixed input/tick/random stream; guard/effect, cancellation, repeat and save/resume assertions pass |
| Source differential | Qualified loop milestones and branch behavior match the edition oracle or a named approved deviation |
| Rendered loop | Ordinary UI can discover/execute every step; navigation, masks, dialogue, animation and feedback match the active state |
| Fresh route | Complete ordinary start-to-ending routes for all three classes in each flavor; selected hybrid-skill/alternative branches covered by additional loops |
| Release/device | Published/downloaded candidate works with clean install, compatible save, offline content and actual supported Android controls |

The six full class campaigns are a minimum route family, not proof of every original interaction. Publish per-edition denominators: source cases inventoried/mapped/verified, required loops passed, fresh routes completed, visual contracts reviewed, assets qualified and unresolved blockers. Keep not-run, blocked, failed and passed distinct. Old-build passes become stale when their transitive dependencies change.

Prepared high-skill saves and marked Win assists remain useful for isolating later problems, but never satisfy earned-route or normal-combat gates. First prove a coherent original-art loop and a representative modern-art quality loop; then continue through the whole game. Those checkpoints do not replace completion.

## 9. Windows and Android

Use the same packaged logic/content, with device-specific input and layout adapters. Windows supports mouse and keyboard plus the existing desktop launcher. Android VGA uses clear verb/item controls and touch targets mapped to actual scene geometry. Android EGA uses a command field, original-compatible command history/repeat and a movement pad/stop control; conversation topics remain typed. Generic controls must not accidentally reveal puzzle answers or introduce a different dialogue game.

Test soft-keyboard open/close, IME composition/Enter, autocorrect/capitalization, focus, held-key release, pointer cancellation, orientation, browser bars, full-screen entry/exit, audio unlock and background/resume. Keep active gameplay controls in view; allow scrolling for rare utilities. Do not freeze a desktop canvas size in a way that hides the command field behind the keyboard.

Qualification requires an **actual Android device/browser**, not only a412px viewport. A local emulator is an additional tier if available; no paid device farm is assumed. If physical access is unavailable, continue other work and leave that gate explicitly open. Record model/OS/browser, build, input method and failures.

Browser offline support needs an explicit complete asset download, storage estimate, progress and verification. Current public build assets total roughly295MB before future optimization; importing the22.9MB game-data file alone does not prove every modern scene is cached. Test unvisited rooms with network off. Display actual required bytes; account for temporary staging space and browser storage eviction. Native Windows packaging already bundles runtime/art/data; verify a newly extracted package and desktop launch rather than only ZIP contents.

Saves record edition, backend/schema version, source/content/extension identities and authoritative state, including sequence/timer continuation where needed. Cross-edition saves are not silently interchangeable. Migrations are explicit and validated; unsupported saves are preserved. Original emulator saves remain separate.

Treat a save as a **campaign identity** in the interface: visibly name its edition and adventure set. Changing edition creates a new campaign. Trying an adventure forks a recoverable save by default. Compatible updates may continue; otherwise preserve the old playable version or show an explicit migration preview. Removal explains the effect on location, items and rewards; defer unsafe removal rather than silently converting or deleting progress.

Stage new data, validate it and save compatibility, then activate it at a safe reload boundary. Avoid running old in-memory rules against a newly switched pack. Failed/interrupted import leaves the preceding active pack/save usable; export/backup remains accessible. Keep running app, latest app, installed content and data-update need distinct.

## 10. From a prompt to a complete extension

The user supplies the creative request here. I handle all editing; no in-app AI subscription or MCP server is required.

Support two explicit outputs: an **expansion** entered from and returned to a base campaign, and a **standalone adventure** with its own start, progression and endings. The two-room expansion trial does not qualify standalone creation. Each commissioned adventure defines premise, intended length, supported editions/classes, prerequisites, clue chain, meaningful choices, success/failure endings, reward consequences, art/motion scope and save/removal policy. Intentional changes to base-game progression are identified as a variant.

1. **Brief and impact:** identify narrative aim, editions/classes, entry/return points, affected base quests, new mechanics, art direction and success/failure payoffs. Resolve ordinary choices autonomously; clarify only material ambiguity.
2. **Narrative graph:** define clues, dependencies, characters, dialogue/parser subjects, alternative solutions, rewards and recovery. Check entry prerequisites are obtainable and the adventure cannot permanently trap the player unintentionally.
3. **Typed content bundle:** namespace IDs; define rooms, actors, local/global state, sequences, interactions, geometry needs and flavor variants. Original content stays immutable; changes are versioned overlays.
4. **Test-first contract:** author expected loops from the brief/reference independently of generated implementation. Include wrong item/topic, refusal before prerequisite, revisit, repeated reward, interruption and save/resume.
5. **Gray-box play:** build connected functional scenes first. Both flavors must complete the new loop through their real UI before expensive art production.
6. **Assets and motion:** generate major character/location references first; produce layered scenes, masks, anchors, props, portraits/icons and usable animation. Keep prompts, variants and provenance. Reuse existing style and the image-generation skill; still images do not qualify movement or combat.
7. **In-game review:** play approaches, boundaries, occlusion and interaction transitions at desktop and phone sizes. Align geometry to accepted art, not the other way around by accident.
8. **Integration:** run extension loops and impacted original loops through entry/return and ending invariants, then device/offline/save/release gates. Publish only the frozen candidate with evidence and remaining limitations.
9. **Revision:** atomic changes, compatible save handling and a tested undo/removal policy. A save inside a removed extension needs a migration/exit checkpoint; never silently delete its inventory or strand its actor.

First end-to-end authoring qualification: from a short prompt, add **two connected rooms, one character, one gated item quest, dialogue, a reward, artwork and a return to the base game**, in both flavors. Use no special-case patch to the main UI host. Test deliberately broken variants to prove validation catches them. This establishes one supported prompt class; arbitrary narratives and subjective quality are not absolutely guaranteed by it.

Then qualify a small **standalone** prompt-created adventure with its own new-campaign entry, coherent clue/choice/payoff chain, success and failure/recovery endings, and portable saves in both flavors. Judge completeness by the player experience, not room count. “One shot” means **one creative request followed by autonomous build, critique, repair and verification**. It does not promise one generation pass or make Tal responsible for finding every failure. Unsupported new mechanics become explicit capability tasks; they are not silently simplified away.

## 11. Reusable skills and packaged scripts

Use one versioned `quest-lab-builder` skill with concise routing and on-demand references initially. Split a specialist into its own skill only when actual use justifies independent discovery. The skill selects a workflow; a shared toolkit performs deterministic work. Avoid six copies of the same uploader, validator or browser helper.

| Skill mode / later specialist | Packaged capability | Acceptance for the helper itself |
|---|---|---|
| Baseline and source map | `questctl baseline scan`, `source map`, `edition diff`, `room inspect` | Known manifests/AST cases resolve correctly; mismatched source and unknown semantics reject; originals remain unchanged |
| Author/extend adventure | `questctl extension scaffold`, `compile`, `validate`, `impact` | Namespaces, guards/effects, parser conflicts, unreachable rewards and unsupported mechanics checked; reversible two-room example works |
| Scene and asset integration | `questctl scene validate`, `geometry audit`, `art collect`, `atlas check` | Bounds, asset hashes, transforms, anchors, masks, layers and view types checked; actual game review still required |
| Gameplay-loop QA | `questctl loop validate`, `run`, `compare`, `coverage`, `reproduce` | One intended pass and intentional state/input/source/build mismatch each produce the right receipt; no fixture/Win laundering |
| Release and recovery | `questctl release freeze`, `build`, `verify`, `publish`, `restore-check` | Immutable version/hash/size manifest; clean-launch/import/rollback checks; private assets excluded from public output |

Command names above are the **proposed interface**, not tools already installed. Put reusable library code and schemas under the project toolkit, with thin skill scripts and a concise `SKILL.md`. Include `--help`, `--dry-run` where meaningful, structured JSON output, stable exit codes, explicit project/run/artifact paths and versioned receipts. Keep narrative/design judgment in the agent; do not try to encode taste into a brittle checklist.

Consolidate repeated work already visible in this project:

- Replace hardcoded `verify-mouse-*`/release variations with one parameterized manifest verifier and publisher. Consolidate ZIP staging, exact-byte checks, private/public boundaries, credential use and bounded retries.
- Replace per-room server clones with one isolated QA launcher: immutable build, unique origin/storage scope, separate save directory, declared fixture and owned-process cleanup.
- Replace repeated canvas click/bounds/waits/capture snippets with one browser adapter. Assert selected tab, viewport and source/build ID first; record real input and wait for explicit state rather than arbitrary sleep or endless screenshots.
- Replace fragile AST-extracted-method harness globals with tested pure modules and explicit dependencies, sharing real controller bindings where an engine seam is necessary.
- Replace hand-edited scenario aggregation with one ledger/report builder that preserves failures, timestamps, setup provenance and stale-build status.

Browser automation must use the backend permitted by the current environment—CUA here—with a compact reusable scenario executor. A standalone headless runner is a separate adapter only where supported/authorized. Do not evade a runtime restriction by moving the same action into a script.

Before registering skills, run the skill validator and meaningful script tests, then give an independent worker a fresh realistic task plus the skill and minimum artifacts. Do not give it the intended answer. Verify the result, not just a successful exit. Use synthetic broken fixtures to test rejection, privacy boundaries, missing assets, interrupted imports and failed release gates. Store operational details in referenced schemas/scripts so each turn loads only the task's relevant material. Skill design follows the locally supplied skill-creator guidance.

## 12. Batch order and gates

| Work packet | Depends on | Concrete output and exit gate |
|---|---|---|
| P0 Baselines and inventory | v0.5.2 checkpoint | Match both game/script versions; edition differences and unsupported-operation inventory; current saves/releases preserved |
| P1 Tools and backend proof | P0 | Minimal loop schema/runner and the representative backend tests from section4; evidence-based backend decision, no silent hybrid |
| P2 Common state/scene boundary | P1 | Authoritative transitions, resolved scenes, movement/approach/callback ownership, typed views and save/sequence resume |
| P3 One earned loop per flavor | P2 | Fresh ordinary VGA clicks and EGA typed commands cross rooms, change state, revisit and survive save/reload; original-art and modern-art proofs |
| P4 Whole-game behavior | P3 | Town→forest→magic/caves/castle→fortress/finale; edition-specific source coverage, all classes, alternative/failure loops; no stopping at a region |
| P5 Complete visual integration | P3, in parallel with P4 | Prioritize hero/major NPCs/locations; accepted geometry/mattes/animations across the actual room/asset inventory |
| P6 Android/offline/recovery | P3, continue through P4/P5 | Real Android evidence, complete offline download, imports, save migrations, interruptions and clean Windows launch |
| P7 Prompt-adventure qualification | P2/P3; final integration after P4 | Two-room expansion and a separate complete standalone trial from fresh prompts; both-flavor rendered play, base-game impact, undo and compatible saves |
| P8 Final release | P4–P7 | Frozen six-class-route family plus branch evidence, original/visual/device coverage, immutable downloads and honest remaining deviations |

At the first two-hour execution checkpoint, report the measured baseline/backend/tooling results and revise the next packet using evidence. That is a checkpoint, not a completion deadline or a reason to reduce scope. Do not promise total hours before qualifying the backend and measuring representative work. Forecast using observed time per qualified loop/room/asset family, remaining inventory and actual critical dependencies; update at each packet boundary.

If a gate fails, keep useful parallel work bounded and marked conditional. Reproduce the smallest failure, fix it, rerun affected loops and then connected prefixes/suffixes on the frozen candidate. A missing Android device leaves that gate open; a missing source semantic blocks parity; a failed modern matte does not justify inventing gameplay. Preserve the working release throughout.

Three product checkpoints accompany these packets: a coherent ordinary loop in both editions; complete campaigns with qualified presentation/device behavior; and fresh-prompt expansion plus standalone adventures that can be played and recovered. Add an independent player-understanding check: can a reviewer without developer coaching choose the edition, identify the current goal, notice a clue, understand a refusal, take the next action and recognize the payoff? Distinguish original puzzle difficulty from missing implementation or a confusing new interface; do not add answer hints just to make a test pass. Record reviewers' actual capabilities and familiarity. Do not polish Lab dashboards while those experiences remain broken.

## 13. Roles, cost and stopping conditions

Loom owns behavior contracts, integration and delivery. **Meridian reviews product promise, player/creation journeys and priorities; Gauge reviews mechanics and verification gates.** Bounded Gemini or lower-cost workers can inspect selected non-sensitive sources, audit a loop specification, implement an isolated helper or review a narrative. Terra can perform rendered click/input checks when its actual browser capabilities work. Use isolated origins/saves; another tab at the same origin is not independent storage.

Delegate by coherent room/quest/loop ownership and non-overlapping files. One integrator owns cross-room semantics. Capture raw failures once, batch cheap checks, inspect screenshots at meaningful transitions, and load compact source/loop slices instead of repeating the entire chat. No worker count creates extra provider quota or removes the integrated-route gate.

Read Gemini's live quota before batches through the existing society wrapper; measure comparable jobs and keep slack. One planning review observed the shared Gemini pool move98.20184%→97.23352%; that is not an isolated price or a fixed tasks-per-percent conversion. No paid fallback, cloud machines, private-data upload or new account access is assumed. No measured token saving is claimed yet.

Measure improvement by: qualified loops completed per work hour, first-pass and regression failure rates, time to reproduce/fix, script reuse, source/context loaded, observed token/tool usage where available, and worker quota deltas with attribution limits. Less copying is useful only if the exact requested game remains sufficiently good and complete.

“Guarantee” should mean enforceable invariants—broken references cannot publish, stale inputs cannot mutate a new scene, unsupported source behavior cannot claim parity, and evidence is tied to the shipped build. It cannot honestly mean arbitrary prompts always produce perfect stories, art or bug-free games in one attempt. The workflow should catch, repair and verify failures autonomously before calling the addition complete.

## 14. Current next action

Begin P0/P1 when the large implementation batch is started: match the EGA source to Tal's disks, freeze the edition oracles, package the minimum shared inspection/QA tools, and qualify the behavior backend on the hard representative sequences. Do not generate the entire new art inventory first. The next batch must produce the whole requested experience, while these early proofs make its cost and risks visible.

Supporting planning artifacts: `plans/two-flavor-work-packets.json` and `plans/gameplay-loop-example.json`. The example is deliberately unqualified until its original/source oracle fields are filled; a validator must refuse to count it as acceptance evidence. Read-only Gauge and Gemini reviews are saved under `evidence/`; advice was critically reviewed, not treated as observed game testing.

Meridian's product review is also saved there. Its recommendations above have been incorporated as agent proposals, not Tal approvals. The completed planning helpers are a Markdown-to-HTML renderer and a planning-artifact checker only; the proposed gameplay CLI, skill suite and two-flavor conversion have not been implemented by this document.


# Quest Lab: one engine, two faithful games

22 November 2026 · Loom, with Meridian and Gauge · Research and proposed implementation; no engine migration performed.

## Recommendation

**Use Adventure Game Studio (AGS) as the first candidate for the common engine. Prove its automated authoring and Android-browser path before committing the full reconstruction to it.** Use its established project format and runtime, adding reusable scripts for the features it lacks. Godot + Escoria is the fallback if that practical proof fails.

Do not build another general engine from scratch yet. Your desired separation—shared mechanics, reusable scripts and individual rooms—is already substantially present in existing adventure engines. The earlier plan spent too much effort organizing verification around our implementation without first challenging the implementation itself.

The important tradeoff: **AGS saves generic engine work; it does not execute the original SCI game scripts.** Those behaviors still need porting. SCICompanion + ScummVM preserves more original execution and is the better alternative if that becomes more important than a common foundation for creating new adventures.

Your confirmed priorities: engine first; faithful EGA and VGA gameplay using reference graphics; improvements identified separately; Windows and Android browsers with offline play; existing project formats preferred; Phaser may be replaced. This proposal supersedes the architectural recommendation in TWO-FLAVOR-PLAN.md. The current v0.5.2 remains available and unchanged.

## What the strongest options actually provide

| Option | Already available | Work or uncertainty that remains | Decision |
| --- | --- | --- | --- |
| **AGS** | Adventure rooms, actors, hotspots, inventory, dialogue, walkable/walk-behind areas, scripts and a synonym-aware text parser. Open-source editor/runtime under Artistic License 2.0. Official Web export and command-line project compilation. | SCI vocabulary and behavior are not automatically compatible. QFG skills, encounters, combat and puzzles need implementation. Room and sprite files include binary data; prompt-driven authoring needs a reliable editor bridge. Android browser typing and offline delivery need demonstration. | Best first trial: closest existing feature set to both games. |
| **Godot + Escoria** | General rendering/animation platform plus an open-source point-and-click framework, inventory/dialogue and save support. Text scenes/scripts and headless export suit agent editing. | EGA-style parser and QFG systems remain custom work. Escoria's current Godot 4 documentation warns of gaps; pin a compatible release/commit. Web/mobile behavior needs proof. | Fallback if AGS authoring or browser limitations outweigh its head start. |
| **SCICompanion + ScummVM** | Existing SCI authoring/compiler tools and an established interpreter for original SCI game resources. SCICompanion explicitly supports EGA parser and VGA point-and-click creation. ScummVM has a WebAssembly port. | SCI generations use different formats. This is not a common authoring system for SCI and LucasArts programs. A modern high-resolution replacement workflow and convenient unattended authoring are not established by those capabilities. | Retain originals/tools as the behavioral reference; reconsider as the main foundation if avoiding the behavior port dominates. |

Sources: [AGS source/license](https://github.com/adventuregamestudio/ags), [AGS parser](https://adventuregamestudio.github.io/ags-manual/Parser.html), [rooms](https://adventuregamestudio.github.io/ags-manual/EditorRoom.html), [Web export](https://adventuregamestudio.github.io/ags-manual/DistGame.html), [compile command](https://github.com/adventuregamestudio/ags-manual-source/blob/master/EditorCommandLineOptions.md); [Escoria](https://docs.escoria-framework.org/en/devel/), [save system](https://docs.escoria-framework.org/en/devel/advanced/load_save.html), [Godot command line](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html), [Web constraints](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html); [SCICompanion overview](https://scicompanion.com/overview/), [SCI picture structure](https://scicompanion.com/Documentation/pics.html), [ScummVM Web port](https://github.com/scummvm/scummvm/blob/master/dists/emscripten/README.md).

This is a source-based comparison, not a benchmark or a tested migration. Native Android support is separate from Android browser support. None of these choices makes arbitrary Sierra or LucasArts games automatically importable.

## What “one engine” means in practice

One maintained runtime and one shared adventure library. Two game projects supply their own content and edition-specific behavior. EGA and VGA are separate games on that foundation, rather than two interfaces applied to one assumed-identical story.

| Layer | Responsibility |
| --- | --- |
| Existing engine | Drawing, animation, input, audio, pathfinding, room loading, walk-behind ordering and basic save facilities. |
| Shared adventure scripts | Action dispatch, room-entry/exit conventions, timed sequences, inventory transactions, dialogue control, persistent-state conventions and game identity/version checks. |
| Reusable QFG scripts | Character creation, skills, training, clock, needs, spells, encounter scheduling and combat machinery. Rules that differ by edition remain configurable or edition-specific functions. |
| Each game's global files | Items, vocabulary, spell/stat tables, quest flags, schedules, shared characters and story logic spanning rooms. |
| Each room | Background/props, masks, hotspots, entrances, exits, local actors, event handlers and local sequence state. |
| Quest Lab shell | Choose game, versions, imports/downloads, save backup and offline installation. It does not run a second copy of gameplay logic. |

**Do not force executable behavior into giant configuration tables.** Numbers and definitions belong in data; “walk here, animate, wait, speak, then award an item unless interrupted” belongs in a script. A reusable function handles common behavior. A room script handles that room's exceptions.

For AGS, use real `Game.agf`, `roomN.crm`, `roomN.asc`, `.asc/.ash` shared modules and the engine's sprite/view resources. Room geometry is partly binary, so “individual screen files” means a room resource plus its readable script—not a promise that everything is JSON. Native project files remain authoritative; exports are inspection aids, not a second editable truth. See [AGS project components](https://github.com/adventuregamestudio/ags-manual-source/blob/master/Templates.md).

Your room/state model is substantially right. Add two distinctions: persistent facts such as owning the ring belong in game state; a temporary sequence such as a shopkeeper's greeting belongs in a room/actor script. Visible objects and permitted interactions derive from those facts. They must not maintain separate contradictory flags.

Layering is also explicit room information interpreted by engine rules: legal walking regions, prop/actor baselines, foreground masks, and special close-up modes. A noticeboard close-up can disable the player actor entirely. AGS already provides walk-behind baselines; we still must author them correctly. [Baseline behavior](https://adventuregamestudio.github.io/ags-manual/Globalfunctions_Room.html#setwalkbehindbase).

## Concrete implementation sequence

### 1. Qualify the foundation before a whole-game port

Pin an AGS release and matching Web runtime. Build a small reusable template containing two connected rooms, one actor, an inventory exchange, a timed interruption, a close-up and a foreground obstruction. Use placeholder/original reference art locally.

From a prompt, create another room, change its background and walking mask, connect its door, change an interaction, compile, reopen and undo. This is the decisive authoring proof. AGS documents `AGSEditor.exe /compile path\Game.agf`; compilation alone does not prove room editing.

A third-party [editor REST bridge](https://github.com/tostiok/ags-editor-rest-api-plugin) is relevant, but its author calls room creation and background/mask writes experimental and reflection-based. Its repository license was not established in this review. Inspect licensing and exercise those operations before depending on or reusing it. A small bridge using the engine's editor/plugin facilities may be necessary; MCP remains optional. Editor-side tools need not ship in the browser game. Avoid essential native runtime plugins.

Export immediately to the Lab's static browser shell. Implement touch verbs, movement controls, a phone keyboard path for typed commands, save import/export and versioned offline caching. Test offline entry into a room not previously visited, not merely the cached title screen. AGS's Web launcher already contains IndexedDB save mounting, but durable save flushing/recovery and our offline shell still need verification. [Launcher source](https://github.com/adventuregamestudio/ags/blob/master/Emscripten/launcher_index.html).

**Outcome:** a reusable engine template with demonstrated authoring and delivery. If a critical capability fails and needs a substantial engine fork, test that specific case in Godot + Escoria before switching. Do not maintain three competing reconstructions.

### 2. Prove the template against both real games

Match the EGA PCjs resources to the correct source/version; pin the VGA source/resources too. Current imports and source-location metadata are useful, but a public decompilation directory is not proof of a version match. Preserve their checksums.

Implement one real cross-room quest in each project: arrival/greeting, discovery, acquisition, handover and reward, including refusal before prerequisites and revisit afterward. The Healer/ring chain is a useful candidate where present; use each edition's actual path. Add the magic-shop entry sequence, a close-up, class-dependent behavior and one real encounter/combat sequence. No Win button counts as combat fidelity.

EGA uses its vocabulary, synonyms, parser precedence and typed questions, with no undiscovered dialogue menu. VGA uses its own icons, targets, conversation rules and automatic events. Both can share machinery without sharing rules that differ. AGS's parser is a starting facility, not proof of SCI grammar compatibility.

Port from original source and observed play, with script/line references attached to translated handlers. Reuse the existing proper SCI parser and extracted assets/geometry where appropriate. Translate supported structures deliberately; mark unresolved logic explicitly. Do not replace missing behavior with invented quest shortcuts. The existing custom SCI runtime is retained as work/evidence, not silently adopted as another gameplay authority.

**Outcome:** two small but faithful game packages on the same foundation, plus a measured basis for estimating the remaining port.

### 3. Finish both games in connected story segments

Port shared QFG systems first, then town/shops/guild, forest/encounters, castle and magical puzzle chains, brigands/finale, and remaining class alternatives/failure paths. Keep EGA/VGA differences in their projects rather than hiding them in a giant engine switch.

Complete a story segment through ordinary play before calling its rooms finished. Existing counts—84 VGA pictures and 251 supplied source modules—are resource counts, not completed rooms or portable gameplay units. Produce the actual room/interaction inventory from the selected sources.

The campaign runs entirely in the selected engine. Retain useful Lab downloads, original players and artwork; retire the current hybrid gameplay path after the replacement is qualified. Saves stay tied to game/edition/content version. Preserve old saves and the old playable release; migration requires an explicit converter rather than hopeful compatibility.

### 4. Demonstrate reuse, then replace art

Create a short new adventure/extension using the same template, without engine room-ID special cases. Change a quest, add a connected location and character, and prove the resulting loop is playable. This demonstrates the engine's generality more convincingly than designing hypothetical systems for many games.

Then qualify one high-resolution room and animated hero, with aligned walking, hotspots and occlusion, before replacing bulk artwork. Keep source coordinates and art transforms explicit. Modern 3D combat is a separately identified gameplay change, not part of faithful reference combat.

## Gaming loops and prompt-driven additions

A loop is a readable story journey across rooms, for example: **hear about a missing item → learn where to search → obtain it → return it → receive the correct reward → see the changed world**. Each has initial conditions, ordinary inputs, expected intermediate changes and an ending. Include meaningful alternatives, refusals, interruptions, revisits and save/reload.

Each step points to the actual edition source/reference and room handler. A runner exercises those same inputs, then records the visible result and relevant state. Seeded encounters make failures repeatable; random encounters can be disabled for puzzle isolation, followed by normal-game checks. Teleporting or injecting quest flags does not establish a playable campaign. Independent source expectations prevent the implementation from merely testing its own guesses.

For a new prompt, I design the story loop, its rooms/objects, prerequisites and consequences; implement them through the template; generate/integrate assets; run the journey; correct failures; deliver a versioned playable preview with rollback. Existing saves remain recoverable. “One prompt” can initiate that whole process; it cannot honestly guarantee a perfect first code generation.

Package repeated work into three small skills once the engine is chosen:

- **Author adventure:** scripts to inspect/create rooms, import art and masks, edit handlers/dialogue and validate references through the chosen native project format.
- **Verify adventure:** reusable ordinary-input journey runner, source trace comparison and compact failure reports by room/loop; a few useful rendered captures instead of endless screenshots.
- **Release adventure:** compile, package, check save compatibility, stage static files, verify published hashes and preserve rollback.

These are proposed tools, not claimed deliverables. Build the scripts once and have the skills call them. The next implementation batch should deliver the engine template and the two source-grounded example journeys—not another large planning document.

# AGS proof 0.1.0

23 November 2026 · Engine: official AGS 3.6.3.17. This is an original three-room test adventure, not a Quest for Glory port. The existing Quest Lab v0.5.2 is unchanged.

**Decision: promising; full migration remains on hold until an actual Android-browser check passes.**

## Observed results

| Capability | Result and evidence limit |
| --- | --- |
| Create/edit rooms without manual editor work | Native AGS rooms created through a version-pinned C# adapter; backgrounds, walking masks, hotspot masks, foreground baselines, actors and an item configured. Official AGS compiler builds the project. |
| Add a connected room | Added the garden, reached it through ordinary typed play after earning the reward, and inspected its sunstone. |
| Undo | Restored the prior native room resource, matched its SHA-256 and compiled; restored the edited version and compiled. `evidence/revision-check.json`. |
| Mouse play | Walk, herb pickup, door, automatic entry greeting, talk, item handover and reward passed in Chromium. No quest flags injected. |
| Typed play | Real AGS `Parser.ParseText` / `Parser.Said`: synonyms, unknown words, missing-item refusal, room transitions and the same quest passed. |
| Touch | Chrome desktop's emulated touch events picked up the herb, entered the hut and handed it over. This is not Android hardware. |
| Persistent saves | Closed every game tab, opened a fresh one, restored room, inventory, quest/input state. Two successive saves were serialized and confirmed; latest serial restored. |
| Cold offline play | Stopped the local origin server, closed the game, launched a fresh tab, restored, completed the quest, saved offline, closed/reopened again and restored the offline-created state. This establishes the desktop browser path, not Android. |
| Compatible content edit | Earlier save restored after adding the room/art changes. General save compatibility across future script/engine changes is not claimed. |
| Actual Android keyboard/storage/offline | **Pending.** No attached Android debugging device or remote Android session was available to the agent. An access question was sent. |

## Try it

Desktop shortcut: **Quest Lab - AGS Proof**. The independent local service uses port4330. Public preview: [open the proof](https://tals-devbox.github.io/quest-lab/ags-proof/).

Mouse/touch: pick up the small green herb, click the right-hand door, choose Talk and click Mira, then choose Use / give and click her. After the reward, the courtyard's lower-left garden gate opens.

Typed: switch modes; try `get plant`, `open hut`, `talk mira`, `offer herb mira`, `enter garden`, `look sunstone`. Unknown words and missing prerequisites produce refusals. The browser field handles text entry; parsing and all story consequences run in AGS.

The graphics are intentionally simple test art. This proof establishes an authoring/runtime route; it does not establish SCI grammar equivalence, original rules/combat, full campaigns or final visual quality.

## Short Android acceptance check

1. Open the public link in your normal Android browser and wait for **Offline package ready**. Switch to typed, type/edit a command using the phone keyboard, pick up the herb and enter the hut.
2. Save and wait for **Save confirmed on this browser**. Close all proof tabs. Reopen the same URL/profile, press Load, and check the hut and herb (`inventory`). Rotate the phone; verify keyboard and controls remain usable.
3. Turn on airplane mode after the package is cached. Close/reopen the same URL, Load, finish the handover, Save, close/reopen offline and Load again. Check that the garden is available. Also try point-and-click movement and doors.

Record the phone/browser and any failed step. This is the outstanding platform gate, not a request to certify the reconstructed game.

## Implementation and reproduction

- Native project: `game/Game.agf`, `room1–3.crm`, room scripts, shared GlobalScript, views, sprites and inventory. Both input styles use this one compiled game and runtime.
- `tools/Author.cs` configures real engine/project objects, with reflection where AGS lacks a public room-authoring interface. It is pinned to3.6.3.17 and needs maintenance if internal APIs change. No unlicensed third-party bridge was used.
- `tools/build.ps1 -Revision initial|edit` runs the adapter and the official `/compile` command. Failures prevent packaging. `tools/revision-check.ps1` exercises saved native revisions. Snapshots/vendor binaries are local and ignored by Git.
- `tools/package-web.mjs` bundles the compiled game and official Web runtime. A proportional Web scaling setting avoids integer-scale black borders. The cache ID hashes the actual runtime, config, game and shell files.
- Browser shell: iframe-isolated native HTML text entry, normal action inputs through a bounded FIFO, explicit save confirmation after IndexedDB sync, save export/import integrity checks and scoped offline caching. It contains no quest rules or state mutation/debug endpoint.
- Persistent data is local to browser origin/profile. The prototype serializes filesystem sync requests; exports provide a backup. Abrupt shutdown before confirmation, cleared browser storage, simultaneous tabs and general cross-version save migration are not guaranteed.

Setup issue: the Windows package needed missing32-bit Microsoft C++ runtime libraries. An attempted system installation was automatically blocked; no system runtime installation was performed. Microsoft-signed libraries were instead extracted into this proof's vendor folder. AGS/source/Web downloads matched the official release checksums.

Sources and credits: [AGS release](https://github.com/adventuregamestudio/ags/releases/tag/v3.6.3.17), [source](https://github.com/adventuregamestudio/ags/tree/v3.6.3.17), bundled `web/licenses/`. Runtime, test-art, project and browser changes are separate from the Quest Lab reconstruction. Gauge supplied browser/storage research; Loom implemented and exercised the proof. Full migration has not begun.

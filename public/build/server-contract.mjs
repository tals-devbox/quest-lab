// src/rules.ts
function validateSave(s, c) {
  const e = [];
  const record2 = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
  const nonnegative = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const integer = (v) => Number.isInteger(v) && v >= 0;
  const text = (v) => typeof v === "string" && v.length > 0;
  if (!record2(s) || s.version !== 1) return ["Unsupported save version."];
  if (!["fighter", "magic-user", "thief"].includes(s.heroClass)) e.push("Invalid hero class.");
  if (!text(s.heroName) || !s.heroName.trim() || s.heroName.length > 48 || !integer(s.room)) e.push("Invalid hero or room.");
  if (c && !c.rooms.some((r) => r.id === s.room)) e.push("This save refers to a room absent from this content revision.");
  for (const k of ["minutes", "day", "gold", "silver", "score", "revision", "seed"]) if (!integer(s[k])) e.push("Invalid " + k + ".");
  if (s.minutes >= 1440 || s.day < 1 || s.seed > 4294967295) e.push("Invalid clock, day or random seed.");
  for (const k of ["stats", "inventory", "flags", "quests"]) if (!record2(s[k])) e.push("Invalid " + k + " map.");
  if (record2(s.stats)) {
    for (const k of ["strength", "agility", "vitality", "intelligence", "luck", "weaponUse", "parry", "dodge", "stealth", "climbing", "throwing", "pickLocks", "magic", "health", "maxHealth", "stamina", "maxStamina", "mana", "maxMana", "hunger", "unspent"]) if (!nonnegative(s.stats[k])) e.push("Missing or invalid required stat " + k + ".");
    for (const [k, v] of Object.entries(s.stats)) if (!nonnegative(v)) e.push("Invalid stat " + k + ".");
    if (s.stats.maxHealth <= 0 || s.stats.maxStamina <= 0 || s.stats.health > s.stats.maxHealth || s.stats.stamina > s.stats.maxStamina || s.stats.mana > s.stats.maxMana) e.push("Invalid vital-stat bounds.");
  }
  if (record2(s.inventory)) for (const [k, v] of Object.entries(s.inventory)) {
    if (!integer(v)) e.push("Invalid item amount " + k + ".");
    if (c && !c.items.some((item) => item.id === k)) e.push("Saved item absent from this content revision: " + k + ".");
  }
  if (s.droppedItems !== void 0) {
    const d = s.droppedItems;
    if (!record2(d) || !integer(d.room) || d.room !== s.room || !record2(d.items)) e.push("Invalid dropped inventory.");
    else for (const [item, count] of Object.entries(d.items)) {
      if (!integer(count) || count < 1) e.push("Invalid dropped item amount " + item + ".");
      if (c && !c.items.some((x) => x.id === item)) e.push("Unknown dropped item " + item + ".");
    }
  }
  if (record2(s.flags) && Object.values(s.flags).some((v) => typeof v !== "boolean")) e.push("Invalid flag value.");
  if (record2(s.flags) && record2(s.stats)) {
    const ordered = +!!s.flags.innMealOrdered + +!!s.flags.innDrinkOrdered, served = +!!s.flags.innMealReady + +!!s.flags.innDrinkReady;
    if (ordered > 1 || served > 1 || ordered && served) e.push("Conflicting inn serving state.");
    if (ordered && (!integer(s.stats.innServiceSerial) || s.stats.innServiceSerial < 1 || s.room !== 301 || !s.flags.innSeated || !s.flags.shemaServing)) e.push("Invalid pending inn service.");
  }
  if (record2(s.quests) && Object.values(s.quests).some((v) => typeof v !== "string")) e.push("Invalid quest stage.");
  if (!Array.isArray(s.spells) || s.spells.some((v) => !text(v))) e.push("Invalid spell list.");
  else if (c) {
    for (const spell of s.spells) if (!c.spells.some((x) => x.id === spell)) e.push("Saved spell absent from this content revision: " + spell + ".");
  }
  if (!Array.isArray(s.journal) || s.journal.some((v) => typeof v !== "string")) e.push("Invalid journal.");
  if (typeof s.dead !== "boolean" || typeof s.won !== "boolean") e.push("Invalid completion state.");
  if (s.position !== void 0) {
    const p = s.position;
    if (!record2(p) || !integer(p.room) || !nonnegative(p.x) || !nonnegative(p.y) || p.x > 1440 || p.y > 1080) e.push("Invalid saved hero position.");
    else if (c && !c.rooms.some((r) => r.id === p.room)) e.push("Saved position refers to a missing room.");
  }
  if (s.combat !== null) {
    const f = s.combat;
    if (!record2(f)) e.push("Invalid combat state.");
    else {
      if (!text(f.id) || !text(f.name) || !nonnegative(f.health) || !nonnegative(f.maxHealth) || f.maxHealth <= 0 || f.health > f.maxHealth) e.push("Invalid combat identity or health.");
      for (const k of ["power", "defense", "reward", "round", "returnRoom"]) if (!integer(f[k])) e.push("Invalid combat " + k + ".");
      if (c && !c.encounters.some((x) => x.id === f.id)) e.push("Unknown saved opponent.");
      if (c && !c.rooms.some((x) => x.id === f.returnRoom)) e.push("Combat return room is missing.");
      if (f.stamina !== void 0 && !nonnegative(f.stamina)) e.push("Invalid opponent stamina.");
      if (f.heroStamina !== void 0 && (!nonnegative(f.heroStamina) || record2(s.stats) && f.heroStamina > s.stats.maxStamina)) e.push("Invalid cached warrior stamina.");
      if (f.dazzleTicks !== void 0 && !integer(f.dazzleTicks)) e.push("Invalid combat dazzle duration.");
      if (f.intent !== void 0 && !["guard", "idle", "windup", "recover", "dazzled"].includes(f.intent)) e.push("Invalid opponent intent.");
      if (f.poseTicks !== void 0 && (!integer(f.poseTicks) || f.poseTicks < 1 || f.poseTicks > 65535)) e.push("Invalid opponent pose duration.");
      if (f.clock !== void 0) {
        const k = f.clock;
        if (!record2(k) || k.version !== 1 || k.enemyId !== f.id || k.room !== s.room || typeof k.paused !== "boolean" || !["normal", "attack", "parry", "dodge"].includes(k.defense) || !["guard", "idle", "windup", "recover", "dazzled"].includes(k.phase)) e.push("Invalid live combat clock.");
        else {
          for (const field of ["elapsedMs", "enemyInMs", "playerInMs", "defenseInMs"]) if (!nonnegative(k[field])) e.push("Invalid live combat timer " + field + ".");
          for (const field of ["enemyInMs", "playerInMs", "defenseInMs"]) if (k[field] > 6e4) e.push("Live combat timer exceeds supported bound.");
          if (k.pendingSpell !== void 0) {
            const p = k.pendingSpell;
            if (!record2(p) || !["dazzleSpell", "flameDartSpell"].includes(p.id) || !integer(p.power) || p.power < 1 || p.power > 1e4 || !nonnegative(p.remainingMs) || p.remainingMs > 6e4 || p.remainingMs > k.playerInMs) e.push("Invalid pending combat spell.");
          }
        }
      }
      if (f.randomEncounter !== void 0 && typeof f.randomEncounter !== "boolean") e.push("Invalid encounter marker.");
      if (f.sourceStats !== void 0) {
        if (!record2(f.sourceStats)) e.push("Invalid combat statistics.");
        else for (const k of ["strength", "intelligence", "agility", "vitality", "luck", "weaponUse", "parry", "dodge", "armorValue", "armorEnc", "shieldValue", "weaponValue"]) if (!nonnegative(f.sourceStats[k])) e.push("Invalid combat statistic " + k + ".");
      }
    }
  }
  if (s.loot !== void 0) {
    const loot = s.loot;
    if (!record2(loot) || !integer(loot.silver) || !text(loot.id) || !text(loot.name)) e.push("Invalid saved loot.");
  }
  if (s.minigame !== void 0) {
    const g = s.minigame;
    if (!record2(g)) e.push("Invalid minigame state.");
    else {
      if (!["maze", "darts"].includes(g.kind) || typeof g.active !== "boolean") e.push("Invalid minigame kind or activity.");
      for (const k of ["round", "player", "opponent"]) if (!integer(g[k])) e.push("Invalid minigame " + k + ".");
      if (g.kind === "maze") {
        if (g.player > 13 || g.opponent > 13) e.push("Invalid maze position.");
        if (!Array.isArray(g.obstacles)) e.push("Missing maze obstacles.");
        else {
          const ids = /* @__PURE__ */ new Set();
          for (const o of g.obstacles) {
            if (!record2(o) || !text(o.id) || !text(o.kind) || typeof o.cleared !== "boolean" || !nonnegative(o.x) || !nonnegative(o.y) || o.x > 320 || o.y > 190) e.push("Invalid maze obstacle.");
            else {
              if (ids.has(o.id)) e.push("Duplicate maze obstacle.");
              ids.add(o.id);
            }
          }
        }
        if (g.active && s.room !== 32) e.push("Active maze is outside its room.");
      }
      if (g.kind === "darts") {
        if (!integer(g.wager) || g.wager < 1 || g.wager > 51 || !integer(g.force) || g.force > 11 || !integer(g.angle) || g.angle > 14 || g.round > 9 || g.player > 36 || g.opponent > 36) e.push("Invalid Dag-Nab-It controls or score.");
        if (!nonnegative(g.handX) || g.handX > 320 || !nonnegative(g.handY) || g.handY > 240) e.push("Invalid Dag-Nab-It hand position.");
        if (g.active && s.room !== 340) e.push("Active Dag-Nab-It is outside its room.");
      }
    }
  }
  return e;
}
function validateCampaign(c) {
  const e = [], rooms = /* @__PURE__ */ new Set(), items = new Set(c.items.map((x) => x.id)), spells = new Set(c.spells.map((x) => x.id)), rules = /* @__PURE__ */ new Set();
  if (items.size !== c.items.length) e.push("Duplicate item ID");
  if (spells.size !== c.spells.length) e.push("Duplicate spell ID");
  const checkCondition = (v, where) => {
    if (!v) return;
    if (v.item && !items.has(v.item)) e.push("Unknown condition item " + v.item + " in " + where);
    if (v.spell && !spells.has(v.spell)) e.push("Unknown condition spell " + v.spell + " in " + where);
    for (const x of v.all || []) checkCondition(x, where);
    for (const x of v.any || []) checkCondition(x, where);
    if (v.not) checkCondition(v.not, where);
  };
  for (const r of c.rooms) {
    if (rooms.has(r.id)) e.push("Duplicate room " + r.id);
    rooms.add(r.id);
  }
  for (const r of c.rooms) for (const to of r.exits || []) if (!rooms.has(to)) e.push(`Room ${r.id} has missing exit ${to}`);
  for (const r of c.rules) {
    if (rules.has(r.id)) e.push("Duplicate rule " + r.id);
    rules.add(r.id);
    for (const id of Array.isArray(r.room) ? r.room : [r.room]) if (!rooms.has(id)) e.push("Rule " + r.id + " has missing room " + id);
    checkCondition(r.requires, r.id);
    checkCondition(r.unless, r.id);
    if (r.action.item && !items.has(r.action.item) && !spells.has(r.action.item)) e.push("Unknown action item " + r.action.item + " in " + r.id);
    if (r.action.spell && !spells.has(r.action.spell)) e.push("Unknown action spell " + r.action.spell + " in " + r.id);
    for (const effect of r.effects) {
      if (effect.item && !items.has(effect.item)) e.push("Unknown item " + effect.item + " in " + r.id);
      if (effect.room !== void 0 && !rooms.has(effect.room)) e.push("Unknown effect room " + effect.room + " in " + r.id);
      if (effect.learn && !spells.has(effect.learn)) e.push("Unknown learned spell " + effect.learn + " in " + r.id);
      if (effect.combat && !c.encounters.some((x) => x.id === effect.combat)) e.push("Unknown encounter " + effect.combat + " in " + r.id);
    }
  }
  for (const g of c.gates || []) {
    if (!rooms.has(g.from) || !rooms.has(g.to)) e.push("Gate has a missing room");
    checkCondition(g.requires, "gate " + g.from + "-" + g.to);
  }
  for (const shop of c.shops) {
    if (!rooms.has(shop.room)) e.push("Shop has a missing room " + shop.room);
    checkCondition(shop.when, "shop " + shop.room);
    for (const o of shop.items) {
      if (!items.has(o.item) && !spells.has(o.item)) e.push("Shop has unknown item " + o.item);
      if (!Number.isFinite(o.price) || o.price < 0) e.push("Invalid price for " + o.item);
      if (o.count !== void 0 && (!Number.isInteger(o.count) || o.count < 1)) e.push("Invalid bundle count for " + o.item);
    }
  }
  for (const room of c.rooms) if (room.encChance !== void 0 && (!Number.isFinite(room.encChance) || room.encChance < 0 || room.encChance > 100)) e.push("Invalid encounter chance in room " + room.id);
  if (c.wilderness) {
    for (const s of c.wilderness.species) {
      if (!c.encounters.some((e2) => e2.id === s.enemy)) e.push("Unknown wilderness opponent " + s.enemy);
      if (s.lootMin < 0 || s.lootMax < s.lootMin) e.push("Invalid wilderness loot range " + s.enemy);
    }
    for (const arena of [...c.wilderness.byRoll, c.wilderness.fallback]) if (!c.wilderness.species.some((s) => s.arena === arena)) e.push("Missing wilderness species for arena " + arena);
  }
  return e;
}

// src/content.ts
function normalizedExits(exits) {
  return [...new Set(exits.map((e) => typeof e === "number" ? e : e?.to).filter(Number.isInteger))];
}
function mergeCampaign(base, source, content) {
  const c = structuredClone(base), o = content.overrides;
  for (const r of source.rooms || []) if (!c.rooms.some((x) => x.id === r.id)) c.rooms.push({ id: r.id, name: r.name, exits: normalizedExits((r.exits || []).filter((e) => e.kind === "room-property" || e.kind === "forest-region")), coverage: "imported" });
  for (const [id, patch] of Object.entries(o.rooms || {})) {
    let r = c.rooms.find((r2) => r2.id === +id);
    if (!r) {
      r = { id: +id, name: patch.name || "New room", exits: [] };
      c.rooms.push(r);
    }
    Object.assign(r, patch, { id: +id });
    if (patch.exits) r.exits = normalizedExits(patch.exits);
  }
  for (const [id, patch] of Object.entries(o.items || {})) {
    const i = c.items.find((i2) => i2.id === id);
    if (i) Object.assign(i, patch, { id });
    else c.items.push({ id, name: patch.name || id, ...patch });
  }
  for (const [id, patch] of Object.entries(o.spells || {})) {
    const i = c.spells.find((i2) => i2.id === id);
    if (i) Object.assign(i, patch, { id });
    else c.spells.push({ id, name: patch.name || id, cost: patch.cost ?? 0, ...patch });
  }
  for (const [id, patch] of Object.entries(o.quests || {})) {
    const rule = c.rules.find((r) => r.id === id);
    if (patch.disabled) {
      c.rules = c.rules.filter((r) => r.id !== id);
      continue;
    }
    if (rule) Object.assign(rule, patch, { id });
    else c.rules.push({ id, ...patch });
  }
  for (const [id, patch] of Object.entries(o.journal || {})) {
    const q = c.quests.find((q2) => q2.id === id);
    if (q) Object.assign(q, patch, { id });
    else c.quests.push({ id, title: patch.title || id, description: patch.description || "", ...patch });
  }
  for (const rule of c.rules) {
    const text = o.dialogue?.[rule.id];
    if (typeof text?.text === "string") rule.text = text.text;
  }
  return c;
}
var object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var localURL = (v) => typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.includes("..");
function validateContentDocument(doc, source, base) {
  const errors = [];
  if (!object(doc?.overrides) || !Number.isInteger(doc.revision)) return ["Invalid content document"];
  for (const [group, entries] of Object.entries(doc.overrides)) {
    if (!object(entries)) {
      errors.push("Invalid content group " + group);
      continue;
    }
    for (const [id, value] of Object.entries(entries)) {
      if (!/^[\w.:-]{1,160}$/.test(id) || ["__proto__", "constructor", "prototype"].includes(id)) errors.push("Invalid entity ID " + id);
      if (!object(value)) {
        errors.push("Invalid entity " + id);
        continue;
      }
      if (JSON.stringify(value).length > 1e6) errors.push("Entity too large " + id);
    }
  }
  for (const [id, r] of Object.entries(doc.overrides.rooms || {})) {
    if (!Number.isInteger(+id) || r.id !== void 0 && r.id !== +id) errors.push("Room ID mismatch " + id);
    if (r.exits !== void 0 && (!Array.isArray(r.exits) || r.exits.some((e) => !Number.isInteger(typeof e === "number" ? e : e?.to)))) errors.push("Invalid exits " + id);
    if (r.entities !== void 0 && !Array.isArray(r.entities)) errors.push("Invalid room entities " + id);
    if (r.polygons !== void 0 && !Array.isArray(r.polygons)) errors.push("Invalid room polygons " + id);
    if (r.background !== void 0 && !localURL(r.background)) errors.push("Background must be a local asset URL " + id);
  }
  for (const [id, r] of Object.entries(doc.overrides.quests || {})) {
    if (r.disabled) continue;
    const prior = base.rules.find((x) => x.id === id), merged = { ...prior, ...r };
    if (!Array.isArray(merged.effects) || !object(merged.action) || typeof merged.action.type !== "string" || typeof merged.text !== "string" || merged.room === void 0) errors.push("Incomplete quest rule " + id);
    for (const e of merged.effects || []) if (!object(e)) errors.push("Invalid effect " + id);
    else for (const key of ["amount", "score", "silver", "gold", "increase", "set", "heal"]) if (e[key] !== void 0 && !Number.isFinite(e[key])) errors.push("Invalid numeric effect " + id + "." + key);
  }
  for (const [id, d] of Object.entries(doc.overrides.dialogue || {})) if (d.text !== void 0 && typeof d.text !== "string") errors.push("Invalid dialogue " + id);
  for (const [id, c] of Object.entries(doc.overrides.characters || {})) {
    for (const key of ["image", "spriteUrl"]) if (c[key] !== void 0 && !localURL(c[key])) errors.push("Character image must be local " + id);
    if (c.appearance !== void 0) {
      const a = c.appearance;
      if (!object(a) || !localURL(a.url) || !Number.isInteger(a.frameWidth) || !Number.isInteger(a.frameHeight) || a.frameWidth <= 0 || a.frameHeight <= 0) errors.push("Invalid character appearance " + id);
    }
  }
  for (const [id, a] of Object.entries(doc.overrides.assets || {})) if (a.url !== void 0 && !localURL(a.url)) errors.push("Asset URL must be local " + id);
  if (errors.length) return errors;
  try {
    errors.push(...validateCampaign(mergeCampaign(base, source, doc)));
  } catch (e) {
    errors.push("Invalid content structure: " + e.message);
  }
  return errors;
}

// src/source-overrides.ts
var limits = [
  "Only existing source message text and cel URLs are editable here; source scripts, quests, rewards and gameplay remain unchanged.",
  "Pending messages retain captured old text. Reread after editing; defer resource replacement while a replayable Print dialog is open.",
  "Source byte-buffer text requires Latin-1 and exact original formatter tokens. Native remake Unicode text is a separate pathway.",
  "Sprite dimensions, offsets, mirror metadata and collision data stay original. URL existence, image decoding and visual alignment require host validation.",
  "Save state and program hashes do not change. Existing pending transcript/continuation handling remains host-owned."
];
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function numbers(key, count, max) {
  const p = key.split(":");
  if (p.length !== count || p.some((v, i) => !/^(0|[1-9][0-9]*)$/.test(v) || !Number.isSafeInteger(+v) || +v > max[i])) return null;
  return p.map(Number);
}
function isLocalSourceAssetURL(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  let pathname = value.split(/[?#]/, 1)[0];
  try {
    for (let i = 0; i < 5; i++) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
      if (i === 4) return false;
    }
  } catch {
    return false;
  }
  if (pathname.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(pathname) || pathname.split("/").some((p) => p === "." || p === "..")) return false;
  try {
    return new URL(value, "http://quest-lab.invalid").origin === "http://quest-lab.invalid";
  } catch {
    return false;
  }
}
function resolveSourceCel(resources, view, loop, cel) {
  if (![view, loop, cel].every((v2) => Number.isSafeInteger(v2) && v2 >= 0)) return null;
  const v = resources.views[view], l = v?.loops?.[loop];
  if (!l) return null;
  const mirror = l.mirrorOf !== null && l.mirrorOf !== void 0, sourceLoop = mirror ? l.mirrorOf : loop;
  const source = v.loops[sourceLoop];
  if (!source || source.mirrorOf !== null && source.mirrorOf !== void 0) return null;
  const frame = source.cels?.[cel];
  if (!frame) return null;
  const key = `view:${view}:${loop}:${cel}`, url = resources.sourceCelOverrides?.[key];
  return { cel: url ? { ...frame, url } : frame, mirror, sourceLoop };
}
function formatterTokens(text) {
  const tokens = [];
  for (let i = 0; i < text.length; i++) if (text[i] === "%") {
    const match = text.slice(i).match(/^(?:%%|%-?0?[0-9]*[dsucxX])/);
    if (match) {
      tokens.push(match[0]);
      i += match[0].length - 1;
    } else if (/[A-Za-z0-9+.#*$-]/.test(text[i + 1] || "")) return { tokens, error: "Unsupported source formatter at character " + i };
  }
  return { tokens };
}
function applySourceOverrides(base, content) {
  const diagnostics = [], messageEdits = [], celEdits = [];
  const error = (code, message, key) => diagnostics.push({ severity: "error", code, key, message });
  const revision = content?.revision, validRevision = Number.isSafeInteger(revision) && revision >= 0;
  if (!validRevision || !record(content?.overrides)) error("invalid-source-content", "Content requires a nonnegative integer revision and an overrides object.");
  const overrides = record(content?.overrides) ? content.overrides : {}, messages = overrides.sourceMessages, assets = overrides.assets;
  if (messages !== void 0 && !record(messages)) error("invalid-source-message-group", "sourceMessages must be an object keyed MODULE:NOUN:VERB:CONDITION:SEQUENCE.");
  if (assets !== void 0 && !record(assets)) error("invalid-source-asset-group", "assets must be an object.");
  if (record(messages)) for (const [key, patch] of Object.entries(messages)) {
    const id = numbers(key, 5, [65535, 255, 255, 255, 255]);
    if (!id) {
      error("invalid-source-message-id", "Use canonical numeric MODULE:NOUN:VERB:CONDITION:SEQUENCE.", key);
      continue;
    }
    const [module, noun, verb, condition, sequence] = id, entries = base.messages[module] || [], found = entries.map((m, i) => ({ m, i })).filter(({ m }) => m.noun === noun && m.verb === verb && m.condition === condition && m.sequence === sequence);
    if (found.length !== 1) {
      error("missing-source-message", "Message ID must identify exactly one imported source entry.", key);
      continue;
    }
    if (!record(patch) || Object.keys(patch).some((k) => k !== "text") || typeof patch.text !== "string") {
      error("invalid-source-message-patch", "Source message edits accept only {text:string}.", key);
      continue;
    }
    const text = patch.text;
    if (!text.length) {
      error("source-message-empty", "Empty text changes the source Message kernel length to0 (not found); remove dialogue behavior through a separate script edit.", key);
      continue;
    }
    if (text.includes("\0") || [...text].some((c) => c.charCodeAt(0) > 255) || text.length > 65535) {
      error("source-message-encoding", "Source messages require Latin-1, no NUL, and at most65535 bytes.", key);
      continue;
    }
    const original = formatterTokens(found[0].m.text), replacement = formatterTokens(text);
    if (original.error || replacement.error || JSON.stringify(original.tokens) !== JSON.stringify(replacement.tokens)) {
      error("source-message-format", "Preserve exact source formatter tokens and their order: " + JSON.stringify(original.tokens) + (replacement.error ? " \xB7 " + replacement.error : ""), key);
      continue;
    }
    messageEdits.push({ key, module, index: found[0].i, text });
  }
  if (record(assets)) for (const [key, patch] of Object.entries(assets)) {
    if (!key.startsWith("view:")) continue;
    const id = numbers(key.slice(5), 3, [65535, 65535, 65535]);
    if (!id) {
      error("invalid-source-cel-id", "Use canonical numeric view:ID:LOOP:CEL.", key);
      continue;
    }
    const [view, loop, cel] = id, frame = resolveSourceCel(base, view, loop, cel);
    if (!frame) {
      error("missing-source-cel", "Cel ID must resolve to an imported frame, including mirrored aliases.", key);
      continue;
    }
    if (!record(patch) || Object.keys(patch).some((k) => k !== "url") || !isLocalSourceAssetURL(patch.url)) {
      error("invalid-source-cel-patch", "Source cel edits accept only {url:rootLocalURL}; geometry changes are not permitted.", key);
      continue;
    }
    celEdits.push({ key, view, loop, cel, url: patch.url, mirror: frame.mirror });
  }
  const response = (ok, resources) => ({ ok, resources, diagnostics, contentRevision: ok ? revision : base.sourceContentRevision ?? 0, requestedRevision: validRevision ? revision : null, savesCompatible: true, compatibilityScope: "source-message-text-and-cel-url-only", changes: ok ? { messages: messageEdits.map((e) => e.key), cels: celEdits.map((e) => e.key) } : { messages: [], cels: [] }, limits });
  if (diagnostics.length) return response(false, base);
  const effective = { ...base, messages: { ...base.messages }, views: { ...base.views }, sourceCelOverrides: {}, sourceContentRevision: revision };
  for (const edit of messageEdits) {
    if (effective.messages[edit.module] === base.messages[edit.module]) effective.messages[edit.module] = [...base.messages[edit.module]];
    effective.messages[edit.module][edit.index] = { ...base.messages[edit.module][edit.index], text: edit.text };
  }
  for (const edit of celEdits) {
    effective.sourceCelOverrides[edit.key] = edit.url;
    if (edit.mirror) continue;
    if (effective.views[edit.view] === base.views[edit.view]) effective.views[edit.view] = { ...base.views[edit.view], loops: [...base.views[edit.view].loops] };
    const view = effective.views[edit.view];
    if (view.loops[edit.loop] === base.views[edit.view].loops[edit.loop]) view.loops[edit.loop] = { ...view.loops[edit.loop], cels: [...view.loops[edit.loop].cels] };
    view.loops[edit.loop].cels[edit.cel] = { ...base.views[edit.view].loops[edit.loop].cels[edit.cel], url: edit.url };
  }
  return response(true, effective);
}
export {
  applySourceOverrides,
  mergeCampaign,
  validateContentDocument,
  validateSave
};

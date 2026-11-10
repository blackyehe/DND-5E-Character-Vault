"use strict";

// server/lib/orcbrew-background-worker.ts
var import_node_worker_threads = require("node:worker_threads");

// shared/spell-builder.ts
var cloneEntry = (value) => JSON.parse(JSON.stringify(value));
var object = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
var list = (v) => Array.isArray(v) ? v.map(object) : [];
function applySpellBuilder(e, s) {
  const result = cloneEntry(e);
  Object.assign(result, { name: s.name, desc: s.description.split(/\n\s*\n/), higher_level: s.higherLevel ? s.higherLevel.split(/\n\s*\n/) : [], level: s.level, school: { index: s.school, name: s.school.replace(/^./, (c) => c.toUpperCase()) }, casting_time: s.castingTime, range: s.range, duration: s.duration, concentration: s.concentration, ritual: s.ritual, components: s.components, material: s.material, attack_type: s.attackType, classes: s.classes.map((index) => ({ ...list(e.classes).find((c) => c.index === index), index, name: index.replace(/^./, (c) => c.toUpperCase()) })) });
  if (s.saveAbility) result.dc = { ...object(e.dc), dc_type: { index: s.saveAbility, name: s.saveAbility.toUpperCase() }, dc_success: s.saveSuccess };
  else delete result.dc;
  if (s.damageType || Object.keys(s.damage).length) result.damage = { ...object(e.damage), damage_type: { index: s.damageType, name: s.damageType }, [object(e.damage).damage_at_character_level ? "damage_at_character_level" : "damage_at_slot_level"]: s.damage };
  else delete result.damage;
  if (Object.keys(s.healing).length) result.heal_at_slot_level = s.healing;
  else delete result.heal_at_slot_level;
  if (s.areaType) result.area_of_effect = { ...object(e.area_of_effect), type: s.areaType, size: s.areaSize };
  else delete result.area_of_effect;
  return result;
}

// shared/spell-workshop.ts
function restoreSpellDraft(value) {
  const d = value, b = d?.body;
  if (d?.version !== 1 || d.kind !== "spells" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(d.id) || typeof d.source !== "string" || typeof d.updatedAt !== "string" || !Array.isArray(d.benefits) || !b) throw Error("Invalid spell draft");
  for (const key of ["name", "description", "higherLevel", "school", "castingTime", "range", "duration", "material", "attackType", "saveAbility", "saveSuccess", "damageType", "areaType"]) if (typeof b[key] !== "string") throw Error("Invalid spell fields");
  for (const key of ["level", "areaSize"]) if (!Number.isInteger(b[key])) throw Error("Invalid spell numbers");
  for (const key of ["concentration", "ritual"]) if (typeof b[key] !== "boolean") throw Error("Invalid spell flags");
  for (const key of ["classes", "components"]) if (!Array.isArray(b[key]) || b[key].some((v) => typeof v !== "string")) throw Error("Invalid spell choices");
  for (const key of ["damage", "healing"]) if (!b[key] || typeof b[key] !== "object" || Array.isArray(b[key]) || Object.values(b[key]).some((v) => typeof v !== "string")) throw Error("Invalid spell progression");
  if (d.published && (!Number.isInteger(d.published.revision) || d.published.revision < 1 || typeof d.published.index !== "string" || !/^[a-f0-9]{24}$/i.test(d.published.packId) || !/^[a-f0-9]{64}$/i.test(d.published.packHash))) throw Error("Invalid saved spell identity");
  return JSON.parse(JSON.stringify(d));
}

// server/lib/orcbrew.ts
var import_node_crypto = require("node:crypto");

// server/lib/edn.ts
var ednSet = /* @__PURE__ */ Symbol("EDN set");
var isEdnSet = (value) => Object.hasOwn(value, ednSet);
function readEdn(source, onNonFinite = () => {
}, spans, options = {}) {
  let cursor = 0;
  const maxDepth = options.maxDepth ?? 128;
  const discard = /* @__PURE__ */ Symbol("discard");
  const fail = (message) => {
    throw new Error(`${message} at character ${cursor + 1}`);
  };
  const isSpace = (char) => /[\s,]/u.test(char);
  function space() {
    while (cursor < source.length) {
      if (isSpace(source[cursor])) cursor++;
      else if (source[cursor] === ";") {
        while (cursor < source.length && source[cursor] !== "\n") cursor++;
      } else break;
    }
  }
  function token() {
    const start = cursor;
    while (cursor < source.length && !/[\s,\[\]{}()";]/u.test(source[cursor])) cursor++;
    if (start === cursor) fail("Unexpected EDN token");
    return source.slice(start, cursor);
  }
  function string2() {
    const start = cursor;
    let end = source.indexOf('"', start + 1);
    while (end !== -1) {
      let escapes2 = 0;
      for (let i = end - 1; i > start && source[i] === "\\"; i--) escapes2++;
      if (escapes2 % 2 === 0) {
        try {
          const value = JSON.parse(source.slice(start, end + 1));
          cursor = end + 1;
          return value;
        } catch {
          break;
        }
      }
      end = source.indexOf('"', end + 1);
    }
    cursor++;
    let result2 = "";
    const escapes = { n: "\n", r: "\r", t: "	", b: "\b", f: "\f", '"': '"', "\\": "\\" };
    while (cursor < source.length) {
      const char = source[cursor++];
      if (char === '"') return result2;
      if (char !== "\\") result2 += char;
      else {
        const escaped = source[cursor++];
        if (escaped === "u") {
          const hex = source.slice(cursor, cursor + 4);
          if (!/^[\da-f]{4}$/i.test(hex)) fail("Invalid unicode escape");
          result2 += String.fromCharCode(parseInt(hex, 16));
          cursor += 4;
        } else if (Object.hasOwn(escapes, escaped)) result2 += escapes[escaped];
        else fail("Invalid string escape");
      }
    }
    return fail("Unterminated string");
  }
  function nextValue(depth) {
    while (true) {
      const result2 = form(depth);
      if (result2 !== discard) return result2;
    }
  }
  function form(depth) {
    if (depth > maxDepth) fail(`EDN nesting exceeds ${maxDepth} levels`);
    space();
    if (cursor >= source.length) fail("Unexpected end of EDN data");
    const char = source[cursor];
    const start = cursor;
    if (char === '"') return string2();
    if (source.startsWith("#_", cursor)) {
      cursor += 2;
      nextValue(depth + 1);
      return discard;
    }
    const set = source.startsWith("#{", cursor);
    if (set || char === "{" || char === "[" || char === "(") {
      cursor += set ? 2 : 1;
      const closing = set || char === "{" ? "}" : char === "[" ? "]" : ")";
      const values = [];
      const capture = spans && (!options.rootSpanOnly || depth === 0);
      const positions = capture && !options.rootSpanOnly ? [] : void 0;
      while (true) {
        space();
        if (cursor >= source.length) fail("Unterminated collection");
        if (source[cursor] === closing) {
          cursor++;
          break;
        }
        if ("}])".includes(source[cursor])) fail("Mismatched collection delimiter");
        const childStart = cursor, value = form(depth + 1);
        if (value !== discard) {
          values.push(value);
          positions?.push({ start: childStart, end: cursor });
        }
      }
      if (set) Object.defineProperty(values, ednSet, { value: true });
      if (set || char !== "{") {
        if (capture) spans.set(values, { start, end: cursor, ...positions ? { items: positions } : {} });
        return values;
      }
      if (values.length % 2 !== 0) fail("EDN map requires key/value pairs");
      const result2 = /* @__PURE__ */ Object.create(null);
      const fields = positions ? /* @__PURE__ */ Object.create(null) : void 0;
      for (let index = 0; index < values.length; index += 2) {
        const key = values[index];
        if (key !== null && typeof key === "object") fail("Collection map keys are not supported");
        const name = String(key);
        if (Object.hasOwn(result2, name)) fail(`Duplicate EDN map key ${name}`);
        result2[name] = values[index + 1];
        if (fields && positions) fields[name] = { keyStart: positions[index].start, ...positions[index + 1] };
      }
      if (capture) spans.set(result2, { start, end: cursor, ...fields ? { fields } : {} });
      return result2;
    }
    if ("}])".includes(char)) fail("Unexpected collection delimiter");
    if (char === "\\") {
      cursor++;
      if ('[]{}()";'.includes(source[cursor] ?? "") && cursor < source.length) return source[cursor++];
      const value = token();
      const names = { newline: "\n", return: "\r", space: " ", tab: "	", backspace: "\b", formfeed: "\f" };
      if (Object.hasOwn(names, value)) return names[value];
      if (/^u[\da-f]{4}$/i.test(value)) return String.fromCharCode(parseInt(value.slice(1), 16));
      if ([...value].length === 1) return value;
      return fail("Invalid character literal");
    }
    const atom = token();
    if (["##NaN", "##Inf", "##-Inf"].includes(atom)) {
      onNonFinite();
      return null;
    }
    if (atom.startsWith("#")) {
      if (!/^#[a-zA-Z][\w./-]*$/.test(atom)) fail("Unsupported EDN dispatch");
      const tagged = { ":edn/tag": atom.slice(1), ":edn/value": nextValue(depth + 1) };
      if (spans && (!options.rootSpanOnly || depth === 0)) spans.set(tagged, { start, end: cursor });
      return tagged;
    }
    if (atom === "nil") return null;
    if (atom === "true") return true;
    if (atom === "false") return false;
    if (/^[+-]?\d+N$/.test(atom)) return atom.slice(0, -1);
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?M?$/.test(atom)) {
      const value = Number(atom.replace(/M$/, ""));
      if (!Number.isFinite(value)) {
        onNonFinite();
        return null;
      }
      return Number.isInteger(value) && !Number.isSafeInteger(value) ? atom : value;
    }
    return atom;
  }
  const result = nextValue(0);
  space();
  while (source.startsWith("#_", cursor)) {
    form(0);
    space();
  }
  if (cursor !== source.length) fail("Unexpected trailing EDN data");
  return result;
}

// shared/item-classification.ts
var itemFormTags = ["necklace", "amulet", "ring", "cloak", "boots", "gloves", "belt", "bracers", "headwear", "eyewear", "robe", "bag", "instrument", "tattoo", "figurine"];
function inferItemTags(name) {
  const words = name.toLowerCase().replace(/[^a-z]+/g, " ");
  const patterns = { necklace: /\bnecklace\b/, amulet: /\b(amulet|periapt|medallion)\b/, ring: /\bring\b/, cloak: /\b(cloak|cape|mantle)\b/, boots: /\b(boots|slippers|sandals)\b/, gloves: /\b(gloves|gauntlets)\b/, belt: /\bbelt\b/, bracers: /\bbracers\b/, headwear: /\b(helm|helmet|hat|headband|circlet|crown|cap)\b/, eyewear: /\b(eyes|goggles|spectacles)\b/, robe: /\brobe\b/, bag: /\b(bag|sack|haversack|pouch)\b/, instrument: /\b(instrument|horn|pipes|drums|lute|lyre|flute|harp)\b/, tattoo: /\btattoo\b/, figurine: /\bfigurine\b/ };
  return itemFormTags.filter((tag) => patterns[tag].test(words));
}

// shared/monster-extensions.ts
function monsterRuleText(value) {
  let result = value;
  for (let depth = 0; depth < 12; depth++) {
    const next = result.replace(/\{@([a-zA-Z]+)(?:\s+([^{}]*))?\}/g, (original, tag, body = "") => {
      const [name = "", source = "", display = ""] = body.split("|");
      switch (tag.toLowerCase()) {
        case "spell":
        case "creature":
        case "item":
        case "condition":
        case "sense":
        case "skill":
        case "status":
        case "action":
        case "variantrule":
        case "hazard":
        case "disease":
        case "race":
        case "class":
        case "background":
        case "feat":
        case "cult":
        case "deity":
        case "reward":
        case "object":
        case "deck":
        case "language":
          return `${display || name}${source ? ` [${source}]` : ""}`;
        case "filter":
        case "link":
          return name;
        case "book":
        case "adventure":
        case "table":
          return name + (source ? ` [${source}]` : "");
        case "quickref":
          return body.split("|")[4] || name;
        case "style":
        case "footnote":
          return name;
        case "atkr":
          return name.split(",").map((part) => ({ m: "Melee", r: "Ranged", mw: "Melee Weapon", rw: "Ranged Weapon", ms: "Melee Spell", rs: "Ranged Spell" })[part.trim()] ?? part).join(" or ") + " Attack Roll:";
        case "actsav":
        case "actsave":
          return name.toUpperCase() + " Saving Throw:";
        case "actsavefail":
          return "Failure:";
        case "actsavesuccess":
          return "Success:";
        case "actsavesuccessorfail":
          return "Success or Failure:";
        case "actsavefailby":
          return "Failure by " + name + " or More:";
        case "acttrigger":
          return "Trigger:";
        case "actresponse":
          return "Response:";
        case "hityourspellattack":
          return "your spell attack modifier";
        case "dcyourspellsave":
          return "your spell save DC";
        case "hom":
          return "Hit or Miss:";
        case "skillcheck":
          return name + " " + (source ? `(${source})` : "");
        case "damage":
        case "dice":
        case "dc":
        case "chance":
        case "scaledice":
        case "scaledamage":
          return display || name;
        case "hit":
        case "initiative":
          return /^[+-]/.test(name) ? name : `+${name}`;
        case "h":
          return "Hit: ";
        case "recharge":
          return `Recharge ${name || "6"}${name && name !== "6" ? "\u20136" : ""}`;
        case "atk":
          return name.split(",").map((part) => ({ mw: "Melee Weapon", rw: "Ranged Weapon", ms: "Melee Spell", rs: "Ranged Spell" })[part.trim()] ?? part).join(" or ") + " Attack:";
        case "b":
        case "bold":
        case "i":
        case "italic":
        case "note":
          return body;
        default:
          return original;
      }
    });
    if (next === result) break;
    result = next;
  }
  return result;
}

// shared/five-tools-monster.ts
var object2 = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
var array = (v) => Array.isArray(v) ? v : [];
var string = (v) => typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
function fiveToolsText(value, depth = 0) {
  if (depth > 40) throw new Error("Monster reference nesting exceeds the supported depth.");
  const text = (v) => fiveToolsText(v, depth + 1);
  if (value === null || value === void 0) return "";
  if (typeof value !== "object") return monsterRuleText(string(value));
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("\n\n");
  const o = object2(value), kind = string(o.type);
  if (kind === "list") return array(o.items).map((v) => "\u2022 " + text(v)).join("\n");
  if (kind === "table") return [text(o.caption), array(o.colLabels).map(text).join(" | "), ...array(o.rows).map((row) => array(object2(row).row ?? row).map(text).join(" | ")), text(o.footnotes)].filter(Boolean).join("\n");
  if (kind === "image") return "";
  if (kind === "dice") return text(o.toRoll);
  const parts = [o.name ? string(o.name) + "." : "", text(o.entries ?? o.entry ?? o.items), text(o.headerEntries), text(o.footerEntries)];
  const known = /* @__PURE__ */ new Set(["type", "name", "entries", "entry", "items", "headerEntries", "footerEntries", "style", "source", "page", "data", "by", "from", "id", "caption", "colStyles", "colLabels", "rows", "footnotes"]);
  for (const [key, v] of Object.entries(o)) if (!known.has(key) && !key.startsWith("_") && v !== void 0) parts.push(`${key}: ${text(v)}`);
  if (o.by) parts.push("\u2014 " + string(o.by) + (o.from ? ", " + text(o.from) : ""));
  return parts.filter(Boolean).join("\n\n");
}

// shared/five-tools-item.ts
var obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
var str = (v) => typeof v === "string" || typeof v === "number" ? String(v) : "";
var list2 = (v) => Array.isArray(v) ? v : [];
var slug = (v) => str(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
var damage = { A: "acid", B: "bludgeoning", C: "cold", F: "fire", O: "force", L: "lightning", N: "necrotic", P: "piercing", I: "poison", Y: "psychic", R: "radiant", S: "slashing", T: "thunder" };
var types = { LA: "light", MA: "medium", HA: "heavy", S: "shield" };
var baseIndex = (name) => ({ "light-crossbow": "crossbow-light", "hand-crossbow": "crossbow-hand", "heavy-crossbow": "crossbow-heavy", "padded": "padded-armor", "leather": "leather-armor", "studded-leather": "studded-leather-armor", "hide": "hide-armor", "half-plate": "half-plate-armor", "splint": "splint-armor", "plate": "plate-armor" })[slug(name)] ?? slug(name);
function fiveToolsItemView(record) {
  const m = record.item, type = str(m.type).split("|")[0], armorType = types[type];
  const weapon = m.weapon === true || ["M", "R"].includes(type), armor = !!armorType;
  const category = weapon ? "weapon" : armor ? "armor" : { A: "ammunition", AF: "ammunition", P: "potion", RG: "ring", RD: "rod", SC: "scroll", SCF: "gear", SHP: "gear", SPC: "gear", WD: "wand", ST: "staff" }[type] ?? (m.wondrous ? "wondrous-items" : "gear");
  const attune = m.reqAttune !== void 0 && m.reqAttune !== false && m.reqAttune !== "", base = str(m._baseName || str(m.baseItem).split("|")[0] || m.name);
  const filterItem = {
    name: str(m.name),
    qty: 1,
    weight: typeof m.weight === "number" ? m.weight : 0,
    equipped: false,
    notes: "",
    magical: !record.mundane,
    category,
    kind: weapon ? "weapon" : armor ? "armour" : ["potion", "scroll", "ammunition"].includes(category) ? "consumable" : m.wondrous || ["ring", "rod", "staff", "wand"].includes(category) ? "accessory" : "gear",
    index: baseIndex(base),
    tags: inferItemTags(str(m.name)),
    rarity: str(m.rarity),
    requiresAttunement: attune,
    attunementRequirement: typeof m.reqAttune === "string" ? m.reqAttune : "",
    ...typeof m.value === "number" ? { value: { amount: m.value / 100, currency: "gp" } } : {},
    ...weapon ? { weapon: { dice: str(m.dmg1), damageType: damage[str(m.dmgType)] ?? str(m.dmgType), range: str(m.range) || (type === "R" ? "ranged" : "melee"), ranged: type === "R", finesse: list2(m.property).some((p) => str(p).split("|")[0] === "F"), category: str(m.weaponCategory) } } : {},
    ...armor ? { armor: { base: typeof m.ac === "number" ? m.ac : 0, dex: armorType === "light" || armorType === "medium", ...armorType === "medium" ? { cap: 2 } : {}, shield: armorType === "shield", category: armorType } } : {}
  };
  const stats = [];
  const add = (label, value) => {
    if (value !== void 0 && value !== null && str(value) !== "") stats.push([label, str(value)]);
  };
  add("Type", record.typeText || category);
  add("Rarity", m.rarity);
  add("Attunement", attune ? typeof m.reqAttune === "string" ? `Required ${m.reqAttune}` : "Required" : "Not required");
  add("Weight", m.weight === void 0 ? m.weightNote : `${m.weight} lb${m.weightNote ? " \xB7 " + m.weightNote : ""}`);
  add("Value", typeof m.value === "number" ? `${m.value / 100} gp` : m.value);
  add("Damage", m.dmg1 ? `${m.dmg1} ${damage[str(m.dmgType)] ?? str(m.dmgType)}` : void 0);
  add("Two-handed damage", m.dmg2);
  add("Range", m.range);
  add(armorType === "shield" ? "Shield AC bonus" : "Base AC", m.ac);
  add("Strength required", m.strength);
  add("Stealth", m.stealth ? "Disadvantage" : void 0);
  add("Properties", list2(m.property).map((p) => str(p).split("|")[0]).join(", "));
  add("Mastery", list2(m.mastery).map((p) => str(p).split("|")[0]).join(", "));
  add("Charges", m.charges);
  add("Recharge", m.recharge);
  add("Attacks / damage bonus", m.bonusWeapon);
  add("AC bonus", m.bonusAc);
  add("Saving throw bonus", m.bonusSavingThrow);
  add("Spell attack bonus", m.bonusSpellAttack);
  add("Spell save DC bonus", m.bonusSpellSaveDc);
  const images = list2(record.fluff?.images).flatMap((v) => {
    const image = obj(v), href = obj(image.href), url = href.type === "external" ? str(href.url) : href.type === "internal" ? "https://5e.tools/img/" + str(href.path) : "";
    return /^https:\/\//.test(url) ? [{ url, title: str(image.title) || str(m.name) }] : [];
  });
  const damageTypes = [...new Set([damage[str(m.dmgType)] ?? "", ...[...record.description.matchAll(/\b(?:\d+d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage\b/gi)].map((m2) => m2[1].toLowerCase())].filter(Boolean))];
  return { filterItem, damageTypes, stats, description: record.description || fiveToolsText(m._fullEntries ?? m.entries), info: fiveToolsText(record.fluff?.entries), images, sourceName: record.sourceName, page: m.page, upstream: "https://5e.tools/items.html#" + record.hash };
}

// server/lib/orcbrew-items.ts
function normalizeOrcbrewItem(key, value) {
  const raw = value, record = raw[":codex/item"];
  if (record?.item) {
    const view = fiveToolsItemView(record);
    return { name: String(raw[":name"] ?? record.item.name), url: "", itemReference: true, itemDamageTypes: view.damageTypes, workshopItem: view.filterItem, itemView: view };
  }
  return { name: String(raw[":name"] ?? key.replace(/^:/, "")), url: "", description: String(raw[":description"] ?? ""), desc: [String(raw[":description"] ?? "")], homebrew: true };
}

// shared/option-kinds.ts
var OPTION_KINDS = ["feats", "backgrounds", "invocations", "boons", "selections", "languages", "other", "subraces"];
var isOptionKind = (kind) => OPTION_KINDS.includes(kind);

// server/lib/orcbrew.ts
var ORCBREW_KINDS = [
  "spells",
  "races",
  "classes",
  "backgrounds",
  "feats",
  "subclasses",
  "subraces",
  "monsters",
  "languages",
  "invocations",
  "boons",
  "selections",
  "other",
  "equipment",
  "magic-items"
];
function canonicalContent(value) {
  function clean(item, depth = 0) {
    if (typeof item === "string") return item.replace(/\r\n?/g, "\n").trim();
    if (Array.isArray(item)) {
      const values = item.map((child) => clean(child, depth + 1));
      return isEdnSet(item) ? values.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en")) : values;
    }
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).filter(([key]) => key !== ":edit-event" && !(depth === 0 && [":option-pack", ":disabled?", ":key"].includes(key))).sort(([left], [right]) => left.localeCompare(right, "en")).map(([key, child]) => [key, clean(child, depth + 1)]));
    }
    return item;
  }
  return JSON.stringify(clean(value));
}
var get = (value, key) => value && typeof value === "object" ? value[`:${key}`] : void 0;
var mapValue = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
var listValue = (value) => Array.isArray(value) ? value : [];
var textValue = (value, fallback = "") => typeof value === "string" ? value : fallback;
var keyword = (value, fallback = "") => textValue(value, fallback).replace(/^:/, "");
var slug2 = (value) => value.replace(/^:/, "").split("/").pop().toLowerCase().replace(/[^a-z0-9]+/g, "-");
function entityIndex(key, value) {
  const itemKey = textValue(get(value, "key"), key);
  return slug2(itemKey);
}
function ref(index) {
  return { index, name: index.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), url: "" };
}
function normalizeSpell(key, value) {
  const spell = mapValue(value);
  const components = Object.entries(mapValue(get(spell, "components"))).filter(([, enabled]) => enabled === true || typeof enabled === "string" && enabled.trim() !== "").map(([name]) => ({ ":verbal": "V", ":somatic": "S", ":material": "M" })[name] ?? name.replace(/^:/, ""));
  const classes = Object.entries(mapValue(get(spell, "spell-lists"))).filter(([, enabled]) => enabled === true).map(([name]) => ref(slug2(name)));
  const description = textValue(get(spell, "description"));
  const normalized = {
    index: entityIndex(key, spell),
    name: textValue(get(spell, "name"), key.replace(/^:/, "").replace(/-/g, " ")),
    url: "",
    level: typeof get(spell, "level") === "number" ? get(spell, "level") : 0,
    school: ref(keyword(get(spell, "school"), "unknown").toLowerCase()),
    casting_time: textValue(get(spell, "casting-time")),
    range: textValue(get(spell, "range")),
    components,
    duration: textValue(get(spell, "duration")),
    concentration: /concentration/i.test(textValue(get(spell, "duration"))),
    ritual: get(spell, "ritual") === true || get(spell, "ritual?") === true,
    desc: description ? [description] : [],
    classes,
    homebrew: true
  };
  let native;
  const authored = get(value, "codex/spell");
  if (authored) try {
    const draft = restoreSpellDraft(authored);
    if (draft.body.name.trim() && draft.source.trim()) native = draft;
  } catch {
  }
  return native ? { ...applySpellBuilder({ ...normalized, ...native.body.level === 0 ? { damage: { damage_at_character_level: {} } } : {}, spellBuilder: native.body, benefits: native.benefits }, native.body), spellId: native.id, spellRevision: get(value, "codex/revision") } : normalized;
}
function normalizeRace(key, value) {
  const race = mapValue(value);
  const abilities = Object.entries(mapValue(get(race, "abilities"))).map(([ability, bonus]) => {
    const index = slug2(ability).split("-").pop();
    return { ability_score: ref(index), bonus: typeof bonus === "number" ? bonus : 0 };
  });
  const traits = listValue(get(race, "traits")).map((trait) => ({
    name: textValue(get(trait, "name"), "Racial trait"),
    description: textValue(get(trait, "description")),
    level: typeof get(trait, "level") === "number" ? get(trait, "level") : 1
  }));
  const languages = listValue(get(race, "languages")).map(
    (language) => typeof language === "string" ? { index: slug2(language), name: language, url: "" } : ref(slug2(String(language)))
  );
  return {
    index: entityIndex(key, race),
    name: textValue(get(race, "name"), key.replace(/^:/, "").replace(/-/g, " ")),
    url: "",
    speed: typeof get(race, "speed") === "number" ? get(race, "speed") : 30,
    ability_bonuses: abilities,
    alignment: "",
    age: "",
    size: keyword(get(race, "size"), "medium"),
    languages,
    language_desc: "",
    traits: traits.map((trait) => ({ index: slug2(trait.name), name: trait.name, url: "" })),
    subraces: [],
    homebrew_traits: traits,
    homebrew: true
  };
}
function normalizeClass(key, value) {
  const klass = mapValue(value);
  const profs = mapValue(get(klass, "profs"));
  const saves = Object.entries(mapValue(profs[":save"])).filter(([, enabled]) => enabled === true).map(([ability]) => ref(slug2(ability).split("-").pop()));
  const traits = listValue(get(klass, "traits")).map((trait) => ({
    name: textValue(get(trait, "name"), "Class feature"),
    description: textValue(get(trait, "description")),
    level: typeof get(trait, "level") === "number" ? get(trait, "level") : 1
  }));
  return {
    index: entityIndex(key, klass),
    name: textValue(get(klass, "name"), key.replace(/^:/, "").replace(/-/g, " ")),
    url: "",
    hit_die: typeof get(klass, "hit-die") === "number" ? get(klass, "hit-die") : 8,
    multi_classing: {},
    proficiencies: [],
    saving_throws: saves,
    starting_equipment: [],
    subclasses: [],
    homebrew_traits: traits,
    homebrew_subclass_title: textValue(get(klass, "subclass-title")),
    homebrew: true
  };
}
function normalizeBackground(key, value) {
  const background = mapValue(value);
  return {
    index: entityIndex(key, background),
    name: textValue(get(background, "name"), key.replace(/^:/, "").replace(/-/g, " ")),
    url: "",
    description: textValue(get(background, "help")),
    traits: listValue(get(background, "traits")).map((trait) => ({
      name: textValue(get(trait, "name"), "Background trait"),
      description: textValue(get(trait, "description"))
    })),
    equipment: mapValue(get(background, "equipment")),
    homebrew: true
  };
}
function normalizeFeat(key, value) {
  const feat = mapValue(value);
  return {
    index: entityIndex(key, feat),
    name: textValue(get(feat, "name"), key.replace(/^:/, "").replace(/-/g, " ")).trim(),
    url: "",
    description: textValue(get(feat, "description")),
    prerequisites: get(feat, "prereqs") ?? [],
    ability_increases: get(feat, "ability-increases") ?? [],
    homebrew: true
  };
}
function normalizeSubclass(key, value) {
  const subclass = mapValue(value);
  return {
    index: entityIndex(key, subclass),
    name: textValue(get(subclass, "name"), key.replace(/^:/, "").replace(/-/g, " ")),
    url: "",
    class: keyword(get(subclass, "class")).replace(/^.*\//, ""),
    traits: listValue(get(subclass, "traits")).map((trait) => ({
      name: textValue(get(trait, "name"), "Subclass feature"),
      description: textValue(get(trait, "description")),
      level: typeof get(trait, "level") === "number" ? get(trait, "level") : 1
    })),
    homebrew: true
  };
}
function normalizeGeneric(key, value) {
  return {
    index: entityIndex(key, value),
    name: textValue(get(value, "name"), keyword(key).replace(/-/g, " ")).trim(),
    url: "",
    description: textValue(get(value, "description"), textValue(get(value, "help"))),
    details: value,
    homebrew: true
  };
}
function normalizeSubrace(key, value) {
  const race = normalizeRace(key, value);
  return {
    ...race,
    race: keyword(get(value, "race")),
    racial_traits: race.traits,
    // A subrace without its own speed inherits its parent's speed.
    speed: typeof get(value, "speed") === "number" ? get(value, "speed") : void 0
  };
}
function normalizeMonster(key, value) {
  const hitPoints = mapValue(get(value, "hit-points"));
  const number = (item, fallback) => typeof item === "number" && Number.isFinite(item) ? item : fallback;
  const dice = number(hitPoints[":die-count"], 0);
  const die = number(hitPoints[":die"], 0);
  return {
    ...normalizeGeneric(key, value),
    size: keyword(get(value, "size")),
    type: keyword(get(value, "type")),
    challenge_rating: number(get(value, "challenge"), 0),
    hit_points: Math.floor(dice * (die + 1) / 2 + number(hitPoints[":modifier"], 0)),
    hit_dice: `${dice}d${die}`,
    armor_class: get(value, "armor-class") ?? null,
    speed: get(value, "speed") ?? "",
    traits: get(value, "traits") ?? []
  };
}
var normalizers = {
  spells: normalizeSpell,
  races: normalizeRace,
  classes: normalizeClass,
  backgrounds: normalizeBackground,
  feats: normalizeFeat,
  subclasses: normalizeSubclass,
  subraces: normalizeSubrace,
  monsters: normalizeMonster,
  languages: normalizeGeneric,
  invocations: normalizeGeneric,
  boons: normalizeGeneric,
  selections: normalizeGeneric,
  other: normalizeGeneric,
  equipment: normalizeOrcbrewItem,
  "magic-items": normalizeOrcbrewItem
};
function inspectOrcbrew(source) {
  let nonFiniteCount = 0;
  const root = readEdn(source, () => nonFiniteCount++);
  if (!root || typeof root !== "object" || Array.isArray(root)) throw new Error("Orcbrew content must be an EDN map");
  const entries = Object.fromEntries(ORCBREW_KINDS.map((kind) => [kind, []]));
  const report = {
    packCount: 0,
    entryCount: 0,
    disabledCount: 0,
    duplicateCount: 0,
    nonFiniteCount,
    counts: Object.fromEntries(ORCBREW_KINDS.map((kind) => [kind, 0])),
    warnings: []
  };
  const found = /* @__PURE__ */ new Set();
  let recognizedSections = 0;
  function visit(node, group, inheritedDisabled, depth) {
    if (depth > 16) throw new Error("Orcbrew pack nesting exceeds 16 levels");
    const sections = Object.keys(node).filter((key) => key.startsWith(":orcpub.dnd.e5/"));
    const disabled = inheritedDisabled || node[":disabled?"] === true;
    if (sections.length) report.packCount++;
    for (const section of sections) {
      recognizedSections++;
      const category = section.slice(":orcpub.dnd.e5/".length);
      const kind = ORCBREW_KINDS.includes(category) ? category : "other";
      if (kind === "other" && category !== "other") report.warnings.push(`Section ${category} is available as reference content.`);
      const contents = node[section];
      if (!contents || typeof contents !== "object" || Array.isArray(contents)) {
        throw new Error(`Section ${category} in ${group || "this file"} must be an EDN map`);
      }
      for (const [key, value] of Object.entries(contents)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error(`Entry ${key} in ${category} must be an EDN map`);
        }
        const contentKey = keyword(key);
        const fingerprint = (0, import_node_crypto.createHash)("sha256").update(JSON.stringify([category, contentKey, canonicalContent(value)])).digest("hex");
        const index = `homebrew-${kind}-${fingerprint.slice(0, 32)}`;
        const normalized = normalizers[kind](key, value);
        const native = get(value, "codex/option");
        if (isOptionKind(kind) && native?.version === 1 && native.kind === kind && native.body && Array.isArray(native.benefits)) {
          Object.assign(normalized, { optionBuilder: native.body, benefits: native.benefits, optionId: native.id, optionRevision: get(value, "codex/revision") });
          const body = native.body;
          if (kind === "languages") Object.assign(normalized, { script: body.script, type: body.languageType, typical_speakers: body.typicalSpeakers });
          if (kind === "selections") Object.assign(normalized, { choose: body.choiceGroup ? body.choiceGroup.choose : body.choose, options: body.choiceGroup ? (body.choiceGroup.options ?? []).map((n) => n.name) : body.options });
        }
        const entry = {
          ...normalized,
          name: String(normalized.name).trim(),
          index,
          contentKey,
          source: textValue(get(value, "option-pack"), group).trim(),
          disabled: disabled || get(value, "disabled?") === true,
          legacyKey: entityIndex(key, value),
          // Additional rule fields stay inspectable even when the sheet has no matching control.
          details: value,
          homebrew: true
        };
        if (found.has(index)) report.duplicateCount++;
        else {
          found.add(index);
          report.entryCount++;
          report.counts[kind]++;
        }
        if (entry.disabled) report.disabledCount++;
        entries[kind].push(entry);
      }
    }
    for (const [name, child] of Object.entries(node)) {
      if (name.startsWith(":") || !child || typeof child !== "object" || Array.isArray(child)) continue;
      visit(child, group ? `${group} / ${name}` : name, disabled, depth + 1);
    }
  }
  visit(root, "", false, 0);
  if (!recognizedSections) throw new Error("No Orcbrew content sections were found");
  if (nonFiniteCount) report.warnings.push(`${nonFiniteCount} non-finite numeric values are shown as unspecified; their source text is preserved.`);
  report.warnings = [...new Set(report.warnings)];
  return { entries, report };
}

// server/lib/orcbrew-background-worker.ts
import_node_worker_threads.parentPort.once("message", (source) => {
  try {
    const parsed = inspectOrcbrew(source), data = new TextEncoder().encode(JSON.stringify(parsed));
    if (data.byteLength > 64 * 1024 * 1024) throw Error("Parsed output limit");
    import_node_worker_threads.parentPort.postMessage({ data }, [data.buffer]);
  } catch {
    import_node_worker_threads.parentPort.postMessage({ error: "Pack parsing was unavailable" });
  }
  import_node_worker_threads.parentPort.close();
});

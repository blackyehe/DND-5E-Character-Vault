import mongoose from 'mongoose'

const { Schema } = mongoose

const stringArray = [String]

const abilitySchema = new Schema(
  {
    str: { type: Number, default: 10 },
    dex: { type: Number, default: 10 },
    int: { type: Number, default: 10 },
    wis: { type: Number, default: 10 },
    con: { type: Number, default: 10 },
    cha: { type: Number, default: 10 },
  },
  { _id: false },
)

const metaSchema = new Schema(
  {
    name: { type: String, default: 'New Character' },
    race: { type: String, default: '' },
    subrace: { type: String, default: '' },
    klass: { type: String, default: '' },
    subclass: { type: String, default: '' },
    background: { type: String, default: '' },
    level: { type: Number, default: 1, min: 1, max: 20 },
    alignment: { type: String, default: '' },
    xp: { type: Number, default: 0 },
    portrait: { type: String, default: '' },
    classIndex:String,subclassIndex:String,raceIndex:String,
    classLevels: { type: [{ name: String, index:String, subclass:String, subclassIndex:String, level: { type: Number, min: 1, max: 20 } }], default: undefined },
  },
  { _id: false },
)

const savesSchema = new Schema(
  {
    str: { type: Boolean, default: false },
    dex: { type: Boolean, default: false },
    int: { type: Boolean, default: false },
    wis: { type: Boolean, default: false },
    con: { type: Boolean, default: false },
    cha: { type: Boolean, default: false },
  },
  { _id: false },
)

// skill index -> 'none' | 'prof' | 'expert'
const skillsSchema = new Schema(
  {
    acrobatics: { type: String, default: 'none' },
    animalHandling: { type: String, default: 'none' },
    arcana: { type: String, default: 'none' },
    athletics: { type: String, default: 'none' },
    deception: { type: String, default: 'none' },
    history: { type: String, default: 'none' },
    insight: { type: String, default: 'none' },
    intimidation: { type: String, default: 'none' },
    investigation: { type: String, default: 'none' },
    medicine: { type: String, default: 'none' },
    nature: { type: String, default: 'none' },
    perception: { type: String, default: 'none' },
    performance: { type: String, default: 'none' },
    persuasion: { type: String, default: 'none' },
    religion: { type: String, default: 'none' },
    sleightOfHand: { type: String, default: 'none' },
    stealth: { type: String, default: 'none' },
    survival: { type: String, default: 'none' },
  },
  { _id: false },
)

const combatSchema = new Schema(
  {
    ac: { type: Number, default: 10 },
    hpMax: { type: Number, default: 10 },
    hpCurrent: { type: Number, default: 10 },
    hpTemp: { type: Number, default: 0 },
    hitDiceTotal: { type: Number, default: 1 },
    hitDiceUsed: { type: Number, default: 0 },
    deathSavesSuccess: { type: Number, default: 0 },
    deathSavesFailure: { type: Number, default: 0 },
    speed: { type: Number, default: 30 },
    inspiration: { type: Boolean, default: false },
    acMode: { type: String, enum: ['manual', 'equipment'], default: 'manual' },
    itemAcBaseline:Number,
  },
  { _id: false },
)

const attackSchema = new Schema(
  {
    name: { type: String, default: '' },
    ability: { type: String, default: 'str' },
    range: { type: String, default: '' },
    damageDice: { type: String, default: '' },
    damageBonus: { type: Number, default: 0 },
    damageType: { type: String, default: '' },
    notes: { type: String, default: '' },
    magicBonus: { type: Number, default: 0 },
    proficient: { type: Boolean },
    addAbilityDamage: { type: Boolean },
  },
  { _id: true },
)

const equipmentSchema = new Schema(
  {
    name: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    weight: { type: Number, default: 0 },
    equipped: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    index: String,
    magicIndex: String,
    category: String,
    tags: { type: [String], default: undefined },
    rarity: String,
    value: { type: new Schema({ amount: Number, currency: String }, { _id: false }), default: undefined },
    attunementRequirement: String,
    description: String,
    referenceDescription: String,
      kind:{type:String,enum:['weapon','armour','accessory','consumable','treasure','gear']},
      magical:Boolean,requiresAttunement:Boolean,attuned:Boolean,templateId:String,templateRevision:Number,grantId:String,
      effects:{type:new Schema({ac:{type:Number,default:0},saves:{type:Number,default:0}},{_id:false}),default:undefined},
    armor: { type: new Schema({ base: Number, dex: Boolean, cap: Number, shield: Boolean, category: String }, { _id: false }), default: undefined },
    weapon: { type: new Schema({ dice: String, damageType: String, range: String, finesse: Boolean, ranged: Boolean, category: String, noDamage: Boolean }, { _id: false }), default: undefined },
    magicBonus: Number,
  },
  { _id: true },
)

const spellSlotSchema = new Schema(
  {
    max: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    recovery: { type: String, enum: ['short', 'long'] },
  },
  { _id: false },
)

const spellcastingSchema = new Schema(
  {
    ability: { type: String, default: 'int' },
    limitOverride:Boolean,
    slotRule: { type: new Schema({ progression: { type: String, enum: ['full', 'half', 'third', 'pact'], required: true }, className: String, workshopId:String }, { _id: false }), default: undefined },
    slots: {
      type: new Schema({
        l1: { type: spellSlotSchema, default: () => ({}) },
        l2: { type: spellSlotSchema, default: () => ({}) },
        l3: { type: spellSlotSchema, default: () => ({}) },
        l4: { type: spellSlotSchema, default: () => ({}) },
        l5: { type: spellSlotSchema, default: () => ({}) },
        l6: { type: spellSlotSchema, default: () => ({}) },
        l7: { type: spellSlotSchema, default: () => ({}) },
        l8: { type: spellSlotSchema, default: () => ({}) },
        l9: { type: spellSlotSchema, default: () => ({}) },
      }, { _id: false }),
      default: () => ({}),
    },
    prepared: { type: stringArray, default: [] },
    activeEffects: { type: [String], default: undefined },
    known: { type: stringArray, default: [] },
  },
  { _id: false },
)

const personalitySchema = new Schema(
  {
    traits: { type: String, default: '' },
    ideals: { type: String, default: '' },
    bonds: { type: String, default: '' },
    flaws: { type: String, default: '' },
    appearance: { type: String, default: '' },
    backstory: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false },
)

const featureSchema = new Schema(
  {
    ruleId:String,featureId:String,selectedOptions:{type:[String],default:undefined},
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    origin: { type: String, enum: ['racial', 'class', 'subclass', 'background', 'feat', 'other'] },
    level: { type: Number, min: 1, max: 20 },
    pinned: Boolean,
    combatHidden: Boolean,
    order: Number,
  },
  { _id: true },
)

const proficienciesSchema = new Schema(
  {
    armor: { type: stringArray, default: [] },
    weapons: { type: stringArray, default: [] },
    tools: { type: stringArray, default: [] },
    languages: { type: stringArray, default: [] },
  },
  { _id: false },
)

const characterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companionKind: { type: String, enum: ['shadow-champion'] },
    meta: { type: metaSchema, default: () => ({}) },
    abilities: { type: abilitySchema, default: () => ({}) },
    saves: { type: savesSchema, default: () => ({}) },
    skills: { type: skillsSchema, default: () => ({}) },
    combat: { type: combatSchema, default: () => ({}) },
    externalImport: { type: Schema.Types.Mixed },
    homebrew:{type:Schema.Types.Mixed},
    compendiumRules:{type:[Schema.Types.Mixed],default:undefined},
    attacks: { type: [attackSchema], default: [] },
    equipment: { type: [equipmentSchema], default: [] },
    spellcasting: { type: spellcastingSchema, default: () => ({}) },
    personality: { type: personalitySchema, default: () => ({}) },
    features: { type: [featureSchema], default: [] },
    resources: { type: [new Schema({ id: { type: String, required: true }, name: { type: String, required: true }, ruleId:String, max: { type: Number, min: 0, max: 999, default: 0 }, used: { type: Number, min: 0, max: 999, default: 0 }, recovery: { type: String, enum: ['short', 'long', 'manual'], default: 'long' }, automatic: Boolean, unlimited: Boolean, notes: String, scaling: { type: new Schema({ perLevel: { type: Number, min: 0, max: 999, required: true }, base: { type: Number, min: 0, max: 999, required: true }, className: String }, { _id: false }), default: undefined } }, { _id: false })], default: [] },
    proficiencies: { type: proficienciesSchema, default: () => ({}) },
  },
  { timestamps: true },
)

export const Character = mongoose.model('Character', characterSchema)

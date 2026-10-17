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
  },
  { _id: true },
)

const spellSlotSchema = new Schema(
  {
    max: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
  },
  { _id: false },
)

const spellcastingSchema = new Schema(
  {
    ability: { type: String, default: 'int' },
    slots: {
      type: {
        l1: { type: spellSlotSchema, default: () => ({}) },
        l2: { type: spellSlotSchema, default: () => ({}) },
        l3: { type: spellSlotSchema, default: () => ({}) },
        l4: { type: spellSlotSchema, default: () => ({}) },
        l5: { type: spellSlotSchema, default: () => ({}) },
        l6: { type: spellSlotSchema, default: () => ({}) },
        l7: { type: spellSlotSchema, default: () => ({}) },
        l8: { type: spellSlotSchema, default: () => ({}) },
        l9: { type: spellSlotSchema, default: () => ({}) },
      },
      default: () => ({}),
    },
    prepared: { type: stringArray, default: [] },
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
    name: { type: String, default: '' },
    description: { type: String, default: '' },
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
    meta: { type: metaSchema, default: () => ({}) },
    abilities: { type: abilitySchema, default: () => ({}) },
    saves: { type: savesSchema, default: () => ({}) },
    skills: { type: skillsSchema, default: () => ({}) },
    combat: { type: combatSchema, default: () => ({}) },
    attacks: { type: [attackSchema], default: [] },
    equipment: { type: [equipmentSchema], default: [] },
    spellcasting: { type: spellcastingSchema, default: () => ({}) },
    personality: { type: personalitySchema, default: () => ({}) },
    features: { type: [featureSchema], default: [] },
    proficiencies: { type: proficienciesSchema, default: () => ({}) },
  },
  { timestamps: true },
)

export const Character = mongoose.model('Character', characterSchema)

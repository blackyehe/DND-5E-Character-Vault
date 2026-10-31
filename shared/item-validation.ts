/** Match ordinary dice or explicit fixed base damage; special effects stay manual. */
export const WEAPON_DAMAGE_PATTERN='([0-9]{1,2}[dD][0-9]{1,3}(\\s*(\\+|-)\\s*[0-9]{1,3})?|[0-9]{1,4})'
const weaponDamage=new RegExp(`^(?:${WEAPON_DAMAGE_PATTERN})$`)
export const validWeaponDamage=(value:string)=>weaponDamage.test(value)
export const MAX_ITEM_RULE_TEXT=100000

export type RoomSection='party'|'characters'|'notebook'|'maps'
/** Previewing library content should keep the current library open rather than
 * opening an unrelated character sheet and all of its rule dependencies. */
export function previewSection(section:RoomSection,entering:boolean):RoomSection {
 if(section==='notebook'||section==='maps')return section
 return entering?'characters':'party'
}

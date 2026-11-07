import {api,ApiError} from './api'
import {homebrew,type HomebrewClass,type HomebrewSubclass,type HomebrewRace,type HomebrewSpell} from './srd'
import type {WorkshopLibraryInfo} from '../components/workshop/WorkshopPublish.vue'
export interface WorkshopStartup {classes:HomebrewClass[];subclasses:HomebrewSubclass[];races:HomebrewRace[];spells:HomebrewSpell[];library:WorkshopLibraryInfo}
export async function loadWorkshopStartup():Promise<WorkshopStartup>{
 try{return await api.get<WorkshopStartup>('/api/workshop/initial')}
 catch(error){
  // Supports an older backend during rollout. Never multiply a timeout or
  // authorization failure into five more expensive requests.
  if(!(error instanceof ApiError)||error.status!==404)throw error
  const [classes,subclasses,races,spells,library]=await Promise.all([homebrew.classes(),homebrew.subclasses(),homebrew.races(),homebrew.spells(),api.get<WorkshopLibraryInfo>('/api/workshop/library')])
  return{classes,subclasses,races,spells,library}
 }
}

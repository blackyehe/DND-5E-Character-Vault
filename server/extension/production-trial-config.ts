/** Production-only opt-in. No database settings or credentials are read here. */
export const TRIAL_PROJECT_ID = 'prj_tWB6rgEmOcNRRREmJep6pE3WFIjb'
export const TRIAL_WEBSITE_ORIGIN = 'https://dndoldal.vercel.app'
export const TRIAL_EXTENSION_ORIGIN = 'https://owlbear-character-sheet.vercel.app'
export const TRIAL_ROOM_ID = '6ad4ffe84cfe4585ee91134a'
export type ProductionTrialConfig = { websiteOrigin: string; extensionOrigin: string; roomId: string; epoch: string; mode: 'read-only' | 'play-controls'; rememberedConnections: boolean }

export function readProductionTrialConfig(input: NodeJS.ProcessEnv): ProductionTrialConfig | undefined {
  const mode = input.OWLBEAR_PRODUCTION_TRIAL
  const activation = input.OWLBEAR_PRODUCTION_REMEMBERED
  if (activation !== undefined && activation !== '1') throw new Error('Invalid production remembered-login activation.')
  if (activation === '1' && mode !== 'play-controls') throw new Error('Remembered production connections require play-controls mode.')
  if (mode !== 'read-only' && mode !== 'play-controls') return undefined
  if (input.VERCEL !== '1' || input.VERCEL_PROJECT_ID !== TRIAL_PROJECT_ID || input.OWLBEAR_SHARED_TEST) throw new Error('Production trial project identity mismatch.')
  if (input.OWLBEAR_TRIAL_WEBSITE_ORIGIN !== TRIAL_WEBSITE_ORIGIN || input.OWLBEAR_TRIAL_EXTENSION_ORIGIN !== TRIAL_EXTENSION_ORIGIN || input.OWLBEAR_TRIAL_ROOM_ID !== TRIAL_ROOM_ID) throw new Error('Production trial scope mismatch.')
  const epoch = input.OWLBEAR_TRIAL_EPOCH
  if (!epoch || !/^[A-Za-z0-9_-]{16,64}$/.test(epoch)) throw new Error('A new trial grant epoch is required.')
  return { websiteOrigin: TRIAL_WEBSITE_ORIGIN, extensionOrigin: TRIAL_EXTENSION_ORIGIN, roomId: TRIAL_ROOM_ID, epoch, mode, rememberedConnections: activation === '1' }
}

/** Pure configuration adapter shared by the deployed entrypoint and scope tests. */
export function productionBoundaryOptions(config: ProductionTrialConfig) {
  const scope = { roomId: config.roomId, epoch: config.epoch }
  return { websiteOrigin: config.websiteOrigin, extensionOrigins: [config.extensionOrigin], rememberedConnections: config.rememberedConnections, ...(config.mode === 'play-controls' ? { playTrial: scope } : { readOnlyTrial: scope }) }
}

/** Production-only opt-in. No database settings or credentials are read here. */
export const TRIAL_PROJECT_ID = 'prj_tWB6rgEmOcNRRREmJep6pE3WFIjb'
export const TRIAL_WEBSITE_ORIGIN = 'https://dndoldal.vercel.app'
export const TRIAL_EXTENSION_ORIGIN = 'https://owlbear-character-sheet.vercel.app'
export const TRIAL_ROOM_ID = '6ad4ffe84cfe4585ee91134a'
export type ProductionTrialConfig = { websiteOrigin: string; extensionOrigin: string; roomId: string; epoch: string; mode: 'read-only' | 'play-controls'; gameSessions: boolean }

export function readProductionTrialConfig(input: NodeJS.ProcessEnv): ProductionTrialConfig | undefined {
  const mode = input.OWLBEAR_PRODUCTION_TRIAL
  const game = input.OWLBEAR_PRODUCTION_GAME_SESSION
  if (input.OWLBEAR_PRODUCTION_REMEMBERED !== undefined) throw new Error('Remembered activation is not supported by the game-session package.')
  if (game !== undefined && game !== '12h') throw new Error('Invalid game-session activation.')
  if (game === '12h' && mode !== 'play-controls') throw new Error('Game sessions require production play-controls scope.')
  if (mode !== 'read-only' && mode !== 'play-controls') return undefined
  if (input.VERCEL !== '1' || input.VERCEL_PROJECT_ID !== TRIAL_PROJECT_ID || input.OWLBEAR_SHARED_TEST) throw new Error('Production trial project identity mismatch.')
  if (input.OWLBEAR_TRIAL_WEBSITE_ORIGIN !== TRIAL_WEBSITE_ORIGIN || input.OWLBEAR_TRIAL_EXTENSION_ORIGIN !== TRIAL_EXTENSION_ORIGIN || input.OWLBEAR_TRIAL_ROOM_ID !== TRIAL_ROOM_ID) throw new Error('Production trial scope mismatch.')
  const epoch = input.OWLBEAR_TRIAL_EPOCH
  if (!epoch || !/^[A-Za-z0-9_-]{16,64}$/.test(epoch)) throw new Error('A new trial grant epoch is required.')
  return { websiteOrigin: TRIAL_WEBSITE_ORIGIN, extensionOrigin: TRIAL_EXTENSION_ORIGIN, roomId: TRIAL_ROOM_ID, epoch, mode, gameSessions: game === '12h' }
}

export function productionBoundaryOptions(config: ProductionTrialConfig) {
  const scope = { roomId: config.roomId, epoch: config.epoch }
  return { websiteOrigin: config.websiteOrigin, extensionOrigins: [config.extensionOrigin], gameSessions: config.gameSessions, ...(config.mode === 'play-controls' ? { playTrial: scope } : { readOnlyTrial: scope }) }
}

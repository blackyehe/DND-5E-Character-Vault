/** Staging-only entrypoint guard. This module does not read or connect to a DB. */
export const SHARED_TEST_DATABASE = 'owlbear_shared_test'
export const LIVE_PROJECT_ID = 'prj_tWB6rgEmOcNRRREmJep6pE3WFIjb'
export type SharedTestConfig = {
  websiteOrigin: string
  extensionOrigin: string
  environmentId: string
  projectId: string
  database: typeof SHARED_TEST_DATABASE
  rememberedConnections: boolean
}

function testOrigin(value: string | undefined): string {
  if (!value) throw new Error('A shared-test HTTPS origin is required.')
  const url = new URL(value)
  if (url.protocol !== 'https:' || value !== url.origin || url.username || url.password ||
      ['dndoldal.vercel.app', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Shared-test origins must be canonical HTTPS test origins.')
  }
  return url.origin
}

export function readSharedTestConfig(input: NodeJS.ProcessEnv): SharedTestConfig {
  if (input.VERCEL !== '1' || input.OWLBEAR_SHARED_TEST !== '1') throw new Error('Shared-test entrypoint requires explicit Vercel test activation.')
  const projectId = input.OWLBEAR_SHARED_PROJECT_ID
  if (!projectId || !/^prj_[A-Za-z0-9]+$/.test(projectId) || projectId === LIVE_PROJECT_ID || input.VERCEL_PROJECT_ID !== projectId) {
    throw new Error('Shared-test project identity does not match a separate test project.')
  }
  if (input.MONGO_URI || input.MONGODB_URI || input.MONGO_DATABASE !== SHARED_TEST_DATABASE || input.MONGO_USER !== SHARED_TEST_DATABASE ||
      !input.MONGO_HOST || !/^[a-z0-9.-]+\.mongodb\.net$/i.test(input.MONGO_HOST) || !input.MONGO_PASSWORD) {
    throw new Error('Shared-test requires its dedicated Atlas database/user settings; direct URIs are refused.')
  }
  if (!input.JWT_SECRET || input.JWT_SECRET.length < 32 || input.JWT_SECRET === 'dev-secret-change-in-production') throw new Error('Shared-test requires a new account signing secret.')
  const websiteOrigin = testOrigin(input.OWLBEAR_SHARED_WEBSITE_ORIGIN)
  const extensionOrigin = testOrigin(input.OWLBEAR_SHARED_EXTENSION_ORIGIN)
  if (websiteOrigin === extensionOrigin) throw new Error('Shared-test website and extension origins must differ.')
  const environmentId = input.OWLBEAR_SHARED_ENVIRONMENT_ID
  if (!environmentId || !/^[A-Za-z0-9_-]{16,64}$/.test(environmentId)) throw new Error('Shared-test environment identity is required.')
  const activation = input.OWLBEAR_SHARED_REMEMBERED
  if (activation !== undefined && activation !== '0' && activation !== '1') throw new Error('Invalid shared-test remembered-login activation.')
  const rememberedConnections = activation === '1'
  if (rememberedConnections && (projectId !== 'prj_18GWqWwAU92VJ5hTDXtmjxpxFSLR' ||
      websiteOrigin !== 'https://dndoldal-owlbear-test.vercel.app' || extensionOrigin !== 'https://owlbear-character-sheet-test.vercel.app')) {
    throw new Error('Remembered HTTPS testing is limited to the approved isolated projects and origins.')
  }
  return { websiteOrigin, extensionOrigin, environmentId, projectId, database: SHARED_TEST_DATABASE, rememberedConnections }
}

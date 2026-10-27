// Scoped deployment entrypoint; ordinary website startup remains unchanged.
import ordinary from '../app'
import { connectDb } from '../db'
import { createExtensionApp } from './api'
import { createProductionTrialApp } from './production-trial-app'
import { readProductionTrialConfig, productionBoundaryOptions } from './production-trial-config'
import { duringInitialization } from './initialization-diagnostic'

export default createProductionTrialApp(ordinary, () => readProductionTrialConfig(process.env), async config => {
  await duringInitialization('database', connectDb) // Existing website-owned connection; no extension database credentials.
  return createExtensionApp(productionBoundaryOptions(config))
})

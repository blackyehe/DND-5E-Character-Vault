import {ORCBREW_KINDS, inspectOrcbrew, sourceHash, type OrcbrewReport} from './orcbrew'

// Bump when parser/report semantics change. This is derived, never source truth.
export const PACK_SUMMARY_VERSION = 'orcbrew-report-1'
export const PACK_SUMMARY_MAX_BYTES = 64 * 1024
export interface StoredPackSummary {version: string; sourceHash: string; sourceUpdatedAt?: string; report: OrcbrewReport}
export interface PackSummaryRecord {_id: unknown; sourceHash?: unknown; updatedAt?: unknown; data: unknown}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0
function validReport(value: unknown): value is OrcbrewReport {
  const report = record(value), counts = record(report.counts)
  return ['packCount','entryCount','disabledCount','duplicateCount','nonFiniteCount'].every(key => count(report[key]))
    && ORCBREW_KINDS.every(kind => count(counts[kind]))
    && ORCBREW_KINDS.reduce((sum, kind) => sum + Number(counts[kind]), 0) === report.entryCount
    && Array.isArray(report.warnings) && report.warnings.every(w => typeof w === 'string')
}
const copyReport = (report: OrcbrewReport): OrcbrewReport => ({packCount:report.packCount,entryCount:report.entryCount,disabledCount:report.disabledCount,duplicateCount:report.duplicateCount,nonFiniteCount:report.nonFiniteCount,counts:{...report.counts},warnings:[...report.warnings]})

/** Supplied reports must come from the server's just-completed parse. Incoming
 * backup/upload cache fields are overwritten, not trusted. Oversize reports
 * retain the exact legacy fallback rather than silently dropping warnings. */
export function storedPackSummary(source: string, report = inspectOrcbrew(source).report, sourceUpdatedAt?: Date): StoredPackSummary | undefined {
  if (!validReport(report)) throw Error('Invalid derived pack report')
  const result: StoredPackSummary = {version:PACK_SUMMARY_VERSION,sourceHash:sourceHash(source),report:copyReport(report),...(sourceUpdatedAt ? {sourceUpdatedAt:sourceUpdatedAt.toISOString()} : {})}
  return Buffer.byteLength(JSON.stringify(result)) <= PACK_SUMMARY_MAX_BYTES ? result : undefined
}

/** Every read first obtains current, owner-scoped metadata from MongoDB. A cold
 * process can use a matching report without reading source bytes or parsing. */
export function cachedPackReport(doc: PackSummaryRecord): OrcbrewReport | undefined {
  const summary = record(record(doc.data).packReport)
  if (summary.version !== PACK_SUMMARY_VERSION || typeof summary.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(summary.sourceHash) || !validReport(summary.report)) return
  if (typeof doc.sourceHash === 'string') {if (summary.sourceHash !== doc.sourceHash) return}
  else if (!(doc.updatedAt instanceof Date) || !Number.isFinite(doc.updatedAt.getTime()) || summary.sourceUpdatedAt !== doc.updatedAt.toISOString()) return
  if (Buffer.byteLength(JSON.stringify(summary)) > PACK_SUMMARY_MAX_BYTES) return
  return copyReport(summary.report)
}

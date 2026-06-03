/**
 * Pipeline 主入口
 */

export { runPipeline } from './orchestrator'
export type { PipelineConfig, StageCallback } from './orchestrator'

export { synthesizeSignal, parseSignalFromText } from './signal'
export type { SignalComponents, SignalWeights, SynthesizedSignal } from './signal'

export { saveCheckpoint, loadLatestCheckpoint, restoreStateFromCheckpoint } from './checkpointer'
export type { Checkpoint, TradeMemory } from './checkpointer'

export { analyzePerformance, buildReflectionContext } from './reflection'
export type { ReflectionResult } from './reflection'

export { parseRating } from '../schemas'

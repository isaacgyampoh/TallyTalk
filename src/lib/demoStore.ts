import type { SampleTask } from './sampleData'

// Tasks created during a demo session, keyed by contact id. In-memory only —
// resets on reload, which is exactly what a sample-data demo wants.
const extra: Record<string, SampleTask[]> = {}

export function addDemoTask(contactId: string, task: SampleTask) {
  ;(extra[contactId] ||= []).push(task)
}

export function getDemoTasks(contactId: string): SampleTask[] {
  return extra[contactId] || []
}

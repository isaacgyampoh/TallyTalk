import type { SampleTask, SampleGroup } from './sampleData'

// In-memory demo state (resets on reload — exactly what a sample demo wants).

// --- quick-added tasks, keyed by contact id ---
const extra: Record<string, SampleTask[]> = {}
export function addDemoTask(contactId: string, task: SampleTask) {
  ;(extra[contactId] ||= []).push(task)
}
export function getDemoTasks(contactId: string): SampleTask[] {
  return extra[contactId] || []
}

// --- custom personal checklists ---
export interface CustomList {
  id: string
  title: string
}
const customLists: CustomList[] = []
export function addCustomList(title: string): string {
  const id = `custom-${Date.now()}`
  customLists.unshift({ id, title })
  return id
}
export function getCustomLists(): CustomList[] {
  return customLists
}
export function getCustomList(id: string): CustomList | undefined {
  return customLists.find((l) => l.id === id)
}

// --- custom groups ---
const customGroups: SampleGroup[] = []
export function addCustomGroup(name: string): SampleGroup {
  const g: SampleGroup = {
    id: `grp-${Date.now()}`,
    name,
    members: 1,
    open: 0,
    done: 0,
    color: '#6600FF',
    description: 'Your new group — add members and shared tasks.',
    memberList: [
      { id: 'you', name: 'You', initials: 'IS', color: '#6600FF', role: 'administrator' },
    ],
    tasks: [],
  }
  customGroups.unshift(g)
  return g
}
export function getCustomGroups(): SampleGroup[] {
  return customGroups
}
export function getCustomGroup(id: string): SampleGroup | undefined {
  return customGroups.find((g) => g.id === id)
}

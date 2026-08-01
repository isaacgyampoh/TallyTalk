import { SAMPLE_CONTACTS } from './sampleData'
import type { Priority } from './config'

export interface Parsed {
  title: string
  contactId?: string
  contactName?: string
  priority: Priority
  expected: string
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const has = (s: string, re: RegExp) => re.test(s)

/**
 * Rule-based "AI" quick-add for the demo. Turns a sentence into a structured
 * task. Designed so it can later be swapped for a real model call without
 * changing callers.
 */
export function smartParse(input: string): Parsed {
  const raw = input.trim()
  const lower = raw.toLowerCase()

  let priority: Priority = 'normal'
  if (has(lower, /\b(urgent|asap|immediately|right away|critical|now)\b/)) priority = 'urgent'
  else if (has(lower, /\b(important|high priority|high|priority)\b/)) priority = 'high'
  else if (has(lower, /\b(low|whenever|sometime|no rush|eventually)\b/)) priority = 'low'

  let expected = 'This Week'
  if (has(lower, /\b(today|tonight|this evening)\b/)) expected = 'Today'
  else if (has(lower, /\bnext week\b/)) expected = 'Next Week'
  else if (has(lower, /\b(this month|end of (the )?month|month end)\b/)) expected = 'This Month'
  else if (has(lower, /\btomorrow\b/)) expected = 'This Week'
  else if (has(lower, /\bthis week\b/) || DAYS.some((d) => has(lower, new RegExp('\\b' + d + '\\b')))) expected = 'This Week'

  let contactId: string | undefined
  let contactName: string | undefined
  for (const c of SAMPLE_CONTACTS) {
    const first = c.name.split(' ')[0].toLowerCase()
    if (has(lower, new RegExp('\\b' + first + '\\b')) || lower.includes(c.name.toLowerCase())) {
      contactId = c.id
      contactName = c.name
      break
    }
  }

  let title = raw
    .replace(/^\s*(please\s+)?(ask|tell|remind|get|have)\s+[a-z]+\s+to\s+/i, '')
  if (contactName) {
    const first = contactName.split(' ')[0]
    title = title.replace(new RegExp(contactName, 'ig'), '').replace(new RegExp('\\b' + first + '\\b', 'ig'), '')
  }
  title = title.replace(
    /\b(by|before|on|due|this|next)?\s*(today|tonight|this evening|tomorrow|next week|this week|this month|end of (the )?month|month end)\b/gi,
    '',
  )
  DAYS.forEach((d) => (title = title.replace(new RegExp('\\b(by|on)?\\s*' + d + '\\b', 'gi'), '')))
  title = title.replace(
    /\b(urgent|asap|immediately|right away|critical|important|high priority|high|priority|low|whenever|sometime|no rush|eventually)\b/gi,
    '',
  )
  title = title.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').replace(/^(to|for|the)\s+/i, '').trim()
  if (title) title = title[0].toUpperCase() + title.slice(1)
  if (!title) title = raw

  return { title, contactId, contactName, priority, expected }
}

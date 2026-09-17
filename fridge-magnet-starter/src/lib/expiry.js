import { colors } from '../theme'

// "YYYY-MM-DD" from a Date's own local calendar fields — never
// toISOString(), which converts through UTC first and can silently land
// on the wrong calendar day near midnight depending on the visitor's
// timezone offset.
export function toLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Whole calendar days between today and a "YYYY-MM-DD" date, ignoring
// time of day — so an item that expires today reads 0, not a fraction.
export function daysUntil(dateString) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateString}T00:00:00`)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

// Colour is never the only signal — every tier also carries words, so the
// view still works if you're colour-blind or the screen is in bright sun.
export function urgency(days) {
  if (days < 0) {
    const n = Math.abs(days)
    return { tier: 'overdue', label: `${n} day${n === 1 ? '' : 's'} overdue`, color: colors.danger }
  }
  if (days === 0) {
    return { tier: 'soon', label: 'Use today', color: colors.warning }
  }
  if (days <= 3) {
    return { tier: 'soon', label: `${days} day${days === 1 ? '' : 's'} left`, color: colors.warning }
  }
  return { tier: 'week', label: `${days} days left`, color: colors.mutedText }
}

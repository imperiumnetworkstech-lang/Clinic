/** Date and time formatting in clinic local time (Goa, Asia/Kolkata). */

/** Appointment time in clinic local time, e.g. "10:30 am". */
export function goaTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

export const goaDate = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));

export function slotLabel(hhmm: string): string {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number);
  const hour12 = ((hours + 11) % 12) + 1;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
}

/** An ISO date (YYYY-MM-DD) as e.g. "Wed, 4 Nov 2026". */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

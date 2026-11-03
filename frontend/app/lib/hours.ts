import clinicData from '../../../content/clinic.json';

export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Day = (typeof DAYS)[number];

type Interval = { open: string; close: string };
export type WeeklyHours = Record<Day, Interval[]>;

/** Confirmed weekly hours per branch; null when the clinic hasn't confirmed them yet. */
export function weeklyHours(branchId: string): WeeklyHours | null {
  const location = clinicData.locations.find((entry) => entry.id === branchId);
  const hours = location?.openingHours;
  if (typeof hours !== 'object' || hours === null || !('weekly' in hours)) return null;
  return hours.weekly as WeeklyHours;
}

const DAY_LABEL: Record<Day, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const dayLabel = (day: Day) => DAY_LABEL[day];

/** "10:00" → "10 am"; "20:30" → "8:30 pm". */
export function formatTime(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

export function formatIntervals(intervals: Interval[]): string {
  return intervals.length
    ? intervals.map((i) => `${formatTime(i.open)} – ${formatTime(i.close)}`).join(', ')
    : 'Closed';
}

/** Current weekday and minutes since midnight in Goa (Asia/Kolkata), whatever the device timezone. */
export function nowInGoa(date = new Date()): { day: Day; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: get('weekday').toLowerCase() as Day,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
};

export interface OpenStatus {
  open: boolean;
  label: string;
}

/** "Open now · closes 8 pm" / "Closed · opens 10 am" / "Closed · opens Monday 10 am". */
export function openStatus(hours: WeeklyHours, date = new Date()): OpenStatus {
  const { day, minutes } = nowInGoa(date);
  const today = hours[day];
  const current = today.find((i) => minutes >= toMinutes(i.open) && minutes < toMinutes(i.close));
  if (current) return { open: true, label: `Open now · closes ${formatTime(current.close)}` };

  const laterToday = today.find((i) => toMinutes(i.open) > minutes);
  if (laterToday) return { open: false, label: `Closed · opens ${formatTime(laterToday.open)}` };

  const start = DAYS.indexOf(day);
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = DAYS[(start + offset) % 7] as Day;
    const first = hours[next][0];
    if (first) {
      const when = offset === 1 ? 'tomorrow' : dayLabel(next);
      return { open: false, label: `Closed · opens ${when} ${formatTime(first.open)}` };
    }
  }
  return { open: false, label: 'Closed' };
}

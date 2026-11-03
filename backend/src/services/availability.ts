import type { AvailabilityDay, AvailableSlot } from '@edc/shared';
import { Op, type Transaction } from 'sequelize';
import {
  Appointment,
  Holiday,
  Location,
  LocationSchedule,
  SLOT_HOLDING,
  type DayKey,
} from '../models/index.js';

/**
 * Slot availability for a branch. Both branches are in Goa (Asia/Kolkata, UTC+05:30, no
 * daylight saving), so local wall-clock times convert to UTC with a fixed offset.
 */
const IST_OFFSET = '+05:30';
const DAY_KEYS: DayKey[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const todayInGoa = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const atGoaTime = (isoDate: string, hhmm: string) => new Date(`${isoDate}T${hhmm}:00${IST_OFFSET}`);

function minutesToHhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export interface BranchBooking {
  location: Location;
  schedule: LocationSchedule;
}

/** The branch and its schedule, or null when online booking is not set up for it. */
export async function bookableBranch(
  slug: string,
  transaction?: Transaction,
): Promise<BranchBooking | null> {
  const location = await Location.findOne({ where: { slug, active: true }, transaction });
  if (!location) return null;
  const schedule = await LocationSchedule.findOne({
    where: { locationId: location.id, active: true },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  return schedule ? { location, schedule } : null;
}

/** Every slot on one date (empty when closed), each marked available or taken. */
export async function slotsForDay(
  { location, schedule }: BranchBooking,
  date: string,
  now = new Date(),
  transaction?: Transaction,
): Promise<AvailableSlot[]> {
  const today = todayInGoa(now);
  if (date < today || date > addDays(today, schedule.maxDaysAhead)) return [];

  const closed = await Holiday.count({ where: { locationId: location.id, date }, transaction });
  if (closed) return [];

  const weekday = DAY_KEYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as DayKey;
  const intervals = schedule.weekly[weekday] ?? [];
  const earliest = now.getTime() + schedule.minNoticeMinutes * 60_000;

  const candidates: Array<{ start: Date; end: Date; time: string }> = [];
  for (const interval of intervals) {
    const close = toMinutes(interval.close);
    for (
      let m = toMinutes(interval.open);
      m + schedule.slotMinutes <= close;
      m += schedule.slotMinutes
    ) {
      const time = minutesToHhmm(m);
      const start = atGoaTime(date, time);
      if (start.getTime() < earliest) continue;
      candidates.push({
        start,
        end: new Date(start.getTime() + schedule.slotMinutes * 60_000),
        time,
      });
    }
  }
  const first = candidates[0];
  const last = candidates[candidates.length - 1];
  if (!first || !last) return [];

  const booked = await Appointment.findAll({
    where: {
      locationId: location.id,
      status: { [Op.in]: SLOT_HOLDING },
      startAt: { [Op.lt]: last.end },
      endAt: { [Op.gt]: first.start },
    },
    attributes: ['startAt', 'endAt'],
    transaction,
  });

  return candidates.map(({ start, end, time }) => {
    const overlapping = booked.filter((a) => a.startAt < end && a.endAt > start).length;
    return { start: start.toISOString(), time, available: overlapping < schedule.capacity };
  });
}

/** Which of the next `days` days have free slots (drives the date picker). */
export async function availabilityOverview(
  branch: BranchBooking,
  from: string,
  days: number,
  now = new Date(),
): Promise<AvailabilityDay[]> {
  const result: AvailabilityDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);
    const slots = await slotsForDay(branch, date, now);
    result.push({
      date,
      open: slots.length > 0,
      availableCount: slots.filter((slot) => slot.available).length,
    });
  }
  return result;
}

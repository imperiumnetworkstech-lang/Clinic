import { BOOKING_CONSENT_VERSION, type SlotBookingBody } from '@edc/shared';
import { Op, fn, col, where as sqlWhere } from 'sequelize';
import { sequelize } from '../db/sequelize.js';
import { HttpError, badRequest } from '../lib/errors.js';
import { Appointment, Location, Patient, PatientConsent, SLOT_HOLDING } from '../models/index.js';
import { bookableBranch, slotsForDay, todayInGoa } from './availability.js';

/**
 * Books one free slot as a *pending* appointment (the front desk confirms it). The branch's
 * schedule row is locked for the transaction, so two patients can never take the last place
 * in the same slot at the same moment.
 */
export async function bookSlot(
  body: SlotBookingBody,
  meta: { ip: string | null },
): Promise<{ appointment: Appointment; patient: Patient }> {
  return sequelize.transaction(async (transaction) => {
    const branch = await bookableBranch(body.branch, transaction);
    if (!branch) {
      throw badRequest('online_booking_unavailable', 'Online booking is not open for this clinic.');
    }

    const start = new Date(body.slotStart);
    const date = todayInGoa(start);
    const slots = await slotsForDay(branch, date, new Date(), transaction);
    const slot = slots.find((candidate) => candidate.start === start.toISOString());
    if (!slot)
      throw badRequest('slot_invalid', 'That time is not bookable. Please choose another.');
    if (!slot.available) {
      throw new HttpError(
        409,
        'slot_taken',
        'Sorry, that time was just taken. Please choose another.',
      );
    }

    // Same phone + same name = the same person; a family sharing a phone gets separate profiles.
    let patient = await Patient.findOne({
      where: {
        phone: body.phone,
        [Op.and]: [sqlWhere(fn('lower', col('name')), body.name.toLowerCase())],
      },
      transaction,
    });
    if (!patient) {
      patient = await Patient.create(
        {
          name: body.name,
          phone: body.phone,
          email: body.email || null,
          dateOfBirth: null,
          gender: null,
          source: 'website',
          homeLocationId: branch.location.id,
        },
        { transaction },
      );
    } else if (body.email && !patient.email) {
      await patient.update({ email: body.email }, { transaction });
    }

    await PatientConsent.bulkCreate(
      (['data_processing', 'whatsapp_transactional'] as const).map((type) => ({
        patientId: patient.id,
        type,
        granted: true,
        channel: 'web' as const,
        textVersion: BOOKING_CONSENT_VERSION,
        ip: meta.ip,
        recordedBy: null,
      })),
      { transaction },
    );

    const appointment = await Appointment.create(
      {
        patientId: patient.id,
        locationId: branch.location.id,
        startAt: start,
        endAt: new Date(start.getTime() + branch.schedule.slotMinutes * 60_000),
        source: 'website',
        reason: body.reason,
        notes: [
          body.patientFor !== 'me' ? `Booked for: ${body.patientFor.replace('_', ' ')}` : '',
          body.notes,
        ]
          .filter(Boolean)
          .join('\n'),
        confirmedBy: null,
        createdBy: null,
      },
      { transaction },
    );
    return { appointment, patient };
  });
}

/**
 * Moves a booking to another free slot at its clinic. It goes back to *pending* so the front
 * desk confirms the new time. The patient's own booking doesn't count against the new slot.
 */
export async function rescheduleAppointment(
  appointment: Appointment,
  slotStart: string,
): Promise<Appointment> {
  return sequelize.transaction(async (transaction) => {
    const location = await Location.findByPk(appointment.locationId, { transaction });
    const branch = location ? await bookableBranch(location.slug, transaction) : null;
    if (!branch) {
      throw badRequest('online_booking_unavailable', 'Please call the clinic to change this time.');
    }

    const start = new Date(slotStart);
    const slots = await slotsForDay(branch, todayInGoa(start), new Date(), transaction);
    if (!slots.some((candidate) => candidate.start === start.toISOString())) {
      throw badRequest('slot_invalid', 'That time is not bookable. Please choose another.');
    }
    const end = new Date(start.getTime() + branch.schedule.slotMinutes * 60_000);
    const others = await Appointment.count({
      where: {
        id: { [Op.ne]: appointment.id },
        locationId: branch.location.id,
        status: { [Op.in]: SLOT_HOLDING },
        startAt: { [Op.lt]: end },
        endAt: { [Op.gt]: start },
      },
      transaction,
    });
    if (others >= branch.schedule.capacity) {
      throw new HttpError(
        409,
        'slot_taken',
        'Sorry, that time was just taken. Please choose another.',
      );
    }

    await appointment.update(
      { startAt: start, endAt: end, status: 'pending', confirmedAt: null, confirmedBy: null },
      { transaction },
    );
    return appointment;
  });
}

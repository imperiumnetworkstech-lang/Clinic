import { Router } from 'express';
import { requirePatient } from '../middleware/auth.js';
import { Patient } from '../models/index.js';

export const patientRouter = Router();

patientRouter.use(requirePatient);

/** The signed-in phone number and every patient profile registered under it (e.g. a family). */
patientRouter.get('/', async (req, res) => {
  const phone = req.auth?.id ?? '';
  const profiles = await Patient.findAll({
    where: { phone },
    attributes: ['id', 'code', 'name'],
    order: [['createdAt', 'ASC']],
  });
  res.json({ phone, profiles });
});

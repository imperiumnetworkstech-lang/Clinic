import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from 'sequelize';
import { sequelize } from '../db/sequelize.js';
import type { Patient } from './clinic.js';
import type { User } from './identity.js';
import type { Appointment } from './scheduling.js';

/** A dated clinical note. `body` is always stored encrypted; read it via services/clinical.ts. */
export class ClinicalNote extends Model<
  InferAttributes<ClinicalNote>,
  InferCreationAttributes<ClinicalNote>
> {
  declare id: CreationOptional<string>;
  declare patientId: ForeignKey<Patient['id']>;
  declare appointmentId: ForeignKey<Appointment['id']> | null;
  declare authorId: ForeignKey<User['id']>;
  declare body: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare author?: NonAttribute<User>;
}

ClinicalNote.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    body: { type: DataTypes.TEXT, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'clinical_notes' },
);

export const PLAN_STATUSES = [
  'proposed',
  'accepted',
  'in_progress',
  'completed',
  'declined',
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const PLAN_ITEM_STATUSES = ['planned', 'done', 'cancelled'] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

export class TreatmentPlan extends Model<
  InferAttributes<TreatmentPlan>,
  InferCreationAttributes<TreatmentPlan>
> {
  declare id: CreationOptional<string>;
  declare patientId: ForeignKey<Patient['id']>;
  declare title: string;
  declare status: CreationOptional<PlanStatus>;
  /** Encrypted; empty string when there are no notes. */
  declare notes: CreationOptional<string>;
  declare createdBy: ForeignKey<User['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare items?: NonAttribute<TreatmentPlanItem[]>;
  declare creator?: NonAttribute<User>;
}

TreatmentPlan.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    title: { type: DataTypes.STRING(120), allowNull: false },
    status: { type: DataTypes.ENUM(...PLAN_STATUSES), allowNull: false, defaultValue: 'proposed' },
    notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'treatment_plans', paranoid: true },
);

export class TreatmentPlanItem extends Model<
  InferAttributes<TreatmentPlanItem>,
  InferCreationAttributes<TreatmentPlanItem>
> {
  declare id: CreationOptional<string>;
  declare planId: ForeignKey<TreatmentPlan['id']>;
  declare treatment: string;
  declare tooth: CreationOptional<string>;
  declare sessions: CreationOptional<number>;
  declare status: CreationOptional<PlanItemStatus>;
  declare completedAt: CreationOptional<Date | null>;
  declare sortOrder: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

TreatmentPlanItem.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    treatment: { type: DataTypes.STRING(80), allowNull: false },
    tooth: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
    sessions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    status: {
      type: DataTypes.ENUM(...PLAN_ITEM_STATUSES),
      allowNull: false,
      defaultValue: 'planned',
    },
    completedAt: { type: DataTypes.DATE },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'treatment_plan_items' },
);

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
import type { Location, Patient } from './clinic.js';
import type { User } from './identity.js';
import type { Appointment } from './scheduling.js';

/** Amounts are whole paise (₹1 = 100). Totals are kept on the invoice and updated with payments. */
export class Invoice extends Model<InferAttributes<Invoice>, InferCreationAttributes<Invoice>> {
  declare id: CreationOptional<string>;
  declare number: CreationOptional<string>;
  declare patientId: ForeignKey<Patient['id']>;
  declare locationId: ForeignKey<Location['id']>;
  declare appointmentId: ForeignKey<Appointment['id']> | null;
  declare issuedOn: string;
  declare status: CreationOptional<'issued' | 'void'>;
  declare subtotalPaise: number;
  declare discountPaise: CreationOptional<number>;
  declare totalPaise: number;
  declare paidPaise: CreationOptional<number>;
  declare notes: CreationOptional<string>;
  declare voidReason: CreationOptional<string | null>;
  declare voidedAt: CreationOptional<Date | null>;
  declare voidedBy: CreationOptional<ForeignKey<User['id']> | null>;
  declare createdBy: ForeignKey<User['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare items?: NonAttribute<InvoiceItem[]>;
  declare payments?: NonAttribute<Payment[]>;
  declare patient?: NonAttribute<Patient>;
  declare location?: NonAttribute<Location>;
}

Invoice.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    number: { type: DataTypes.STRING(16) },
    issuedOn: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('issued', 'void'), allowNull: false, defaultValue: 'issued' },
    subtotalPaise: { type: DataTypes.INTEGER, allowNull: false },
    discountPaise: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalPaise: { type: DataTypes.INTEGER, allowNull: false },
    paidPaise: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notes: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
    voidReason: { type: DataTypes.STRING(200) },
    voidedAt: { type: DataTypes.DATE },
    voidedBy: { type: DataTypes.UUID },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'invoices' },
);

export class InvoiceItem extends Model<
  InferAttributes<InvoiceItem>,
  InferCreationAttributes<InvoiceItem>
> {
  declare id: CreationOptional<string>;
  declare invoiceId: ForeignKey<Invoice['id']>;
  declare description: string;
  declare tooth: CreationOptional<string>;
  declare quantity: number;
  declare unitPaise: number;
  declare amountPaise: number;
  declare sortOrder: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

InvoiceItem.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    description: { type: DataTypes.STRING(160), allowNull: false },
    tooth: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    unitPaise: { type: DataTypes.INTEGER, allowNull: false },
    amountPaise: { type: DataTypes.INTEGER, allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'invoice_items' },
);

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
  declare id: CreationOptional<string>;
  declare receiptNumber: CreationOptional<string>;
  declare invoiceId: ForeignKey<Invoice['id']>;
  declare amountPaise: number;
  declare method: PaymentMethod;
  declare reference: CreationOptional<string>;
  declare receivedAt: Date;
  declare receivedBy: ForeignKey<User['id']>;
  declare voidReason: CreationOptional<string | null>;
  declare voidedAt: CreationOptional<Date | null>;
  declare voidedBy: CreationOptional<ForeignKey<User['id']> | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare invoice?: NonAttribute<Invoice>;
  declare receiver?: NonAttribute<User>;
}

Payment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    receiptNumber: { type: DataTypes.STRING(16) },
    amountPaise: { type: DataTypes.INTEGER, allowNull: false },
    method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
    reference: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
    receivedAt: { type: DataTypes.DATE, allowNull: false },
    voidReason: { type: DataTypes.STRING(200) },
    voidedAt: { type: DataTypes.DATE },
    voidedBy: { type: DataTypes.UUID },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'payments' },
);

export const FILE_KINDS = ['xray', 'photo', 'report', 'document', 'other'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export class PatientFile extends Model<
  InferAttributes<PatientFile>,
  InferCreationAttributes<PatientFile>
> {
  declare id: CreationOptional<string>;
  declare patientId: ForeignKey<Patient['id']>;
  declare kind: FileKind;
  /** Encrypted original file name. */
  declare name: string;
  declare contentType: string;
  declare sizeBytes: number;
  declare storageKey: string;
  declare status: CreationOptional<'pending' | 'stored'>;
  declare uploadedBy: ForeignKey<User['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare uploader?: NonAttribute<User>;
}

PatientFile.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    kind: { type: DataTypes.ENUM(...FILE_KINDS), allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    contentType: { type: DataTypes.STRING(100), allowNull: false },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
    storageKey: { type: DataTypes.STRING(200), allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'stored'),
      allowNull: false,
      defaultValue: 'pending',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'patient_files', paranoid: true },
);

import { DataTypes, type QueryInterface } from 'sequelize';

const timestamps = {
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
};

const uuidPk = {
  type: DataTypes.UUID,
  primaryKey: true,
  allowNull: false,
  defaultValue: DataTypes.UUIDV4,
};

const user = { type: DataTypes.UUID, references: { model: 'users', key: 'id' } };

/**
 * Billing (invoices, line items, payments) and patient files. Money is stored as whole paise
 * in integers, never floats. No tax columns: the clinic issues plain receipts without GST.
 */
export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.sequelize.query('CREATE SEQUENCE invoice_number_seq START 1', { transaction });
    await qi.sequelize.query('CREATE SEQUENCE receipt_number_seq START 1', { transaction });

    await qi.createTable(
      'invoices',
      {
        id: uuidPk,
        number: {
          type: DataTypes.STRING(16),
          allowNull: false,
          unique: true,
          defaultValue: qi.sequelize.literal(
            "'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0')",
          ),
        },
        patient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'patients', key: 'id' },
        },
        location_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'locations', key: 'id' },
        },
        appointment_id: {
          type: DataTypes.UUID,
          references: { model: 'appointments', key: 'id' },
          onDelete: 'SET NULL',
        },
        issued_on: { type: DataTypes.DATEONLY, allowNull: false },
        status: {
          type: DataTypes.ENUM('issued', 'void'),
          allowNull: false,
          defaultValue: 'issued',
        },
        subtotal_paise: { type: DataTypes.INTEGER, allowNull: false },
        discount_paise: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        total_paise: { type: DataTypes.INTEGER, allowNull: false },
        paid_paise: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        notes: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
        void_reason: { type: DataTypes.STRING(200) },
        voided_at: { type: DataTypes.DATE },
        voided_by: user,
        created_by: { ...user, allowNull: false },
        ...timestamps,
      },
      { transaction },
    );
    await qi.addIndex('invoices', ['patient_id', 'issued_on'], { transaction });
    await qi.addIndex('invoices', ['issued_on'], { transaction });

    await qi.createTable(
      'invoice_items',
      {
        id: uuidPk,
        invoice_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'invoices', key: 'id' },
          onDelete: 'CASCADE',
        },
        description: { type: DataTypes.STRING(160), allowNull: false },
        tooth: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
        quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        unit_paise: { type: DataTypes.INTEGER, allowNull: false },
        amount_paise: { type: DataTypes.INTEGER, allowNull: false },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      { transaction },
    );
    await qi.addIndex('invoice_items', ['invoice_id', 'sort_order'], { transaction });

    await qi.createTable(
      'payments',
      {
        id: uuidPk,
        receipt_number: {
          type: DataTypes.STRING(16),
          allowNull: false,
          unique: true,
          defaultValue: qi.sequelize.literal(
            "'RCT-' || lpad(nextval('receipt_number_seq')::text, 6, '0')",
          ),
        },
        invoice_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'invoices', key: 'id' },
        },
        amount_paise: { type: DataTypes.INTEGER, allowNull: false },
        method: {
          type: DataTypes.ENUM('cash', 'upi', 'card', 'bank_transfer', 'other'),
          allowNull: false,
        },
        /** UPI / card / bank transaction reference, if any. */
        reference: { type: DataTypes.STRING(80), allowNull: false, defaultValue: '' },
        received_at: { type: DataTypes.DATE, allowNull: false },
        received_by: { ...user, allowNull: false },
        void_reason: { type: DataTypes.STRING(200) },
        voided_at: { type: DataTypes.DATE },
        voided_by: user,
        ...timestamps,
      },
      { transaction },
    );
    await qi.addIndex('payments', ['invoice_id'], { transaction });
    await qi.addIndex('payments', ['received_at'], { transaction });

    await qi.createTable(
      'patient_files',
      {
        id: uuidPk,
        patient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'patients', key: 'id' },
          onDelete: 'CASCADE',
        },
        kind: {
          type: DataTypes.ENUM('xray', 'photo', 'report', 'document', 'other'),
          allowNull: false,
        },
        /** Original file name, encrypted (it can identify the patient). */
        name: { type: DataTypes.TEXT, allowNull: false },
        content_type: { type: DataTypes.STRING(100), allowNull: false },
        size_bytes: { type: DataTypes.INTEGER, allowNull: false },
        /** Opaque object key in the storage provider; never contains patient data. */
        storage_key: { type: DataTypes.STRING(200), allowNull: false, unique: true },
        status: {
          type: DataTypes.ENUM('pending', 'stored'),
          allowNull: false,
          defaultValue: 'pending',
        },
        uploaded_by: { ...user, allowNull: false },
        ...timestamps,
        deleted_at: { type: DataTypes.DATE },
      },
      { transaction },
    );
    await qi.addIndex('patient_files', ['patient_id', 'created_at'], { transaction });
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    for (const table of ['patient_files', 'payments', 'invoice_items', 'invoices']) {
      await qi.dropTable(table, { transaction });
    }
    for (const type of [
      'enum_patient_files_kind',
      'enum_patient_files_status',
      'enum_payments_method',
      'enum_invoices_status',
    ]) {
      await qi.sequelize.query(`DROP TYPE IF EXISTS "${type}"`, { transaction });
    }
    for (const sequence of ['receipt_number_seq', 'invoice_number_seq']) {
      await qi.sequelize.query(`DROP SEQUENCE IF EXISTS ${sequence}`, { transaction });
    }
  });
}

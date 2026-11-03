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

/**
 * Patient records for the CRM: medical history and recall on the patient, clinical notes,
 * treatment plans with items, and the dentist on an appointment. Every free-text clinical
 * field is stored AES-256-GCM encrypted (lib/crypto.ts), so these columns are plain TEXT.
 */
export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.addColumn(
      'patients',
      'medical_history',
      { type: DataTypes.TEXT, allowNull: true },
      { transaction },
    );
    await qi.addColumn(
      'patients',
      'next_recall_on',
      { type: DataTypes.DATEONLY, allowNull: true },
      { transaction },
    );
    await qi.addColumn(
      'patients',
      'recall_note',
      { type: DataTypes.STRING(120), allowNull: false, defaultValue: '' },
      { transaction },
    );
    await qi.addIndex('patients', ['next_recall_on'], { transaction });

    await qi.addColumn(
      'appointments',
      'dentist_id',
      { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
      { transaction },
    );
    await qi.addIndex('appointments', ['start_at'], { transaction });

    await qi.createTable(
      'clinical_notes',
      {
        id: uuidPk,
        patient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'patients', key: 'id' },
          onDelete: 'CASCADE',
        },
        appointment_id: {
          type: DataTypes.UUID,
          references: { model: 'appointments', key: 'id' },
          onDelete: 'SET NULL',
        },
        author_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        body: { type: DataTypes.TEXT, allowNull: false },
        ...timestamps,
      },
      { transaction },
    );
    await qi.addIndex('clinical_notes', ['patient_id', 'created_at'], { transaction });

    await qi.createTable(
      'treatment_plans',
      {
        id: uuidPk,
        patient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'patients', key: 'id' },
          onDelete: 'CASCADE',
        },
        title: { type: DataTypes.STRING(120), allowNull: false },
        status: {
          type: DataTypes.ENUM('proposed', 'accepted', 'in_progress', 'completed', 'declined'),
          allowNull: false,
          defaultValue: 'proposed',
        },
        notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
        created_by: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
        },
        ...timestamps,
        deleted_at: { type: DataTypes.DATE },
      },
      { transaction },
    );
    await qi.addIndex('treatment_plans', ['patient_id'], { transaction });

    await qi.createTable(
      'treatment_plan_items',
      {
        id: uuidPk,
        plan_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'treatment_plans', key: 'id' },
          onDelete: 'CASCADE',
        },
        /** Treatment slug from the catalogue, or free text for anything else. */
        treatment: { type: DataTypes.STRING(80), allowNull: false },
        /** FDI tooth numbers, e.g. "36" or "11, 21"; empty for whole-mouth work. */
        tooth: { type: DataTypes.STRING(40), allowNull: false, defaultValue: '' },
        sessions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        status: {
          type: DataTypes.ENUM('planned', 'done', 'cancelled'),
          allowNull: false,
          defaultValue: 'planned',
        },
        completed_at: { type: DataTypes.DATE },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      { transaction },
    );
    await qi.addIndex('treatment_plan_items', ['plan_id', 'sort_order'], { transaction });
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    for (const table of ['treatment_plan_items', 'treatment_plans', 'clinical_notes']) {
      await qi.dropTable(table, { transaction });
    }
    for (const type of ['enum_treatment_plans_status', 'enum_treatment_plan_items_status']) {
      await qi.sequelize.query(`DROP TYPE IF EXISTS "${type}"`, { transaction });
    }
    await qi.removeIndex('appointments', ['start_at'], { transaction });
    await qi.removeColumn('appointments', 'dentist_id', { transaction });
    await qi.removeIndex('patients', ['next_recall_on'], { transaction });
    for (const column of ['recall_note', 'next_recall_on', 'medical_history']) {
      await qi.removeColumn('patients', column, { transaction });
    }
  });
}

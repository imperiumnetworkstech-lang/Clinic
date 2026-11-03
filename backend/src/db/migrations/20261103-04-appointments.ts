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

/** Bookable schedules per branch, closures, appointments, and patient email sign-in links. */
export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.createTable(
      'location_schedules',
      {
        id: uuidPk,
        location_id: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          references: { model: 'locations', key: 'id' },
          onDelete: 'CASCADE',
        },
        /** Online booking on/off for this branch; off falls back to appointment requests. */
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        slot_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
        /** How many patients can be booked into the same slot (e.g. number of chairs). */
        capacity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        /** { monday: [{ open: '10:00', close: '13:00' }, ...], ... } in the branch timezone. */
        weekly: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        min_notice_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 120 },
        max_days_ahead: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
        updated_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
        ...timestamps,
      },
      { transaction },
    );

    await qi.createTable(
      'holidays',
      {
        id: uuidPk,
        location_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'locations', key: 'id' },
          onDelete: 'CASCADE',
        },
        date: { type: DataTypes.DATEONLY, allowNull: false },
        reason: { type: DataTypes.STRING(120), allowNull: false, defaultValue: '' },
        ...timestamps,
      },
      { transaction },
    );
    await qi.addIndex('holidays', ['location_id', 'date'], { unique: true, transaction });

    await qi.sequelize.query('CREATE SEQUENCE appointment_reference_seq START 1', { transaction });
    await qi.createTable(
      'appointments',
      {
        id: uuidPk,
        reference: {
          type: DataTypes.STRING(16),
          allowNull: false,
          unique: true,
          defaultValue: qi.sequelize.literal(
            "'APT-' || lpad(nextval('appointment_reference_seq')::text, 5, '0')",
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
        start_at: { type: DataTypes.DATE, allowNull: false },
        end_at: { type: DataTypes.DATE, allowNull: false },
        status: {
          type: DataTypes.ENUM(
            'pending',
            'confirmed',
            'checked_in',
            'completed',
            'no_show',
            'cancelled',
          ),
          allowNull: false,
          defaultValue: 'pending',
        },
        source: {
          type: DataTypes.ENUM('website', 'admin', 'phone', 'walk_in', 'whatsapp'),
          allowNull: false,
        },
        reason: { type: DataTypes.STRING(60), allowNull: false },
        notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
        confirmed_at: { type: DataTypes.DATE },
        confirmed_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
        cancelled_at: { type: DataTypes.DATE },
        cancelled_by: { type: DataTypes.ENUM('patient', 'clinic') },
        created_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
        ...timestamps,
        deleted_at: { type: DataTypes.DATE },
      },
      { transaction },
    );
    await qi.addIndex('appointments', ['location_id', 'start_at'], { transaction });
    await qi.addIndex('appointments', ['patient_id', 'start_at'], { transaction });

    await qi.createTable(
      'patient_login_links',
      {
        id: uuidPk,
        email: { type: DataTypes.STRING(254), allowNull: false },
        token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        used_at: { type: DataTypes.DATE },
        ip: { type: DataTypes.STRING(64) },
        created_at: timestamps.created_at,
      },
      { transaction },
    );
    await qi.addIndex('patient_login_links', ['email', 'created_at'], { transaction });
    await qi.addIndex('patients', ['email'], { transaction });

    // Patient sessions can now be keyed by email ("email:<address>"), longer than 64 chars.
    await qi.changeColumn(
      'refresh_tokens',
      'subject_id',
      { type: DataTypes.STRING(320), allowNull: false },
      { transaction },
    );
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  // refresh_tokens.subject_id stays 320 wide: narrowing could truncate live sessions.
  await qi.sequelize.transaction(async (transaction) => {
    await qi.removeIndex('patients', ['email'], { transaction });
    for (const table of ['patient_login_links', 'appointments', 'holidays', 'location_schedules']) {
      await qi.dropTable(table, { transaction });
    }
    await qi.sequelize.query('DROP SEQUENCE IF EXISTS appointment_reference_seq', { transaction });
    for (const type of [
      'enum_appointments_status',
      'enum_appointments_source',
      'enum_appointments_cancelled_by',
    ]) {
      await qi.sequelize.query(`DROP TYPE IF EXISTS "${type}"`, { transaction });
    }
  });
}

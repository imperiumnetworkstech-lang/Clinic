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

/** Clinic branches, patients, consent records and patient OTP challenges. */
export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.createTable(
      'locations',
      {
        id: uuidPk,
        slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(120), allowNull: false },
        address_line: { type: DataTypes.TEXT, allowNull: false },
        locality: { type: DataTypes.STRING(80), allowNull: false },
        region: { type: DataTypes.STRING(80), allowNull: false },
        postal_code: { type: DataTypes.STRING(12) },
        country: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'IN' },
        latitude: { type: DataTypes.DECIMAL(9, 6) },
        longitude: { type: DataTypes.DECIMAL(9, 6) },
        google_place_id: { type: DataTypes.STRING(80) },
        phone: { type: DataTypes.STRING(20), allowNull: false },
        whatsapp: { type: DataTypes.STRING(20) },
        opening_hours: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        timezone: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'Asia/Kolkata' },
        active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        ...timestamps,
      },
      { transaction },
    );

    await qi.sequelize.query('CREATE SEQUENCE patient_code_seq START 1', { transaction });
    await qi.createTable(
      'patients',
      {
        id: uuidPk,
        code: {
          type: DataTypes.STRING(16),
          allowNull: false,
          unique: true,
          defaultValue: qi.sequelize.literal(
            "'EDC-' || lpad(nextval('patient_code_seq')::text, 6, '0')",
          ),
        },
        name: { type: DataTypes.STRING(120), allowNull: false },
        phone: { type: DataTypes.STRING(20), allowNull: false },
        email: { type: DataTypes.STRING(254) },
        date_of_birth: { type: DataTypes.DATEONLY },
        gender: { type: DataTypes.ENUM('female', 'male', 'other', 'undisclosed') },
        preferred_language: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'en' },
        source: {
          type: DataTypes.ENUM(
            'website',
            'google',
            'instagram',
            'facebook',
            'referral',
            'walk_in',
            'whatsapp',
            'phone',
            'other',
          ),
        },
        tags: { type: DataTypes.ARRAY(DataTypes.STRING(40)), allowNull: false, defaultValue: [] },
        home_location_id: { type: DataTypes.UUID, references: { model: 'locations', key: 'id' } },
        is_demo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        ...timestamps,
        deleted_at: { type: DataTypes.DATE },
      },
      { transaction },
    );
    await qi.addIndex('patients', ['phone'], { transaction });
    await qi.addIndex('patients', ['name'], { transaction });

    await qi.createTable(
      'patient_consents',
      {
        id: uuidPk,
        patient_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'patients', key: 'id' },
          onDelete: 'CASCADE',
        },
        type: {
          type: DataTypes.ENUM(
            'data_processing',
            'whatsapp_transactional',
            'whatsapp_marketing',
            'sms',
            'email',
            'photo_use',
          ),
          allowNull: false,
        },
        granted: { type: DataTypes.BOOLEAN, allowNull: false },
        channel: { type: DataTypes.ENUM('web', 'admin', 'paper', 'whatsapp'), allowNull: false },
        /** Version of the consent wording shown, so we can prove what was agreed. */
        text_version: { type: DataTypes.STRING(40), allowNull: false },
        ip: { type: DataTypes.STRING(64) },
        recorded_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
        created_at: timestamps.created_at,
      },
      { transaction },
    );
    await qi.addIndex('patient_consents', ['patient_id', 'type', 'created_at'], { transaction });

    await qi.createTable(
      'otp_challenges',
      {
        id: uuidPk,
        phone: { type: DataTypes.STRING(20), allowNull: false },
        purpose: { type: DataTypes.ENUM('portal_login'), allowNull: false },
        code_hash: { type: DataTypes.STRING(64), allowNull: false },
        attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        consumed_at: { type: DataTypes.DATE },
        ip: { type: DataTypes.STRING(64) },
        created_at: timestamps.created_at,
      },
      { transaction },
    );
    await qi.addIndex('otp_challenges', ['phone', 'purpose', 'created_at'], { transaction });
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    for (const table of ['otp_challenges', 'patient_consents', 'patients', 'locations']) {
      await qi.dropTable(table, { transaction });
    }
    await qi.sequelize.query('DROP SEQUENCE IF EXISTS patient_code_seq', { transaction });
    for (const type of [
      'enum_patients_gender',
      'enum_patients_source',
      'enum_patient_consents_type',
      'enum_patient_consents_channel',
      'enum_otp_challenges_purpose',
    ]) {
      await qi.sequelize.query(`DROP TYPE IF EXISTS "${type}"`, { transaction });
    }
  });
}

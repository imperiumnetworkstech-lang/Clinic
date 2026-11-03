import { DataTypes, type QueryInterface } from 'sequelize';

/** Enquiries inbox: website appointment requests now; contact forms and symptom helper later. */
export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.sequelize.query('CREATE SEQUENCE lead_reference_seq START 1', { transaction });
    await qi.createTable(
      'leads',
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
        },
        reference: {
          type: DataTypes.STRING(16),
          allowNull: false,
          unique: true,
          defaultValue: qi.sequelize.literal(
            "'REQ-' || lpad(nextval('lead_reference_seq')::text, 5, '0')",
          ),
        },
        source: {
          type: DataTypes.ENUM(
            'website_booking',
            'website_contact',
            'symptom_helper',
            'phone',
            'walk_in',
          ),
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM('new', 'contacted', 'booked', 'lost'),
          allowNull: false,
          defaultValue: 'new',
        },
        name: { type: DataTypes.STRING(120), allowNull: false },
        phone: { type: DataTypes.STRING(20), allowNull: false },
        location_id: { type: DataTypes.UUID, references: { model: 'locations', key: 'id' } },
        /** Request details (reason, preferred date, time of day, who it's for, notes). */
        details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        consent_text_version: { type: DataTypes.STRING(40), allowNull: false },
        consented_at: { type: DataTypes.DATE, allowNull: false },
        assigned_to: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
        patient_id: { type: DataTypes.UUID, references: { model: 'patients', key: 'id' } },
        ip: { type: DataTypes.STRING(64) },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        deleted_at: { type: DataTypes.DATE },
      },
      { transaction },
    );
    await qi.addIndex('leads', ['status', 'created_at'], { transaction });
    await qi.addIndex('leads', ['phone'], { transaction });
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.dropTable('leads', { transaction });
    await qi.sequelize.query('DROP SEQUENCE IF EXISTS lead_reference_seq', { transaction });
    for (const type of ['enum_leads_source', 'enum_leads_status']) {
      await qi.sequelize.query(`DROP TYPE IF EXISTS "${type}"`, { transaction });
    }
  });
}

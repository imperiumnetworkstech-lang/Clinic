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

/** Staff identity, RBAC, sessions, audit trail, rate limiting and settings. */
export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.createTable(
      'roles',
      {
        id: uuidPk,
        key: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(80), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
        requires_two_factor: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        ...timestamps,
      },
      { transaction },
    );

    await qi.createTable(
      'permissions',
      {
        key: { type: DataTypes.STRING(60), primaryKey: true },
        description: { type: DataTypes.TEXT, allowNull: false },
        ...timestamps,
      },
      { transaction },
    );

    await qi.createTable(
      'role_permissions',
      {
        role_id: {
          type: DataTypes.UUID,
          primaryKey: true,
          references: { model: 'roles', key: 'id' },
          onDelete: 'CASCADE',
        },
        permission_key: {
          type: DataTypes.STRING(60),
          primaryKey: true,
          references: { model: 'permissions', key: 'key' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        created_at: timestamps.created_at,
      },
      { transaction },
    );

    await qi.createTable(
      'users',
      {
        id: uuidPk,
        name: { type: DataTypes.STRING(120), allowNull: false },
        email: { type: DataTypes.STRING(254), allowNull: false },
        phone: { type: DataTypes.STRING(20) },
        password_hash: { type: DataTypes.TEXT, allowNull: false },
        role_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'roles', key: 'id' },
          onDelete: 'RESTRICT',
        },
        status: {
          type: DataTypes.ENUM('active', 'invited', 'disabled'),
          allowNull: false,
          defaultValue: 'active',
        },
        totp_secret_enc: { type: DataTypes.TEXT },
        totp_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        totp_last_step: { type: DataTypes.BIGINT },
        last_login_at: { type: DataTypes.DATE },
        password_changed_at: { type: DataTypes.DATE },
        ...timestamps,
        deleted_at: { type: DataTypes.DATE },
      },
      { transaction },
    );
    await qi.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique_live',
      where: { deleted_at: null },
      transaction,
    });

    await qi.createTable(
      'refresh_tokens',
      {
        id: uuidPk,
        subject_type: { type: DataTypes.ENUM('staff', 'patient'), allowNull: false },
        /** User id for staff; E.164 phone for patients (one login covers a family's profiles). */
        subject_id: { type: DataTypes.STRING(64), allowNull: false },
        token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        family_id: { type: DataTypes.UUID, allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        revoked_at: { type: DataTypes.DATE },
        revoked_reason: { type: DataTypes.STRING(40) },
        replaced_by_id: { type: DataTypes.UUID },
        ip: { type: DataTypes.STRING(64) },
        user_agent: { type: DataTypes.STRING(400) },
        created_at: timestamps.created_at,
      },
      { transaction },
    );
    await qi.addIndex('refresh_tokens', ['family_id'], { transaction });
    await qi.addIndex('refresh_tokens', ['subject_type', 'subject_id'], { transaction });

    await qi.createTable(
      'audit_logs',
      {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        actor_type: {
          type: DataTypes.ENUM('staff', 'patient', 'system', 'anonymous'),
          allowNull: false,
        },
        actor_id: { type: DataTypes.STRING(64) },
        action: { type: DataTypes.STRING(80), allowNull: false },
        entity: { type: DataTypes.STRING(60) },
        entity_id: { type: DataTypes.STRING(64) },
        meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        ip: { type: DataTypes.STRING(64) },
        user_agent: { type: DataTypes.STRING(400) },
        created_at: timestamps.created_at,
      },
      { transaction },
    );
    await qi.addIndex('audit_logs', ['created_at'], { transaction });
    await qi.addIndex('audit_logs', ['entity', 'entity_id'], { transaction });
    await qi.addIndex('audit_logs', ['actor_type', 'actor_id'], { transaction });

    await qi.createTable(
      'rate_limits',
      {
        key: { type: DataTypes.STRING(200), primaryKey: true },
        points: { type: DataTypes.INTEGER, allowNull: false },
        expires_at: { type: DataTypes.DATE, allowNull: false },
      },
      { transaction },
    );
    await qi.addIndex('rate_limits', ['expires_at'], { transaction });

    await qi.createTable(
      'settings',
      {
        key: { type: DataTypes.STRING(80), primaryKey: true },
        value: { type: DataTypes.JSONB, allowNull: false },
        updated_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
        ...timestamps,
      },
      { transaction },
    );
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    for (const table of [
      'settings',
      'rate_limits',
      'audit_logs',
      'refresh_tokens',
      'users',
      'role_permissions',
      'permissions',
      'roles',
    ]) {
      await qi.dropTable(table, { transaction });
    }
    for (const type of [
      'enum_users_status',
      'enum_refresh_tokens_subject_type',
      'enum_audit_logs_actor_type',
    ]) {
      await qi.sequelize.query(`DROP TYPE IF EXISTS "${type}"`, { transaction });
    }
  });
}

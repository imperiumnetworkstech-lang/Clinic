import { DataTypes, type QueryInterface } from 'sequelize';

const uuidPk = {
  type: DataTypes.UUID,
  primaryKey: true,
  allowNull: false,
  defaultValue: DataTypes.UUIDV4,
};

const user = { type: DataTypes.UUID, references: { model: 'users', key: 'id' } };

/**
 * Website content (blog articles, FAQs, treatment page copy). Each entry holds the live
 * version and at most one draft; a draft goes editing → in review → approved (or changes
 * requested) → published. Every step is kept in cms_revisions.
 */
export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.createTable(
      'cms_entries',
      {
        id: uuidPk,
        type: { type: DataTypes.ENUM('blog_post', 'faq', 'treatment'), allowNull: false },
        slug: { type: DataTypes.STRING(120), allowNull: false },
        sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        published_data: { type: DataTypes.JSONB },
        published_at: { type: DataTypes.DATE },
        published_by: user,
        /** False until a dentist has approved the live version (imported copy starts false). */
        published_reviewed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        draft_data: { type: DataTypes.JSONB },
        draft_status: {
          type: DataTypes.ENUM('editing', 'in_review', 'changes_requested', 'approved'),
        },
        draft_updated_at: { type: DataTypes.DATE },
        draft_updated_by: user,
        review_note: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
        reviewed_by: user,
        reviewed_at: { type: DataTypes.DATE },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      { transaction },
    );
    await qi.addIndex('cms_entries', ['type', 'slug'], { unique: true, transaction });

    await qi.createTable(
      'cms_revisions',
      {
        id: uuidPk,
        entry_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'cms_entries', key: 'id' },
          onDelete: 'CASCADE',
        },
        action: {
          type: DataTypes.ENUM(
            'imported',
            'created',
            'saved',
            'submitted',
            'approved',
            'changes_requested',
            'published',
            'unpublished',
            'restored',
            'discarded',
            'live_approved',
          ),
          allowNull: false,
        },
        data: { type: DataTypes.JSONB },
        note: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
        actor_id: user,
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      { transaction },
    );
    await qi.addIndex('cms_revisions', ['entry_id', 'created_at'], { transaction });
  });
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.transaction(async (transaction) => {
    await qi.dropTable('cms_revisions', { transaction });
    await qi.dropTable('cms_entries', { transaction });
    for (const type of [
      'enum_cms_revisions_action',
      'enum_cms_entries_draft_status',
      'enum_cms_entries_type',
    ]) {
      await qi.sequelize.query(`DROP TYPE IF EXISTS "${type}"`, { transaction });
    }
  });
}

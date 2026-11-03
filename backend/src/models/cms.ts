import type { ContentType, DraftStatus } from '@edc/shared';
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
import type { User } from './identity.js';

export class CmsEntry extends Model<InferAttributes<CmsEntry>, InferCreationAttributes<CmsEntry>> {
  declare id: CreationOptional<string>;
  declare type: ContentType;
  declare slug: string;
  declare sortOrder: CreationOptional<number>;
  declare publishedData: CreationOptional<Record<string, unknown> | null>;
  declare publishedAt: CreationOptional<Date | null>;
  declare publishedBy: CreationOptional<ForeignKey<User['id']> | null>;
  declare publishedReviewed: CreationOptional<boolean>;
  declare archived: CreationOptional<boolean>;
  declare draftData: CreationOptional<Record<string, unknown> | null>;
  declare draftStatus: CreationOptional<DraftStatus | null>;
  declare draftUpdatedAt: CreationOptional<Date | null>;
  declare draftUpdatedBy: CreationOptional<ForeignKey<User['id']> | null>;
  declare reviewNote: CreationOptional<string>;
  declare reviewedBy: CreationOptional<ForeignKey<User['id']> | null>;
  declare reviewedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare revisions?: NonAttribute<CmsRevision[]>;
}

CmsEntry.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    type: { type: DataTypes.ENUM('blog_post', 'faq', 'treatment'), allowNull: false },
    slug: { type: DataTypes.STRING(120), allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    publishedData: { type: DataTypes.JSONB },
    publishedAt: { type: DataTypes.DATE },
    publishedBy: { type: DataTypes.UUID },
    publishedReviewed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    draftData: { type: DataTypes.JSONB },
    draftStatus: { type: DataTypes.ENUM('editing', 'in_review', 'changes_requested', 'approved') },
    draftUpdatedAt: { type: DataTypes.DATE },
    draftUpdatedBy: { type: DataTypes.UUID },
    reviewNote: { type: DataTypes.STRING(500), allowNull: false, defaultValue: '' },
    reviewedBy: { type: DataTypes.UUID },
    reviewedAt: { type: DataTypes.DATE },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'cms_entries' },
);

export type CmsAction =
  | 'imported'
  | 'created'
  | 'saved'
  | 'submitted'
  | 'approved'
  | 'changes_requested'
  | 'published'
  | 'unpublished'
  | 'restored'
  | 'discarded'
  | 'live_approved';

export class CmsRevision extends Model<
  InferAttributes<CmsRevision>,
  InferCreationAttributes<CmsRevision>
> {
  declare id: CreationOptional<string>;
  declare entryId: ForeignKey<CmsEntry['id']>;
  declare action: CmsAction;
  declare data: CreationOptional<Record<string, unknown> | null>;
  declare note: CreationOptional<string>;
  declare actorId: ForeignKey<User['id']> | null;
  declare createdAt: CreationOptional<Date>;

  declare actor?: NonAttribute<User>;
}

CmsRevision.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
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
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'cms_revisions', updatedAt: false },
);

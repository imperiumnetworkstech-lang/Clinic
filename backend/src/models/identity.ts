import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from 'sequelize';
import type { RoleKey } from '@edc/shared';
import { sequelize } from '../db/sequelize.js';

export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<string>;
  declare key: RoleKey;
  declare name: string;
  declare description: CreationOptional<string>;
  declare requiresTwoFactor: CreationOptional<boolean>;
  declare isSystem: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Role.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    key: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    requiresTwoFactor: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isSystem: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'roles' },
);

export class Permission extends Model<
  InferAttributes<Permission>,
  InferCreationAttributes<Permission>
> {
  declare key: string;
  declare description: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Permission.init(
  {
    key: { type: DataTypes.STRING(60), primaryKey: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'permissions' },
);

export class RolePermission extends Model<
  InferAttributes<RolePermission>,
  InferCreationAttributes<RolePermission>
> {
  declare roleId: ForeignKey<Role['id']>;
  declare permissionKey: ForeignKey<Permission['key']>;
  declare createdAt: CreationOptional<Date>;
}

RolePermission.init(
  {
    roleId: { type: DataTypes.UUID, primaryKey: true },
    permissionKey: { type: DataTypes.STRING(60), primaryKey: true },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'role_permissions', updatedAt: false },
);

export type UserStatus = 'active' | 'invited' | 'disabled';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare email: string;
  declare phone: string | null;
  declare passwordHash: string;
  declare roleId: ForeignKey<Role['id']>;
  declare status: CreationOptional<UserStatus>;
  declare totpSecretEnc: CreationOptional<string | null>;
  declare totpEnabled: CreationOptional<boolean>;
  declare totpLastStep: CreationOptional<string | null>;
  declare lastLoginAt: CreationOptional<Date | null>;
  declare passwordChangedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare role?: NonAttribute<Role>;
}

User.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
    phone: { type: DataTypes.STRING(20) },
    passwordHash: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'invited', 'disabled'),
      allowNull: false,
      defaultValue: 'active',
    },
    totpSecretEnc: { type: DataTypes.TEXT },
    totpEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // BIGINT is returned as a string by pg; it only ever holds a TOTP time-step counter.
    totpLastStep: { type: DataTypes.BIGINT },
    lastLoginAt: { type: DataTypes.DATE },
    passwordChangedAt: { type: DataTypes.DATE },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'users', paranoid: true },
);

export type SubjectType = 'staff' | 'patient';

export class RefreshToken extends Model<
  InferAttributes<RefreshToken>,
  InferCreationAttributes<RefreshToken>
> {
  declare id: CreationOptional<string>;
  declare subjectType: SubjectType;
  declare subjectId: string;
  declare tokenHash: string;
  declare familyId: string;
  declare expiresAt: Date;
  declare revokedAt: CreationOptional<Date | null>;
  declare revokedReason: CreationOptional<string | null>;
  declare replacedById: CreationOptional<string | null>;
  declare ip: string | null;
  declare userAgent: string | null;
  declare createdAt: CreationOptional<Date>;
}

RefreshToken.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    subjectType: { type: DataTypes.ENUM('staff', 'patient'), allowNull: false },
    subjectId: { type: DataTypes.STRING(64), allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    familyId: { type: DataTypes.UUID, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE },
    revokedReason: { type: DataTypes.STRING(40) },
    replacedById: { type: DataTypes.UUID },
    ip: { type: DataTypes.STRING(64) },
    userAgent: { type: DataTypes.STRING(400) },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'refresh_tokens', updatedAt: false },
);

export type ActorType = 'staff' | 'patient' | 'system' | 'anonymous';

export class AuditLog extends Model<InferAttributes<AuditLog>, InferCreationAttributes<AuditLog>> {
  declare id: CreationOptional<string>;
  declare actorType: ActorType;
  declare actorId: string | null;
  declare action: string;
  declare entity: string | null;
  declare entityId: string | null;
  declare meta: CreationOptional<Record<string, unknown>>;
  declare ip: string | null;
  declare userAgent: string | null;
  declare createdAt: CreationOptional<Date>;
}

AuditLog.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    actorType: {
      type: DataTypes.ENUM('staff', 'patient', 'system', 'anonymous'),
      allowNull: false,
    },
    actorId: { type: DataTypes.STRING(64) },
    action: { type: DataTypes.STRING(80), allowNull: false },
    entity: { type: DataTypes.STRING(60) },
    entityId: { type: DataTypes.STRING(64) },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ip: { type: DataTypes.STRING(64) },
    userAgent: { type: DataTypes.STRING(400) },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'audit_logs', updatedAt: false },
);

export class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare key: string;
  declare value: unknown;
  declare updatedBy: ForeignKey<User['id']> | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Setting.init(
  {
    key: { type: DataTypes.STRING(80), primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false },
    updatedBy: { type: DataTypes.UUID },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'settings' },
);

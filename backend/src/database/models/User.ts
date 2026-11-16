import { Schema, model, InferSchemaType } from "mongoose";
import { ROLES } from "../../security/roles";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    isActive: { type: Boolean, default: true },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    // hashed refresh tokens (rotation): one entry per active session
    refreshTokens: { type: [{ jti: String, hash: String, expiresAt: Date }], select: false, default: [] },
    totpSecret: { type: String, select: false },
    totpEnabled: { type: Boolean, default: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);
export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);

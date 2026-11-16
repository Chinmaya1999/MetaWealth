import { Schema, model } from "mongoose";

// Append-only: no update/delete routes exist; retention 8 years per BRD NFR-04.
const auditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: String },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    reason: String,
    requestId: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
export const AuditLog = model("AuditLog", auditSchema);

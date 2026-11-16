import { Schema, model } from "mongoose";

export const Client = model("Client", new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  advisorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true }, email: { type: String, required: true },
  residency: { type: String, default: "Resident Indian" },
  status: { type: String, enum: ["invited", "data_gathering", "ready_for_review", "draft", "released", "renewal_due"], default: "invited", index: true },
  data: { type: Schema.Types.Mixed, default: {} },
  stepsDone: { type: [Number], default: [] },
  consent: { acceptedAt: Date, signedName: String, ip: String },
  deletedAt: Date,
}, { timestamps: true }));

export const DocumentRec = model("Document", new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
  category: { type: String, required: true }, filename: String, storageKey: { type: String, required: true }, mime: String, size: Number,
  status: { type: String, enum: ["uploaded", "processed", "needs_manual", "confirmed", "rejected"], default: "uploaded" },
  ocrProvider: String,
  extracted: [{ field: String, value: String, confidence: Number, page: Number, verified: { type: Boolean, default: false } }],
  verifiedBy: Schema.Types.ObjectId, verifiedAt: Date, uploadedBy: Schema.Types.ObjectId,
}, { timestamps: true }));

export const AssumptionSet = model("AssumptionSet", new Schema({
  version: { type: Number, required: true, unique: true }, active: { type: Boolean, default: true, index: true },
  values: Schema.Types.Mixed, createdBy: Schema.Types.ObjectId, reason: String,
}, { timestamps: true }));

export const CalculationResult = model("CalculationResult", new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  assumptionVersion: Number, engineVersion: String, input: Schema.Types.Mixed, result: Schema.Types.Mixed, createdBy: Schema.Types.ObjectId,
}, { timestamps: { createdAt: true, updatedAt: false } }).index({ clientId: 1, createdAt: -1 }));

const planSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
  version: { type: Number, required: true },
  status: { type: String, enum: ["draft", "in_review", "approved", "released", "rejected"], default: "draft", index: true },
  input: Schema.Types.Mixed, assumptionVersion: Number, engineVersion: String, result: Schema.Types.Mixed,
  approvals: [{ by: Schema.Types.ObjectId, role: String, decision: String, note: String, at: Date }],
  createdBy: Schema.Types.ObjectId, releasedAt: Date,
}, { timestamps: true });
planSchema.index({ clientId: 1, version: -1 }, { unique: true });
// Released plans are immutable (BRD OUT-03).
planSchema.pre("save", async function (next) { if (!this.isNew) { const cur = await PlanVersion.findById(this._id).select("status"); if (cur?.status === "released") return next(new Error("Released plans are immutable")); } next(); });
planSchema.pre(["updateOne", "findOneAndUpdate", "updateMany"], async function (next) { const f: any = this.getFilter(); if (f._id) { const cur = await PlanVersion.findById(f._id).select("status"); if (cur?.status === "released") return next(new Error("Released plans are immutable")); } next(); });
export const PlanVersion = model("PlanVersion", planSchema);

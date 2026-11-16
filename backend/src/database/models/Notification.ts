import { Schema, model } from "mongoose";
export const Notification = model("Notification", new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, required: true }, title: { type: String, required: true }, body: String, link: String,
  readAt: Date, dedupeKey: { type: String, index: true },
}, { timestamps: true }));

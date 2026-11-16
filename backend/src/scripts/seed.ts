// Development-only demo accounts (fictitious). Refuses to run in production.
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb } from "../database/connect";
import { User } from "../database/models/User";
import { env } from "../config/env";
import { Client } from "../database/models";
import { REFERENCE_CLIENT } from "../financial-engine/reference";

if (env.NODE_ENV === "production") throw new Error("Seeding is disabled in production");
if (!env.SEED_DEMO_PASSWORD) throw new Error("Set SEED_DEMO_PASSWORD in .env");
await connectDb();
const hash = await bcrypt.hash(env.SEED_DEMO_PASSWORD, 12);
const demo = [
  ["admin@demo.metawealth.test", "Demo Administrator", "admin"],
  ["reviewer@demo.metawealth.test", "Demo Reviewer", "reviewer"],
  ["advisor1@demo.metawealth.test", "Demo Advisor One", "advisor"],
  ["advisor2@demo.metawealth.test", "Demo Advisor Two", "advisor"],
  ["client1@demo.metawealth.test", "Demo Client (Resident)", "client"],
  ["client2@demo.metawealth.test", "Demo Client (NRI)", "client"],
] as const;
for (const [email, name, role] of demo) await User.updateOne({ email }, { $setOnInsert: { email, name, role, passwordHash: hash } }, { upsert: true });
const u = async (e: string) => (await User.findOne({ email: e }))!;
const adv = await u("advisor1@demo.metawealth.test");
const mk = async (email: string, name: string, residency: string, data: any, done: number[], status: string) => {
  const user = await u(email);
  await Client.updateOne({ userId: user._id }, { $setOnInsert: { userId: user._id, advisorId: adv._id, name, email, residency, data, stepsDone: done, status } }, { upsert: true });
};
await mk("client1@demo.metawealth.test", "Demo Client (Resident)", "Resident Indian", REFERENCE_CLIENT, [1, 2, 3, 4, 5, 6, 7, 8, 9], "ready_for_review");
await mk("client2@demo.metawealth.test", "Demo Client (NRI)", "NRI - USA", { profile: { name: "Demo Client (NRI)", residency: "NRI - USA", dob: "1985-04-12", retirementAge: 60 } }, [], "invited");
console.log(`Seeded ${demo.length} demo users`);
await mongoose.disconnect();

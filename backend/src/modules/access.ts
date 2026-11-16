import { Client } from "../database/models";
import { HttpError } from "../utils/errors";

/** Client sees only own record; advisor only assigned clients; reviewer/admin all. */
export async function loadClientFor(auth: { userId: string; role: string }, id: string, write = false) {
  const c = id === "me" ? await Client.findOne({ userId: auth.userId, deletedAt: null }) : await Client.findOne({ _id: id, deletedAt: null }).catch(() => null);
  if (!c) throw new HttpError(404, "Client not found", "NOT_FOUND");
  const r = auth.role;
  const ok = r === "admin" || r === "super_admin" || (r === "reviewer" && !write) || (r === "client" && String(c.userId) === auth.userId) || (r === "advisor" && String(c.advisorId) === auth.userId);
  if (!ok) throw new HttpError(404, "Client not found", "NOT_FOUND"); // 404 not 403: do not reveal existence
  return c;
}

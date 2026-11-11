import { HttpError, route } from "@/lib/api";
import { testKey } from "@/lib/coachAi";
import { checkRateLimit } from "@/lib/rateLimit";

/** Checks the saved Gemini key works. */
export const POST = route(async ({ user }) => {
  if (!checkRateLimit(`aitest:${user.id}`, 10, 60_000)) throw new HttpError(429, "Wait a minute before testing again.");
  return { message: await testKey() };
}, { admin: true });

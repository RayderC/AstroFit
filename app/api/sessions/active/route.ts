import { route } from "@/lib/api";
import { activeSession } from "@/lib/repo/sessions";

export const GET = route(({ user }) => ({ session: activeSession(user.id) ?? null }));

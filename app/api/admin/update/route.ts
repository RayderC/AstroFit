import { route } from "@/lib/api";
import { checkForUpdate } from "@/lib/updateCore";

export const GET = route(({ req }) => checkForUpdate("rayderc/astrofit", req.nextUrl.searchParams.get("force") === "1"), { admin: true });

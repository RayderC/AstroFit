// Runs once when the server starts: the nightly backup and the daily update check.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __astrofitJobs?: boolean };
  if (g.__astrofitJobs) return;
  g.__astrofitJobs = true;
  const run = async () => {
    const [{ nightlyBackup }, { backupConfig }, { checkForUpdate }] = await Promise.all([import("./lib/backupCore"), import("./lib/backup"), import("./lib/updateCore")]);
    await nightlyBackup(backupConfig).catch(e => console.error("[backup] nightly copy failed", e));
    await checkForUpdate("rayderc/astrofit");
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, 60 * 60 * 1000).unref();
}

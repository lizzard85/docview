// Automatic updates via the Tauri updater plugin (GitHub Releases).

import { isTauri } from "./backend";

export interface UpdateUi {
  /** Shows a message in the notice bar, optionally with buttons. */
  notice(message: string, actions?: { label: string; primary?: boolean; run: () => void }[]): void;
  clearNotice(): void;
  toast(message: string): void;
}

let busy = false;
let dismissedVersion: string | null = null;

export async function appVersion(): Promise<string> {
  if (!isTauri) return "dev";
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

/**
 * Checks for a newer version. `manual` = the user asked, so "no update" and
 * errors are reported; automatic checks stay silent unless there is an update.
 */
export async function checkForUpdate(ui: UpdateUi, manual: boolean): Promise<void> {
  if (!isTauri) {
    if (manual) ui.toast("Opdateringer virker kun i den installerede app");
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      if (manual) ui.toast(`Du har den nyeste version (${await appVersion()})`);
      return;
    }
    if (!manual && dismissedVersion === update.version) return;
    ui.notice(`DocView ${update.version} er klar (du har ${update.currentVersion}).`, [
      {
        label: "Opdatér og genstart",
        primary: true,
        run: () => void install(ui, update),
      },
      {
        label: "Senere",
        run: () => {
          dismissedVersion = update.version;
          ui.clearNotice();
        },
      },
    ]);
  } catch (e) {
    if (manual) ui.toast(`Kunne ikke søge efter opdateringer: ${e}`);
    else console.warn("update check failed", e);
  } finally {
    busy = false;
  }
}

type Update = NonNullable<Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater").check>>>;

async function install(ui: UpdateUi, update: Update) {
  let total = 0;
  let received = 0;
  ui.notice(`Henter DocView ${update.version}…`);
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? 0;
      else if (event.event === "Progress") {
        received += event.data.chunkLength;
        if (total) ui.notice(`Henter DocView ${update.version}… ${Math.round((received / total) * 100)} %`);
      } else if (event.event === "Finished") ui.notice("Installerer…");
    });
    // On Windows the installer closes the app itself; elsewhere restart it.
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    ui.notice(`Opdateringen mislykkedes: ${e}`, [{ label: "Luk", run: () => ui.clearNotice() }]);
  }
}

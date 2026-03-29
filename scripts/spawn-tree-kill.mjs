/**
 * Shared helpers: spawn with stdin detached from children (so Ctrl+C reaches Node),
 * and tree-kill for clean shutdown on Windows (taskkill /T /F).
 */
import { spawn } from "node:child_process";
import process from "node:process";
import treeKill from "tree-kill";

/**
 * @param {string} command
 * @param {{ cwd: string }} opts
 */
export function spawnWithIgnoredStdin(command, opts) {
  return spawn(command, {
    cwd: opts.cwd,
    env: { ...process.env },
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
    windowsHide: true,
  });
}

/**
 * @param {number | undefined} pid
 * @returns {Promise<void>}
 */
export function killPidTree(pid) {
  return new Promise((resolve) => {
    if (typeof pid !== "number") {
      resolve();
      return;
    }
    treeKill(pid, (err) => {
      if (err && err.code !== "ESRCH") {
        console.error(`tree-kill(${pid}):`, err.message);
      }
      resolve();
    });
  });
}

/**
 * @param {(reason: string) => void | Promise<void>} onShutdown
 */
export function installSignalHandlers(onShutdown) {
  const fn = () => {
    const r = onShutdown("signal");
    if (r && typeof r.then === "function") void r;
  };
  process.once("SIGINT", fn);
  process.once("SIGTERM", fn);
  if (process.platform === "win32") {
    process.once("SIGBREAK", fn);
  }
}

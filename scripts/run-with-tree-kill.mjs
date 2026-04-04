#!/usr/bin/env node
/**
 * Run one shell command under the repo root; on Ctrl+C / SIGTERM, tree-kill the
 * child process tree (fixes uvicorn --reload / next dev orphans on Windows).
 *
 * Usage: node scripts/run-with-tree-kill.mjs <command with args...>
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import {
  installSignalHandlers,
  killPidTree,
  spawnWithIgnoredStdin,
} from "./spawn-tree-kill.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv.slice(2).join(" ").trim();

if (!command) {
  console.error("Usage: node scripts/run-with-tree-kill.mjs <command>");
  process.exit(1);
}

let shuttingDown = false;
/** @type {number | null} */
let childExitCode = null;
const child = spawnWithIgnoredStdin(command, { cwd: repoRoot });

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (reason === "signal") {
    console.error("\nStopping…");
    await killPidTree(child.pid);
  }
  const delay = reason === "signal" ? 500 : 0;
  setTimeout(() => process.exit(childExitCode ?? 0), delay).unref();
}

child.on("exit", (code, signal) => {
  if (shuttingDown) return;
  childExitCode = code === null ? (signal ? 1 : 0) : code;
  void shutdown("child exited");
});

installSignalHandlers(shutdown);

#!/usr/bin/env node
/**
 * Run API + web dev together. Children use stdin "ignore" so Ctrl+C reaches this
 * Node process; tree-kill tears down uvicorn / Next process trees on Windows.
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

/** @type {{ name: string; child: import("node:child_process").ChildProcess }[]} */
const children = [];

let shuttingDown = false;

function start(name, command) {
  const child = spawnWithIgnoredStdin(command, { cwd: repoRoot });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
    void shutdown(`${name} exited`);
  });

  children.push({ name, child });
}

async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error(`\nStopping dev servers (${reason})…`);

  const pids = children
    .map(({ child }) => child.pid)
    .filter((p) => typeof p === "number");

  await Promise.all(pids.map((pid) => killPidTree(pid)));

  setTimeout(() => process.exit(0), 500).unref();
}

start("api", "pnpm run _dev:api:inner");
start("web", "pnpm run _dev:web:inner");

installSignalHandlers(shutdown);

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Runs a privileged command via passwordless sudo. Required dev/MVP setup:
 * the engine's own user must have NOPASSWD sudo in its (disposable, trusted)
 * Linux host — see the plan's accepted "engine runs privileged" MVP risk.
 * Uses execFile (argument array, no shell) so arguments are never
 * shell-interpreted even though they're all internally generated, not
 * user-supplied strings.
 */
export async function sudoExec(command: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("sudo", [command, ...args]);
  return stdout;
}

/** Same as sudoExec, but never throws; used for best-effort teardown steps. */
export async function sudoExecBestEffort(command: string, args: string[]): Promise<void> {
  try {
    await sudoExec(command, args);
  } catch {
    // Intentionally ignored: teardown must proceed even if a step 404s
    // (e.g. an interface already gone) or partially failed earlier.
  }
}

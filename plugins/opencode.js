/**
 * clean-my-agent — OpenCode plugin
 *
 * Automatically detects and kills orphan AI coding assistant processes
 * (OpenCode, Claude Code, Codex) after each conversation ends.
 *
 * How it works:
 *   Hooks into OpenCode's `session.idle` event. For each AI tool process,
 *   walks up the process tree to find its shell ancestor. If that shell
 *   has lost its controlling terminal (tty == "??"), the process is orphaned.
 *
 * Safety:
 *   - Only kills processes whose shell ancestor has no terminal
 *   - Active sessions and their sub-agents are never affected
 *   - Skips sub-agent sessions (only triggers on main conversation end)
 *   - 10s cooldown between runs
 *   - All errors silently caught
 *
 * Platform: macOS + Linux
 */

const TOOLS = ["opencode", "claude", "codex"];
const SHELLS = new Set(["zsh", "bash", "fish", "sh", "dash", "tcsh", "csh", "ksh"]);
const COOLDOWN_MS = 10_000;
const GRACE_SECS = 30;

function isShell(comm) {
  const base = comm.replace(/^-/, "").split("/").pop();
  return SHELLS.has(base);
}

function hasTty(tty) {
  return tty !== "??" && tty !== "?";
}

function detectTool(args) {
  const lower = args.toLowerCase();
  if (lower.includes("clean-my-agent")) return null;
  for (const tool of TOOLS) {
    if (lower.includes(tool)) return tool;
  }
  return null;
}

/**
 * Parse ps etime format [[DD-]HH:]MM:SS into seconds.
 */
function parseEtime(etime) {
  const normalized = etime.replace(/-/g, ":");
  const parts = normalized.split(":").map(Number);
  switch (parts.length) {
    case 2: return parts[0] * 60 + parts[1];
    case 3: return parts[0] * 3600 + parts[1] * 60 + parts[2];
    case 4: return parts[0] * 86400 + parts[1] * 3600 + parts[2] * 60 + parts[3];
    default: return 0;
  }
}

export const CleanMyAgentPlugin = async ({ $, client }) => {
  const myPid = typeof process !== "undefined" ? String(process.pid) : "";
  let lastRun = 0;

  /**
   * Scan for orphan processes across all supported AI tools.
   * Returns an array of PIDs to kill.
   */
  async function scanOrphans() {
    const raw = await $`ps -eo pid,ppid,tty,etime,rss,user,args`.quiet().text();
    const lines = raw.trim().split("\n").slice(1); // skip header

    const myUser = (await $`whoami`.quiet().text()).trim();

    // Build process tree lookup
    const procs = new Map();
    const candidates = [];

    for (const line of lines) {
      const m = line.trim().match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.+)$/);
      if (!m) continue;

      const [, pid, ppid, tty, etime, rss, user, args] = m;
      if (user !== myUser) continue;

      procs.set(pid, { ppid, tty, etime, rss: Number(rss), args, cmd: args.split(/\s+/)[0] });

      // Identify candidates (exclude self, require no tty)
      const tool = detectTool(args);
      if (tool && pid !== myPid && !hasTty(tty)) {
        const secs = parseEtime(etime);
        if (secs >= GRACE_SECS) {
          candidates.push({ pid, tool, rss: Number(rss) });
        }
      }
    }

    // Walk each candidate's ancestor chain to verify it's truly orphaned
    const orphans = [];
    for (const { pid, tool, rss } of candidates) {
      let cur = pid;
      const visited = new Set();
      let alive = false;

      while (cur && !visited.has(cur) && cur !== "0" && cur !== "1") {
        visited.add(cur);
        const info = procs.get(cur);
        if (!info) break;

        if (isShell(info.cmd)) {
          alive = hasTty(info.tty);
          break;
        }
        cur = info.ppid;
      }

      if (!alive) {
        orphans.push(pid);
      }
    }

    return orphans;
  }

  return {
    event: async ({ event }) => {
      // Only trigger on conversation completion or error
      if (event.type !== "session.idle" && event.type !== "session.error") return;

      // Skip sub-agent sessions
      try {
        const sid = event.properties?.sessionID;
        if (!sid) return;
        const res = await client.session.get({ path: { id: sid } });
        if (res.data?.parentID) return;
      } catch {
        return;
      }

      // Cooldown
      const now = Date.now();
      if (now - lastRun < COOLDOWN_MS) return;
      lastRun = now;

      // Scan and kill
      try {
        const pids = await scanOrphans();
        for (const pid of pids) {
          try {
            await $`kill ${pid}`.quiet();
          } catch {
            // Process may have already exited
          }
        }
      } catch {
        // Never disrupt the user's session
      }
    },
  };
};

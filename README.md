# clean-my-agent

Detect and kill orphan AI coding assistant processes before they eat all your RAM.

**Supports:** OpenCode | Claude Code | Codex  
**Platforms:** macOS | Linux

---

![opencode-threads](Pics/opencode-threads-2945224.jpg)

## The Problem

AI coding assistants (OpenCode, Claude Code, Codex) spawn heavy processes — 700 MB to 1.8 GB each. When you close a terminal tab instead of properly exiting, those processes become orphans. They keep running silently, stacking up, and devouring memory.

A typical scenario after a few days:

```
30+ orphan processes × ~800 MB each = 24 GB leaked
Physical Memory: 32 GB | Swap Used: 38 GB | System: unusable
```

This is a [documented](https://github.com/anomalyco/opencode/issues/15348), [widespread](https://github.com/anomalyco/opencode/issues/13230) problem across multiple tools, with reports of **37 GB RSS in 30 minutes**, kernel soft lockups, and machines requiring hard power-off.

`clean-my-agent` fixes this.

## Installation

```bash
git clone https://github.com/anthropics/clean-my-agent.git
cd clean-my-agent
./install.sh
```

The installer:
1. Symlinks the CLI to `~/.local/bin/`
2. Installs the OpenCode auto-cleanup plugin (if OpenCode is detected)

> Make sure `~/.local/bin` is in your `$PATH`. Add `export PATH="$HOME/.local/bin:$PATH"` to your shell config if needed.

### Manual Installation

```bash
# CLI only — copy anywhere in your PATH
chmod +x clean-my-agent
cp clean-my-agent /usr/local/bin/

# OpenCode plugin — enables auto-cleanup after each conversation
cp plugins/opencode.js ~/.config/opencode/plugins/cleanup-orphans.js
```

## Usage

### Scan (dry-run)

Preview orphan processes without killing them:

```bash
clean-my-agent scan
```

```
  🔍 Scanning for orphan processes...
  Tools: opencode, claude, codex | Grace period: 30s

  TOOL       PID       MEMORY        AGE  COMMAND
  ──────────────────────────────────────────────────────
  opencode   12345      1.2 GB    2:15:30  opencode
  opencode   12346      800 MB    2:15:30  opencode
  claude     23456      350 MB      45:12  claude
  codex      34567      200 MB      30:05  codex

  ! Found 4 orphan process(es) using ~2.5 GB
  ℹ Run 'clean-my-agent clean' to terminate them.
```

### Clean

Detect and kill orphan processes:

```bash
clean-my-agent clean
```

```
  🧹 Cleaning orphan processes...

  ✓ Killed opencode (PID 12345, 1.2 GB)
  ✓ Killed opencode (PID 12346, 800 MB)
  ✓ Killed claude (PID 23456, 350 MB)
  ✓ Killed codex (PID 34567, 200 MB)

  ✓ Cleaned 4 process(es), freed ~2.5 GB
```

### Guard (daemon mode)

Run as a background watchdog that periodically scans and cleans:

```bash
clean-my-agent guard
```

```
  🛡️  Guard mode active
  Tools: opencode, claude, codex | Interval: 60s | Grace: 30s
  PID: 12345 | Stop with: clean-my-agent unguard

  [11:30:00] Scan: no orphans
  [11:31:00] Scan: no orphans
  ✓ [11:32:00] Cleaned 2 orphan(s) — freed ~1.5 GB
  [11:33:00] Scan: no orphans
```

Stop a running guard:

```bash
clean-my-agent unguard
```

```
  ✓ Guard stopped (PID 12345).
```

You can also run guard in the background:

```bash
clean-my-agent guard &          # background in current shell
nohup clean-my-agent guard &    # survives terminal close
```

### Options

| Flag | Description | Default |
|---|---|---|
| `-t, --tools <list>` | Comma-separated tools to scan | `opencode,claude,codex` |
| `-g, --grace <secs>` | Skip processes younger than N seconds | `30` |
| `-i, --interval <secs>` | Guard mode check interval | `60` |
| `-v, --verbose` | Verbose output | off |
| `-h, --help` | Show help | — |
| `--version` | Show version | — |

### Examples

```bash
# Only clean OpenCode processes
clean-my-agent clean -t opencode

# Clean OpenCode + Claude Code, skip processes under 60s old
clean-my-agent clean -t opencode,claude -g 60

# Guard mode checking every 2 minutes
clean-my-agent guard -i 120

# Guard only Claude Code
clean-my-agent guard -t claude -i 30

# Run guard in background, stop later
clean-my-agent guard &
clean-my-agent unguard

## OpenCode Plugin (Auto Mode)

If you use [OpenCode](https://opencode.ai), the installer sets up a plugin that **automatically cleans orphan processes after every conversation**. No manual intervention needed.

The plugin hooks into OpenCode's `session.idle` event and runs the same detection algorithm as the CLI. It includes:
- 10-second cooldown between runs
- Sub-agent session filtering (only triggers on main conversations)
- Silent error handling (never disrupts your session)

**Manual plugin install:**

```bash
cp plugins/opencode.js ~/.config/opencode/plugins/cleanup-orphans.js
```

Restart OpenCode to activate.

## How It Works

`clean-my-agent` uses **process tree analysis with TTY detection** — a more precise approach than simple PPID-based checks.

For each AI tool process:

1. **Walk up the process tree** to find its shell ancestor (zsh, bash, fish, etc.)
2. **Check if that shell has a controlling terminal** (a real TTY like `ttys001`)
3. If the shell's TTY is `??` (no terminal) → the process is **orphaned**
4. If the shell has a real TTY → the process is **active and safe**

```
Active session (SAFE — never killed):
  Terminal.app
    └── zsh (tty=ttys001)        ← has terminal
          └── opencode            ← active
                └── sub-agent     ← also active (inherits tty)

Orphan (KILLED):
  ghost zsh (tty=??)             ← terminal was closed
    └── opencode                  ← orphaned, eating 800 MB
```

### Why TTY detection?

Other tools use `PPID=1` (re-parented to init) as the orphan signal. This misses cases where the parent shell is still alive but its terminal is gone — which is the most common scenario on macOS.

TTY detection catches both:
- Processes re-parented to PID 1 (parent died)
- Processes whose parent shell lost its terminal (tab closed)

### Safety guarantees

- **Pre-filter**: Processes with a real TTY are immediately skipped — zero risk of killing active sessions
- **Grace period**: Processes younger than 30 seconds (configurable) are skipped to avoid race conditions
- **User isolation**: Only scans processes owned by the current user
- **Self-exclusion**: The cleanup tool itself is never matched

## Supported Tools

| Tool | Process Pattern | Status |
|---|---|---|
| [OpenCode](https://opencode.ai) | `opencode` | Fully supported + auto-plugin |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `claude` | Fully supported |
| [Codex](https://github.com/openai/codex) | `codex` | Fully supported |

Want to add another tool? See [Contributing](#contributing).

## Platform Support

| Platform | Status | Notes |
|---|---|---|
| macOS | Fully tested | Primary development platform |
| Linux | Supported | TTY format differences handled (`?` vs `??`) |

## Update

```bash
cd clean-my-agent
git pull
./install.sh
```

## Uninstall

```bash
# Remove the CLI
rm ~/.local/bin/clean-my-agent

# Remove the OpenCode plugin (optional)
rm ~/.config/opencode/plugins/cleanup-orphans.js

# Remove the source (optional)
rm -rf /path/to/clean-my-agent
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Adding a new tool** is straightforward — it only requires adding a pattern to the `detect_tool` function in both the CLI script and the OpenCode plugin.

## License

[MIT](LICENSE)

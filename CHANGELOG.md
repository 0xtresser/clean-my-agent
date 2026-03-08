# Changelog

## 0.1.0 (2026-03-08)

Initial release.

### Features

- **CLI tool** with four modes: `scan` (dry-run), `clean` (kill orphans), `guard` (daemon), `unguard` (stop guard)
- **Process tree analysis** with TTY detection — walks ancestor chain to find shell, checks if shell has a controlling terminal
- **Pre-filter optimization** — processes with a real TTY are immediately skipped (zero risk to active sessions)
- **Grace period** — skip processes younger than N seconds (default: 30) to avoid race conditions
- **Multi-tool support** — OpenCode, Claude Code, Codex
- **OpenCode plugin** — auto-cleanup on `session.idle` event after each conversation
- **Cross-platform** — macOS + Linux, handles TTY format differences (`??` vs `?`)
- **User isolation** — only scans processes owned by the current user
- **Color output** with auto-detection (disabled when piping)
- **Install script** — one-command setup for CLI + OpenCode plugin
- **Guard lifecycle** — PID file based `guard`/`unguard` with duplicate instance prevention
- **Install script** — one-command setup for CLI + OpenCode plugin

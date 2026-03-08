# Contributing

Thanks for your interest in improving `clean-my-agent`.

## Adding a New Tool

The most common contribution is adding support for a new AI coding assistant.

### 1. CLI (`clean-my-agent`)

In the `detect_tool` awk function (~line 112), add a new pattern:

```awk
function detect_tool(s,    l) {
    l = tolower(s)
    if (l ~ /clean-my-agent/) return ""
    if (l ~ /opencode/) return "opencode"
    if (l ~ /claude/)   return "claude"
    if (l ~ /codex/)    return "codex"
    if (l ~ /yourtool/) return "yourtool"   # ← add here
    return ""
}
```

### 2. OpenCode Plugin (`plugins/opencode.js`)

Add the tool name to the `TOOLS` array:

```javascript
const TOOLS = ["opencode", "claude", "codex", "yourtool"];
```

### 3. Documentation

Update the supported tools table in `README.md` and add the tool to the help text in the CLI's `usage()` function.

## Bug Reports

Please include:
- OS and version (e.g., macOS 15.3, Ubuntu 24.04)
- Output of `clean-my-agent scan -v`
- Output of `ps -eo pid,ppid,tty,comm | grep <tool-name>`

## Pull Requests

- One feature or fix per PR
- Test on macOS or Linux before submitting
- Keep changes minimal — this is a small tool, let's keep it that way

## Code Style

- CLI: Bash with awk for heavy lifting. Compatible with bash 3.2+ (macOS default).
- Plugin: Plain JavaScript (ES modules). No build step, no dependencies.

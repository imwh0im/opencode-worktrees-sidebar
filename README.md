# opencode-worktrees-sidebar

An opencode TUI sidebar plugin that shows git worktrees observed in the current session.

The plugin adds a `Worktrees` section to the opencode sidebar. It records the current session directory, assistant message paths, and worktree paths mentioned by tool calls, then opens a selected path in your editor.

## Install

```bash
npm install -g @imwh0im/opencode-worktrees-sidebar
```

Then add the package to `~/.config/opencode/tui.json`:

```json
{
  "plugin": ["@imwh0im/opencode-worktrees-sidebar"]
}
```

Restart opencode after changing `tui.json`.

## Options

By default, clicking a worktree opens it with Cursor:

```bash
cursor {path}
```

Pass `editorCommand` to use another editor. The `{path}` token is replaced with the worktree path and kept as one argument, including paths with spaces.

```json
{
  "plugin": [
    [
      "@imwh0im/opencode-worktrees-sidebar",
      {
        "editorCommand": "code -r {path}"
      }
    ]
  ]
}
```

Other examples:

```json
{ "editorCommand": "zed {path}" }
```

```json
{ "editorCommand": "open {path}" }
```

## Migration From A Local Plugin

If you previously loaded a local file such as:

```json
{
  "plugin": [
    [
      "./tui-plugins/worktrees-sidebar.tsx",
      {
        "editorCommand": "cursor {path}"
      }
    ]
  ]
}
```

replace it with the package specifier:

```json
{
  "plugin": [
    [
      "@imwh0im/opencode-worktrees-sidebar",
      {
        "editorCommand": "cursor {path}"
      }
    ]
  ]
}
```

## Scope

This MVP packages the existing local sidebar behavior. It does not scan every git repository on disk and does not use opencode's experimental worktree API. Worktrees appear after the current session or assistant/tool output reveals them.

## Development

```bash
bun install
bun run validate
```

Useful checks:

```bash
bun test
bun run typecheck
bun run build
npm pack --dry-run
npm publish --access public --provenance --dry-run
```

## License

MIT

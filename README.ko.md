# opencode-worktrees-sidebar

현재 세션에서 관측된 git worktree를 opencode 사이드바에 보여주는 TUI 플러그인입니다.

이 플러그인은 opencode 사이드바에 `Worktrees` 섹션을 추가합니다. 현재 세션 디렉터리, assistant 메시지의 경로, tool call에 언급된 worktree 경로를 기록하고, 항목을 클릭하면 설정한 에디터로 해당 경로를 엽니다.

## 설치

```bash
npm install -g @imwh0im/opencode-worktrees-sidebar
```

그다음 `~/.config/opencode/tui.json`에 패키지를 추가합니다.

```json
{
  "plugin": ["@imwh0im/opencode-worktrees-sidebar"]
}
```

`tui.json`을 바꾼 뒤에는 opencode를 재시작해야 합니다.

## 옵션

기본값은 클릭한 worktree를 Cursor로 여는 것입니다.

```bash
cursor {path}
```

다른 에디터를 쓰려면 `editorCommand`를 넘기면 됩니다. `{path}` 토큰은 worktree 경로로 치환되며, 공백이 있는 경로도 하나의 인자로 유지됩니다.

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

다른 예시:

```json
{ "editorCommand": "zed {path}" }
```

```json
{ "editorCommand": "open {path}" }
```

## 로컬 플러그인에서 마이그레이션

기존에 이런 식으로 로컬 파일을 직접 로드했다면:

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

패키지 이름으로 바꾸면 됩니다.

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

## 범위

이 MVP는 기존 로컬 사이드바 동작을 패키지화한 것입니다. 디스크의 모든 git 저장소를 스캔하지 않고, opencode의 experimental worktree API도 사용하지 않습니다. 현재 세션이나 assistant/tool 출력에서 worktree 경로가 관측된 뒤에 항목이 나타납니다.

## 개발

```bash
bun install
bun run validate
```

유용한 검증 명령:

```bash
bun test
bun run typecheck
bun run build
npm pack --dry-run
npm publish --access public --provenance --dry-run
```

## 라이선스

MIT

import { describe, expect, it } from "bun:test"
import {
  buildEditorCommand,
  formatWorktreeEntry,
  getSessionEntries,
  inferRepoDirectory,
  normalizeOptions,
  recordMessageParts,
  recordMessageWorktrees,
  recordObservedWorktree,
  type WorktreeStore,
} from "../src/index.js"

describe("worktrees sidebar options", () => {
  it("defaults the editor command to Cursor when no option is provided", () => {
    const options = normalizeOptions(undefined)

    expect(options.editorCommand).toBe("cursor {path}")
  })

  it("uses a custom editor command when provided", () => {
    const options = normalizeOptions({ editorCommand: "code -r {path}" })

    expect(options.editorCommand).toBe("code -r {path}")
  })
})

describe("session worktree tracking", () => {
  it("records multiple worktrees for one session", () => {
    const store: WorktreeStore = new Map()

    recordObservedWorktree(store, {
      sessionID: "ses_a",
      directory: "/Users/jun/Documents/wisely",
      worktree: "/Users/jun/Documents/wisely",
      branch: "main",
    })
    recordObservedWorktree(store, {
      sessionID: "ses_a",
      directory: "/Users/jun/Documents/wisely",
      worktree: "/Users/jun/Documents/wisely/.worktrees/feature-x",
      branch: "feature-x",
    })

    expect(getSessionEntries(store, "ses_a")).toEqual([
      {
        repoName: "wisely",
        label: "main",
        path: "/Users/jun/Documents/wisely",
      },
      {
        repoName: "wisely",
        label: "feature-x",
        path: "/Users/jun/Documents/wisely/.worktrees/feature-x",
      },
    ])
  })

  it("keeps sessions isolated", () => {
    const store: WorktreeStore = new Map()

    recordObservedWorktree(store, {
      sessionID: "ses_a",
      directory: "/repo/a",
      worktree: "/repo/a",
      branch: "main",
    })
    recordObservedWorktree(store, {
      sessionID: "ses_b",
      directory: "/repo/b",
      worktree: "/repo/b",
      branch: "main",
    })

    expect(getSessionEntries(store, "ses_a")).toEqual([{ repoName: "a", label: "main", path: "/repo/a" }])
  })

  it("deduplicates by path and updates the label", () => {
    const store: WorktreeStore = new Map()

    recordObservedWorktree(store, {
      sessionID: "ses_a",
      directory: "/repo/a",
      worktree: "/repo/a/.worktrees/feature-x",
      branch: "feature-x",
    })
    recordObservedWorktree(store, {
      sessionID: "ses_a",
      directory: "/repo/a",
      worktree: "/repo/a/.worktrees/feature-x",
      branch: "renamed-feature",
    })

    expect(getSessionEntries(store, "ses_a")).toEqual([
      { repoName: "a", label: "renamed-feature", path: "/repo/a/.worktrees/feature-x" },
    ])
  })

  it("records assistant message cwd values as session-observed worktrees", () => {
    const store: WorktreeStore = new Map()

    recordMessageWorktrees(store, "ses_a", [
      {
        role: "assistant",
        path: {
          cwd: "/Users/jun/Documents/wisely/admin-web/.worktrees/quotation-intake-received-quote-display",
          root: "/Users/jun/Documents/wisely",
        },
      },
    ])

    expect(getSessionEntries(store, "ses_a")).toEqual([
      {
        repoName: "admin-web",
        label: "quotation-intake-received-quote-display",
        path: "/Users/jun/Documents/wisely/admin-web/.worktrees/quotation-intake-received-quote-display",
      },
    ])
  })

  it("records worktree paths mentioned by assistant tool parts", () => {
    const store: WorktreeStore = new Map()

    recordMessageWorktrees(store, "ses_a", [
      {
        role: "assistant",
        content: [
          {
            type: "tool",
            tool: "bash",
            state: {
              status: "completed",
              input: {
                workdir: "/Users/jun/Documents/wisely/admin-web/.worktrees/quote-display",
              },
              outputPaths: ["/Users/jun/Documents/wisely/commerce-web/.worktrees/cart-fix"],
            },
          },
          {
            type: "text",
            text: "# Running in /Users/jun/Documents/wisely/agents-workspace/.worktrees/cs-agent",
          },
        ],
      },
    ])

    expect(getSessionEntries(store, "ses_a")).toEqual([
      {
        repoName: "admin-web",
        label: "quote-display",
        path: "/Users/jun/Documents/wisely/admin-web/.worktrees/quote-display",
      },
      {
        repoName: "agents-workspace",
        label: "cs-agent",
        path: "/Users/jun/Documents/wisely/agents-workspace/.worktrees/cs-agent",
      },
      {
        repoName: "commerce-web",
        label: "cart-fix",
        path: "/Users/jun/Documents/wisely/commerce-web/.worktrees/cart-fix",
      },
    ])
  })

  it("records worktree paths from message parts when messages only contain metadata", () => {
    const store: WorktreeStore = new Map()

    recordMessageParts(store, "ses_0d921931cffegVC6ooB8VhghlP", [
      {
        type: "tool",
        state: {
          status: "completed",
          input: {
            command: "GIT_MASTER=1 git worktree add -b sisyphus/admin-backend-20260703 .worktrees/admin-backend-20260703",
            workdir: "/Users/jun/Documents/wisely/admin-backend",
          },
          output: "Preparing worktree (new branch 'sisyphus/admin-backend-20260703')\n",
        },
      },
      {
        type: "text",
        text: "경로: `/Users/jun/Documents/wisely/admin-backend/.worktrees/admin-backend-20260703`",
      },
    ])

    expect(getSessionEntries(store, "ses_0d921931cffegVC6ooB8VhghlP")).toEqual([
      {
        repoName: "admin-backend",
        label: "admin-backend-20260703",
        path: "/Users/jun/Documents/wisely/admin-backend/.worktrees/admin-backend-20260703",
      },
    ])
  })

  it("ignores worktree paths that only appear in tool output listings", () => {
    const store: WorktreeStore = new Map()

    recordMessageParts(store, "ses_a", [
      {
        type: "tool",
        state: {
          status: "completed",
          input: {
            command: "git worktree list",
            workdir: "/Users/jun/Documents/wisely/admin-backend",
          },
          output: "/Users/jun/Documents/wisely/admin-backend/.worktrees/old-worktree  abcdef [old-worktree]",
        },
      },
    ])

    expect(getSessionEntries(store, "ses_a")).toEqual([])
  })

  it("ignores output listings inside assistant message content", () => {
    const store: WorktreeStore = new Map()

    recordMessageWorktrees(store, "ses_a", [
      {
        role: "assistant",
        content: [
          {
            type: "tool",
            state: {
              status: "completed",
              input: {
                command: "git worktree list",
                workdir: "/Users/jun/Documents/wisely/admin-backend",
              },
              output: "/Users/jun/Documents/wisely/admin-backend/.worktrees/rfq-agent-actions  3bdd72ce [rfq-agent-actions]",
            },
          },
        ],
      },
    ])

    expect(getSessionEntries(store, "ses_a")).toEqual([])
  })

  it("ignores path-only lines from captured sidebar text", () => {
    const store: WorktreeStore = new Map()

    recordMessageParts(store, "ses_a", [
      {
        type: "text",
        text: "▼ Worktrees\n• admin-backend rfq-agent-actions\n/Users/jun/Documents/wisely/admin-backend/.worktrees/rfq-agent-actions",
      },
    ])

    expect(getSessionEntries(store, "ses_a")).toEqual([])
  })
})

describe("worktree display formatting", () => {
  it("uses the repository directory name as the primary name", () => {
    const entry = formatWorktreeEntry({
      directory: "/Users/jun/Documents/wisely",
      worktree: "/Users/jun/Documents/wisely/.worktrees/prelaunch-sample-test-m2",
      branch: undefined,
    })

    expect(entry).toEqual({
      repoName: "wisely",
      label: "prelaunch-sample-test-m2",
      path: "/Users/jun/Documents/wisely/.worktrees/prelaunch-sample-test-m2",
    })
  })

  it("infers the original repository directory from a .worktrees path", () => {
    const repoDirectory = inferRepoDirectory("/Users/jun/Documents/wisely/.worktrees/prelaunch-sample-test-m2")

    expect(repoDirectory).toBe("/Users/jun/Documents/wisely")
  })
})

describe("editor command building", () => {
  it("keeps a path with spaces as a single argv item", () => {
    const command = buildEditorCommand("cursor {path}", "/tmp/repo with spaces")

    expect(command).toEqual({ command: "cursor", args: ["/tmp/repo with spaces"] })
  })

  it("supports custom command templates", () => {
    const command = buildEditorCommand("code -r {path}", "/tmp/repo")

    expect(command).toEqual({ command: "code", args: ["-r", "/tmp/repo"] })
  })
})

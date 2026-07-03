import { describe, expect, it } from "bun:test"
import { collectWorktreePaths, getSessionEntries, recordMessageParts, type WorktreeStore } from "../src/index.js"

describe("worktree path collection", () => {
  it("collects unique .worktrees paths from nested unknown values", () => {
    const paths = collectWorktreePaths({
      args: {
        workdir: "/repo/app/.worktrees/feature-a",
      },
      text: "# Running in /repo/api/.worktrees/feature-b\n",
      duplicate: "/repo/app/.worktrees/feature-a",
    })

    expect(paths).toEqual(["/repo/app/.worktrees/feature-a", "/repo/api/.worktrees/feature-b"])
  })

  it("resolves relative .worktrees paths against a tool workdir", () => {
    const paths = collectWorktreePaths({
      input: {
        command: "git worktree add -b feature .worktrees/feature",
        workdir: "/repo/app",
      },
    })

    expect(paths).toEqual(["/repo/app/.worktrees/feature"])
  })

  it("splits paths at escaped newlines in serialized tool output", () => {
    const paths = collectWorktreePaths(
      "/Users/jun/Documents/wisely/admin-backend/.worktrees/admin-backend-20260703]\\n/Users/jun/Documents/wisely/admin-backend/.worktrees/rfq-agent-actions",
    )

    expect(paths).toEqual([
      "/Users/jun/Documents/wisely/admin-backend/.worktrees/admin-backend-20260703",
      "/Users/jun/Documents/wisely/admin-backend/.worktrees/rfq-agent-actions",
    ])
  })
})

describe("worktree part filtering", () => {
  it("ignores bash commands that only search for a worktree path", () => {
    const store: WorktreeStore = new Map()

    recordMessageParts(store, "ses_a", [
      {
        type: "tool",
        tool: "bash",
        state: {
          status: "completed",
          input: {
            command:
              "sqlite3 db \"SELECT * FROM part WHERE data LIKE '%/Users/jun/Documents/wisely/admin-backend/.worktrees/rfq-agent-actions%'\"",
            workdir: "/Users/jun/Documents/wisely",
          },
        },
      },
    ])

    expect(getSessionEntries(store, "ses_a")).toEqual([])
  })
})

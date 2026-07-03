import { describe, expect, it } from "bun:test"
import plugin, { tui } from "../src/index.js"

describe("package entry", () => {
  it("exports the opencode TUI plugin entry", () => {
    expect(plugin.id).toBe("worktrees-sidebar")
    expect(plugin.tui).toBe(tui)
    expect(typeof tui).toBe("function")
  })
})

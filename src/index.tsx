import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, For, Show } from "solid-js"
import {
  buildEditorCommand,
  getSessionEntries,
  normalizeOptions,
  recordMessageParts,
  recordMessageWorktrees,
  recordObservedWorktree,
  type PluginOptions,
  type WorktreeStore,
} from "./model.js"

export {
  buildEditorCommand,
  collectWorktreePaths,
  formatWorktreeEntry,
  getSessionEntries,
  inferRepoDirectory,
  normalizeOptions,
  recordMessageParts,
  recordMessageWorktrees,
  recordObservedWorktree,
  type WorktreeStore,
} from "./model.js"

const sessionWorktrees: WorktreeStore = new Map()

function openWorktree(api: TuiPluginApi, options: PluginOptions, worktreePath: string): void {
  const command = buildEditorCommand(options.editorCommand, worktreePath)
  const child = spawn(command.command, command.args, {
    detached: true,
    stdio: "ignore",
  })
  child.on("error", (error) => {
    api.ui.toast({
      variant: "error",
      title: "Worktrees",
      message: `Failed to open editor: ${error.message}`,
    })
  })
  child.unref()
}

function View(props: { readonly api: TuiPluginApi; readonly sessionID: string; readonly options: PluginOptions }) {
  const theme = () => props.api.theme.current
  const [expanded, setExpanded] = createSignal(true)

  const entries = createMemo(() => {
    const session = props.api.state.session.get(props.sessionID)
    const observedPath = session?.directory ?? props.api.state.path.directory
    const branch = observedPath === props.api.state.path.directory ? props.api.state.vcs?.branch : undefined
    recordObservedWorktree(sessionWorktrees, {
      sessionID: props.sessionID,
      directory: observedPath,
      worktree: observedPath,
      branch,
    })
    const messages = props.api.state.session.messages(props.sessionID)
    recordMessageWorktrees(sessionWorktrees, props.sessionID, messages)
    for (const message of messages) {
      try {
        recordMessageParts(sessionWorktrees, props.sessionID, props.api.state.part(message.id))
      } catch (error) {
        if (error instanceof Error) continue
        throw error
      }
    }
    return getSessionEntries(sessionWorktrees, props.sessionID).filter((item) => existsSync(item.path))
  })

  return (
    <Show when={entries().length > 0}>
      <box>
        <text fg={theme().text} onMouseDown={() => setExpanded((value) => !value)}>
          <b>{expanded() ? "▼" : "▶"} Worktrees</b>
        </text>
        <Show when={expanded()}>
          <For each={entries()}>
            {(item) => (
              <box onMouseDown={() => openWorktree(props.api, props.options, item.path)}>
                <text fg={theme().text} wrapMode="word">
                  • {item.repoName}
                  <Show when={item.label !== item.repoName}>
                    <span style={{ fg: theme().textMuted }}> {item.label}</span>
                  </Show>
                </text>
                <text fg={theme().textMuted} wrapMode="word">
                  {item.path}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

export const tui: TuiPlugin = async (api, rawOptions) => {
  const options = normalizeOptions(rawOptions)
  api.slots.register({
    order: 350,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} sessionID={props.session_id} options={options} />
      },
    },
  })
}

export default {
  id: "worktrees-sidebar",
  tui,
}

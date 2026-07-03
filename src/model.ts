import path from "node:path"

export const DEFAULT_EDITOR_COMMAND = "cursor {path}"

export type WorktreeEntry = {
  readonly repoName: string
  readonly label: string
  readonly path: string
}

export type WorktreeStore = Map<string, Map<string, WorktreeEntry>>

export type WorktreeObservation = {
  readonly sessionID: string
  readonly directory: string
  readonly worktree: string
  readonly branch: string | undefined
}

type MessagePathObservation = {
  readonly role: string
  readonly path?: {
    readonly cwd: string
    readonly root: string
  }
  readonly content?: readonly unknown[]
}

type FormatInput = {
  readonly directory: string
  readonly worktree: string
  readonly branch: string | undefined
}

export type PluginOptions = {
  readonly editorCommand: string
}

export type EditorCommand = {
  readonly command: string
  readonly args: readonly string[]
}

export function normalizeOptions(input: unknown): PluginOptions {
  if (!isRecord(input)) return { editorCommand: DEFAULT_EDITOR_COMMAND }
  const editorCommand = input["editorCommand"]
  if (typeof editorCommand !== "string" || editorCommand.trim().length === 0) {
    return { editorCommand: DEFAULT_EDITOR_COMMAND }
  }
  return { editorCommand }
}

export function formatWorktreeEntry(input: FormatInput): WorktreeEntry {
  const repoDirectory = inferRepoDirectory(input.directory)
  return {
    repoName: path.basename(repoDirectory),
    label: input.branch ?? path.basename(input.worktree),
    path: input.worktree,
  }
}

export function inferRepoDirectory(worktreePath: string): string {
  const marker = `${path.sep}.worktrees${path.sep}`
  const markerIndex = worktreePath.indexOf(marker)
  if (markerIndex === -1) return worktreePath
  return worktreePath.slice(0, markerIndex)
}

export function recordObservedWorktree(store: WorktreeStore, observation: WorktreeObservation): void {
  const existing = store.get(observation.sessionID)
  const entries = existing ?? new Map<string, WorktreeEntry>()
  entries.set(
    observation.worktree,
    formatWorktreeEntry({
      directory: observation.directory,
      worktree: observation.worktree,
      branch: observation.branch,
    }),
  )
  if (!existing) store.set(observation.sessionID, entries)
}

export function getSessionEntries(store: WorktreeStore, sessionID: string): readonly WorktreeEntry[] {
  return [...(store.get(sessionID)?.values() ?? [])].sort((left, right) => left.path.localeCompare(right.path))
}

export function recordMessageWorktrees(
  store: WorktreeStore,
  sessionID: string,
  messages: readonly MessagePathObservation[],
): void {
  for (const message of messages) {
    if (message.role !== "assistant") continue
    if (message.path) {
      recordObservedWorktree(store, {
        sessionID,
        directory: inferRepoDirectory(message.path.cwd),
        worktree: message.path.cwd,
        branch: undefined,
      })
    }
    recordMessageParts(store, sessionID, message.content ?? [])
  }
}

export function recordMessageParts(store: WorktreeStore, sessionID: string, parts: readonly unknown[]): void {
  for (const part of parts) {
    for (const worktreePath of collectPartWorktreePaths(part)) {
      recordObservedWorktree(store, {
        sessionID,
        directory: inferRepoDirectory(worktreePath),
        worktree: worktreePath,
        branch: undefined,
      })
    }
  }
}

export function collectWorktreePaths(input: unknown): readonly string[] {
  const paths = new Set<string>()
  collectPaths(input, paths, undefined)
  return [...paths]
}

export function buildEditorCommand(template: string, worktreePath: string): EditorCommand {
  const tokens = tokenizeCommand(template)
  const [command, ...args] = tokens.map((token) => (token === "{path}" ? worktreePath : token))
  return {
    command: command ?? DEFAULT_EDITOR_COMMAND.split(" ")[0] ?? "cursor",
    args: args.length === 0 && !tokens.includes("{path}") ? [worktreePath] : args,
  }
}

function collectPaths(input: unknown, paths: Set<string>, baseDirectory: string | undefined): void {
  if (typeof input === "string") {
    for (const candidate of pathsFromString(input, baseDirectory)) paths.add(candidate)
    return
  }
  if (Array.isArray(input)) {
    for (const item of input) collectPaths(item, paths, baseDirectory)
    return
  }
  if (!isRecord(input)) return
  const localBase = directoryValue(input["workdir"]) ?? directoryValue(input["cwd"]) ?? baseDirectory
  for (const value of Object.values(input)) collectPaths(value, paths, localBase)
}

function collectPartWorktreePaths(part: unknown): readonly string[] {
  if (!isRecord(part)) return []
  const type = part["type"]
  if (type === "text" || type === "reasoning") return collectAssistantTextWorktreePaths(part["text"])
  if (type !== "tool") return []
  const tool = part["tool"]
  const state = part["state"]
  if (!isRecord(state)) return []
  return [...collectBashInputWorktreePaths(tool, state["input"]), ...collectWorktreePaths(state["outputPaths"])]
}

function collectBashInputWorktreePaths(tool: unknown, input: unknown): readonly string[] {
  if (tool !== "bash" || !isRecord(input)) return []
  const workdir = input["workdir"]
  const command = input["command"]
  const paths = typeof workdir === "string" && workdir.includes(`${path.sep}.worktrees${path.sep}`) ? [workdir] : []
  if (typeof command !== "string" || !command.includes("git worktree add")) return paths
  return [...paths, ...collectWorktreePaths(input)]
}

function collectAssistantTextWorktreePaths(input: unknown): readonly string[] {
  if (typeof input !== "string") return []
  return input
    .split("\n")
    .filter((line) => line.includes("경로:") || line.trimStart().startsWith("cd ") || line.startsWith("# Running in "))
    .flatMap((line) => collectWorktreePaths(line))
}

function pathsFromString(input: string, baseDirectory: string | undefined): readonly string[] {
  const trimmed = trimPathDelimiters(input.trim())
  if (baseDirectory && trimmed.startsWith(`.worktrees${path.sep}`)) return [path.join(baseDirectory, trimmed)]

  const matches = input.matchAll(/\/[^\s\\"'`<>,)\]]+\/\.worktrees\/[^\s\\"'`<>,)\]]+/g)
  const absolutePaths = [...matches].map((match) => trimPathDelimiters(match[0]))
  if (!baseDirectory) return absolutePaths

  const relativeMatches = input.matchAll(/(?:^|\s)(\.worktrees\/[^\s\\"'`<>,)\]]+)/g)
  return [...absolutePaths, ...[...relativeMatches].map((match) => path.join(baseDirectory, trimPathDelimiters(match[1] ?? "")))]
}

function trimPathDelimiters(input: string): string {
  return input.replace(/[\].,;:)]+$/g, "")
}

function tokenizeCommand(template: string): readonly string[] {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | '"' | undefined

  for (const char of template.trim()) {
    if (quote) {
      if (char === quote) quote = undefined
      else current += char
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current)
        current = ""
      }
      continue
    }
    current += char
  }

  if (current.length > 0) tokens.push(current)
  return tokens.length > 0 ? tokens : ["cursor", "{path}"]
}

function directoryValue(input: unknown): string | undefined {
  return typeof input === "string" && path.isAbsolute(input) ? input : undefined
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
}

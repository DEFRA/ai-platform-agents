#!/usr/bin/env node
// PreToolUse guard for the AIP agents. Reads one hook event on stdin (Local or Copilot harness shape)
// and denies, or asks the user to confirm, unsafe commands and out-of-role edits.
import { readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TF = String.raw`\bterraform(?:\.exe)?\s+(?:-\S+\s+)*`
// `git -C <path> push` and `git -c k=v push` must not slip past the push rules.
const GIT = String.raw`\bgit(?:\.exe)?(?:\s+-[cC]\s+(?:"[^"]*"|'[^']*'|\S+))*\s+`
const git = (rest, flags) => new RegExp(`${GIT}${rest}`, flags)

const DENY_COMMANDS = [
  [/--no-verify\b/, 'Never skip hooks with --no-verify.'],
  [
    git(
      String.raw`push\b[^\n]*(\s--force\b|\s--force-with-lease\b|\s-f\b|\s\+\S)`
    ),
    'Force push is not allowed; ask the user to do it by hand if truly needed.'
  ],
  [
    git(String.raw`reset\s+--hard\b`),
    'git reset --hard discards work; ask the user to run it.'
  ],
  [
    new RegExp(`${TF}(apply|destroy|import|taint|untaint|force-unlock)\\b`),
    'Terraform is applied only by the GitOps pipelines, never by hand.'
  ],
  [
    new RegExp(`${TF}state\\s+(rm|mv|push|replace-provider)\\b`),
    'Terraform state changes only through the pipelines.'
  ],
  [/\bgh\s+pr\s+merge\b/, 'Never merge your own pull request.'],
  [/\bmergePullRequest\b/, 'Never merge your own pull request.'],
  [
    /\bgh\s+run\s+rerun\b/,
    'Retry a failed run with a fresh dispatch, never a re-run.'
  ],
  [
    /\bgh\s+release\s+(create|delete|edit|upload)\b/,
    'release-please owns releases.'
  ],
  [
    /\bgh\s+repo\s+(delete|edit|rename|archive)\b/,
    'Repository settings change by script and review, not by an agent.'
  ],
  [/\bnpm\s+publish\b/, 'Publishing packages is not part of this flow.']
]

const ASK_COMMANDS = [
  [git(String.raw`push\b`), 'Gate G2: confirm this push with the user.'],
  [/\bgh\s+pr\s+create\b/, 'Gate G2: confirm opening this pull request.'],
  [/\bgh\s+workflow\s+run\b/, 'Gate G3: confirm this workflow dispatch.'],
  [
    /\bgh\s+api\b[^\n]*\/dispatches\b/,
    'Gate G3: confirm this workflow dispatch.'
  ],
  [
    /\baz\s[^\n|;&]*\s(create|delete|update|set|add|remove|purge|assign|start|stop|restart|import|deploy)\b/,
    'Azure changes happen through IaC; confirm this write with the user.'
  ],
  [
    /\brm\s+-[a-z]*(rf|fr)[a-z]*\b/i,
    'Recursive delete: confirm with the user.'
  ],
  [
    /\bRemove-Item\b[^\n]*-Recurse\b/i,
    'Recursive delete: confirm with the user.'
  ],
  [
    git(String.raw`clean\s+-[a-z]*f`),
    'git clean deletes untracked files: confirm with the user.'
  ],
  [git(String.raw`branch\s+-D\b`), 'Deleting a branch: confirm with the user.']
]

const DENY_TOOLS = [
  [
    /merge.?pull.?request|pull.?request.?merge|merge.?pr\b/i,
    'Never merge your own pull request.'
  ]
]
const ASK_TOOLS = [
  [
    /create.?pull.?request|push.?files|create.?or.?update.?file|delete.?file|create.?branch|update.?pull.?request.?branch/i,
    'Gate G2: confirm this repository write with the user.'
  ]
]

const STATE_PATH = /ai-platform-(tenants|deployments)\/environments\//
const STATE_WRITE =
  /(set-content|add-content|out-file|new-item|copy-item|move-item|remove-item|\bcp\b|\bmv\b|\brm\b|sed\s+-i|>)/i
const GUARD_PATH =
  /\/scripts\/aip-guard\.mjs$|\/ai-platform-agents\/\.github\/(agents|hooks)\/|\.code-workspace$|\/\.vscode\/settings\.json$/
const STATE_REASON =
  'Tenants and deployments state is machine-written; never edit it by hand.'
const ENV_REASON = 'Do not read or write .env files; they may hold secrets.'

const RUN = /\/\.copilot-tracking\//
const ANY_REPO = /\/ai-platform-[a-z-]+\//
// A path naming no ai-platform repo (relative) is allowed for roles with `anyOtherPath`.
const ROLE_EDIT = {
  orchestrator: { allow: [] },
  reviewer: { allow: [RUN] },
  releaser: { allow: [RUN] },
  planner: { allow: [RUN, /\/ai-platform-discovery-docs\//] },
  docs: { allow: [RUN, /\.md$/, /\/docs\//, /\/ai-platform-discovery-docs\//] },
  developer: {
    allow: [RUN, /\/ai-platform-(frontend|backend-api|journey-tests|agents)\//],
    anyOtherPath: true
  },
  platform: {
    allow: [RUN, /\/ai-platform-(infra|workflows|environments)\//],
    anyOtherPath: true
  }
}

function roleMayEdit(role, path) {
  const rules = ROLE_EDIT[role]
  if (!rules) return true
  if (rules.allow.some((rule) => rule.test(path))) return true
  return Boolean(rules.anyOtherPath) && !ANY_REPO.test(path)
}

/**
 * Normalises a Local (`tool_name`, `tool_input`) or Copilot (`toolName`, `toolArgs`) PreToolUse event.
 * @param {object} event Parsed hook payload.
 * @returns {{ tool: string, input: object }}
 */
export function readEvent(event) {
  const tool = String(event?.tool_name ?? event?.toolName ?? '')
  let input = event?.tool_input ?? event?.toolArgs ?? {}
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input)
    } catch {
      input = { command: input }
    }
  }
  return { tool, input: input ?? {} }
}

/**
 * Collects command strings and file paths from tool arguments, at any depth.
 * @param {unknown} input Tool arguments.
 * @returns {{ commands: string[], paths: string[] }}
 */
export function collectStrings(input) {
  const commands = []
  const paths = []
  const walk = (value, key = '') => {
    if (typeof value === 'string') {
      if (/^(command|cmd|script)$/i.test(key)) commands.push(value)
      if (/(path|file|uri|dir)s?$/i.test(key)) paths.push(value)
      if (/^(input|patch)$/i.test(key)) {
        for (const match of value.matchAll(
          /^\*\*\* (?:(?:Add|Update|Delete) File|Move to): (.+)$/gm
        )) {
          paths.push(match[1].trim())
        }
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, key))
      return
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, k)
    }
  }
  walk(input)
  return { commands, paths }
}

function normalisePath(path, cwd) {
  let forward = path.replace(/^file:\/+/i, '').replace(/\\/g, '/')
  const absolute = /^([a-z]:)?\//i.test(forward) || /^[a-z]:/i.test(forward)
  if (!absolute && cwd) {
    forward = `${cwd.replace(/\\/g, '/')}/${forward}`
  }
  const collapsed = posix.normalize(`/${forward.replace(/^\/+/, '')}`)
  return collapsed.toLowerCase()
}

function isSecretEnvFile(path) {
  const name = normalisePath(path).split('/').pop()
  return /^\.env(\.[\w.-]+)?$/.test(name) && !name.endsWith('.example')
}

function mentionsSecretEnv(command) {
  return command
    .split(/[\s'"`|;&<>()]+/)
    .filter(Boolean)
    .some((token) => isSecretEnvFile(token))
}

function classify(tool) {
  const name = tool.toLowerCase()
  if (/terminal|bash|powershell|shell|exec|command/.test(name))
    return 'terminal'
  if (/read|view|open|get_file|cat/.test(name)) return 'read'
  if (
    /push.?files|create|edit|replace|write|insert|patch|delete|rename|move|mkdir|directory/.test(
      name
    )
  )
    return 'edit'
  return 'other'
}

const SAFE_WRITE_TARGET =
  /^(\/dev\/(null|stdout|stderr)|\/tmp\/|\/var\/tmp\/|\/appdata\/local\/temp\/|\/windows\/temp\/|\/?nul$|\/?\$null$)/i

const unquote = (token) => token.replace(/^['"]|['"]$/g, '')

/**
 * Finds files a shell command writes to: redirections, tee, copy/move/set-content style commands and sed -i.
 * @param {string} command Command text.
 * @returns {string[]}
 */
export function writeTargets(command) {
  const targets = []
  const token = String.raw`("[^"]+"|'[^']+'|[^\s;&|<>()]+)`
  for (const m of command.matchAll(
    new RegExp(String.raw`(?<![<>&\d])\d?>>?\s*${token}`, 'g')
  )) {
    if (!m[1].startsWith('&')) targets.push(unquote(m[1]))
  }
  for (const m of command.matchAll(
    new RegExp(String.raw`\btee\s+(?:-\S+\s+)*${token}`, 'gi')
  )) {
    targets.push(unquote(m[1]))
  }
  const named = String.raw`(?:set-content|add-content|out-file|new-item|clear-content)\b[^\n;|&]*?(?:-(?:file)?path\s+|-literalpath\s+)?${token}`
  for (const m of command.matchAll(new RegExp(named, 'gi'))) {
    targets.push(unquote(m[1]))
  }
  for (const m of command.matchAll(
    new RegExp(
      String.raw`\b(?:cp|mv|copy-item|move-item|install|touch|mkdir|rm|remove-item)\b([^\n;|&]*)`,
      'gi'
    )
  )) {
    const args = m[1].match(new RegExp(token, 'g')) ?? []
    const operands = args.map(unquote).filter((a) => !a.startsWith('-'))
    const last = operands.at(-1)
    if (last) targets.push(last)
  }
  for (const m of command.matchAll(
    new RegExp(
      String.raw`\bsed\s+(?:-\S+\s+)*-i\S*\s+(?:-e\s+)?${token}\s+${token}`,
      'g'
    )
  )) {
    targets.push(unquote(m[2]))
  }
  return targets
}

function checkWrites(command, role, cwd) {
  for (const raw of writeTargets(command)) {
    const path = normalisePath(raw, cwd)
    if (SAFE_WRITE_TARGET.test(path)) continue
    const result = checkPath(raw, 'edit', role, cwd)
    if (result) return result
  }
  return null
}

function checkCommand(command, role, cwd) {
  const text = command.replace(/\\/g, '/')
  for (const [pattern, reason] of DENY_COMMANDS) {
    if (pattern.test(text)) return { decision: 'deny', reason }
  }
  if (STATE_PATH.test(text.toLowerCase()) && STATE_WRITE.test(text))
    return { decision: 'deny', reason: STATE_REASON }
  if (mentionsSecretEnv(text)) return { decision: 'deny', reason: ENV_REASON }
  return checkWrites(text, role, cwd)
}

function checkPath(raw, kind, role, cwd) {
  const path = normalisePath(raw, cwd)
  if (isSecretEnvFile(path)) return { decision: 'deny', reason: ENV_REASON }
  if (kind !== 'edit') return null
  if (STATE_PATH.test(path)) return { decision: 'deny', reason: STATE_REASON }
  if (!roleMayEdit(role, path)) {
    return {
      decision: 'deny',
      reason: `The ${role} agent may not edit ${raw}; hand the change to the right agent.`
    }
  }
  if (GUARD_PATH.test(path))
    return {
      decision: 'ask',
      reason:
        'Editing agent, hook or workspace settings: confirm with the user.'
    }
  return null
}

/**
 * Decides whether a tool call may run.
 * @param {object} event Parsed hook payload.
 * @param {string} [role] AIP agent role, used to restrict which paths it may edit.
 * @returns {{ decision: 'deny' | 'ask' | null, reason?: string }}
 */
export function decide(event, role) {
  const { tool, input } = readEvent(event)
  for (const [pattern, reason] of DENY_TOOLS) {
    if (pattern.test(tool)) return { decision: 'deny', reason }
  }
  const kind = classify(tool)
  const cwd = typeof event?.cwd === 'string' ? event.cwd : undefined
  const { commands, paths } = collectStrings(input)
  const found = [
    ...commands.map((command) => checkCommand(command, role, cwd)),
    ...paths.map((path) => checkPath(path, kind, role, cwd))
  ].filter(Boolean)
  const denied = found.find((result) => result.decision === 'deny')
  if (denied) return denied
  for (const [pattern, reason] of ASK_TOOLS) {
    if (pattern.test(tool)) return { decision: 'ask', reason }
  }
  for (const command of commands) {
    for (const [pattern, reason] of ASK_COMMANDS) {
      if (pattern.test(command)) return { decision: 'ask', reason }
    }
  }
  return found[0] ?? { decision: null }
}

/**
 * Builds hook output that both the Local and Copilot harnesses read.
 * @param {{ decision: string | null, reason?: string }} result Decision from `decide`.
 * @returns {object}
 */
export function toOutput(result) {
  if (!result.decision) return {}
  return {
    permissionDecision: result.decision,
    permissionDecisionReason: result.reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: result.decision,
      permissionDecisionReason: result.reason
    }
  }
}

function main() {
  const roleIndex = process.argv.indexOf('--role')
  const role = roleIndex > -1 ? process.argv[roleIndex + 1] : undefined
  let event
  try {
    event = JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    process.stdout.write('{}')
    return
  }
  const result = decide(event, role)
  process.stdout.write(JSON.stringify(toOutput(result)))
  if (result.decision === 'deny') {
    process.stderr.write(`AIP guard: ${result.reason}\n`)
    process.exitCode = 2
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) main()

#!/usr/bin/env node
// Validates this repository's agents, skills and prompts: frontmatter, cross-references, links and size.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUILT_IN_AGENTS = new Set(['Explore', 'agent', 'Plan', 'Ask'])
const MODEL = /^Claude (Opus|Sonnet|Haiku) [\d.]+ \(copilot\)$/
const MAX_SKILL_LINES = 200
const MAX_AGENT_LINES = 120
// Platform tool names that share the skill prefix.
const NOT_SKILLS = new Set(['aip-checks', 'aip-authorise', 'aip-guard'])

/**
 * Parses the simple YAML frontmatter used in customization files.
 * Scalars and inline arrays are parsed; indented blocks are kept as raw text.
 * @param {string} text File contents.
 * @returns {{ data: Record<string, unknown>, body: string } | null}
 */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!match) return null
  const data = {}
  let blockKey = null
  for (const line of match[1].split(/\r?\n/)) {
    const top = /^([\w-]+):\s*(.*)$/.exec(line)
    if (top) {
      const [, key, raw] = top
      blockKey = raw === '' ? key : null
      data[key] = raw === '' ? '' : parseScalar(raw)
    } else if (blockKey) {
      data[blockKey] += `${line}\n`
    }
  }
  // Prettier wraps long flow sequences (`agents: [...]`) over several lines.
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.trim().startsWith('['))
      data[key] = parseScalar(value.replaceAll(/\s*\n\s*/g, ' '))
  }
  return { data, body: match[2] }
}

function parseScalar(raw) {
  const value = raw.trim()
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter(Boolean)
  }
  if (value === 'true' || value === 'false') return value === 'true'
  return unquote(value)
}

function unquote(value) {
  return /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value
}

function listFiles(dir, suffix) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => join(dir, name))
}

function markdownFiles(dir) {
  const files = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (['node_modules', '.git', '.copilot-tracking'].includes(entry.name))
        continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.md')) files.push(full)
    }
  }
  walk(dir)
  return files
}

function checkLinks(root, file, errors) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const path = resolve(dirname(file), decodeURI(target.split('#')[0]))
    if (relative(root, path).startsWith('..')) continue
    if (!existsSync(path))
      errors.push(`${relative(root, file)}: broken link ${target}`)
  }
}

/**
 * Validates the repository and returns a list of problems.
 * @param {string} root Repository root.
 * @returns {string[]}
 */
export function validateRepo(root) {
  const errors = []
  const github = join(root, '.github')
  const agents = new Map()

  for (const file of listFiles(join(github, 'agents'), '.agent.md')) {
    const rel = relative(root, file)
    const parsed = parseFrontmatter(readFileSync(file, 'utf8'))
    if (!parsed) {
      errors.push(`${rel}: missing frontmatter`)
      continue
    }
    const { data, body } = parsed
    if (!data.name) errors.push(`${rel}: missing name`)
    if (!data.description) errors.push(`${rel}: missing description`)
    if (body.split('\n').length > MAX_AGENT_LINES)
      errors.push(`${rel}: body over ${MAX_AGENT_LINES} lines`)
    for (const model of [data.model].flat().filter(Boolean)) {
      if (!MODEL.test(model))
        errors.push(`${rel}: unexpected model name "${model}"`)
    }
    agents.set(data.name, { rel, data })
  }

  const agentExists = (name) => agents.has(name) || BUILT_IN_AGENTS.has(name)
  for (const { rel, data } of agents.values()) {
    for (const name of [data.agents].flat().filter(Boolean)) {
      if (!agentExists(name)) errors.push(`${rel}: unknown subagent "${name}"`)
    }
    const handoffs = typeof data.handoffs === 'string' ? data.handoffs : ''
    for (const [, name] of handoffs.matchAll(
      /agent:\s*['"]?([^'"\n]+?)['"]?\s*$/gm
    )) {
      if (!agentExists(name))
        errors.push(`${rel}: unknown handoff agent "${name}"`)
    }
    const hooks = typeof data.hooks === 'string' ? data.hooks : ''
    for (const [, script] of hooks.matchAll(
      /\.\.\/ai-platform-agents\/([^\s"']+)/g
    )) {
      if (!existsSync(join(root, script)))
        errors.push(`${rel}: hook script ${script} not found`)
    }
  }

  const skillsDir = join(github, 'skills')
  for (const name of existsSync(skillsDir) ? readdirSync(skillsDir) : []) {
    if (!statSync(join(skillsDir, name)).isDirectory()) continue
    const file = join(skillsDir, name, 'SKILL.md')
    const rel = relative(root, file)
    if (!existsSync(file)) {
      errors.push(`${rel}: missing`)
      continue
    }
    const parsed = parseFrontmatter(readFileSync(file, 'utf8'))
    if (!parsed) {
      errors.push(`${rel}: missing frontmatter`)
      continue
    }
    const { data, body } = parsed
    if (data.name !== name)
      errors.push(`${rel}: name "${data.name}" does not match folder`)
    if (!data.description) errors.push(`${rel}: missing description`)
    else if (data.description.length > 1024)
      errors.push(`${rel}: description over 1024 characters`)
    if (body.split('\n').length > MAX_SKILL_LINES)
      errors.push(`${rel}: body over ${MAX_SKILL_LINES} lines`)
  }

  for (const file of listFiles(join(github, 'prompts'), '.prompt.md')) {
    const parsed = parseFrontmatter(readFileSync(file, 'utf8'))
    const rel = relative(root, file)
    if (!parsed?.data.description) errors.push(`${rel}: missing description`)
    if (parsed?.data.agent && !agentExists(parsed.data.agent))
      errors.push(`${rel}: unknown agent "${parsed.data.agent}"`)
  }

  for (const file of markdownFiles(root)) checkLinks(root, file, errors)

  const skills = new Set(existsSync(skillsDir) ? readdirSync(skillsDir) : [])
  for (const file of markdownFiles(github)) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(
      /`(aip-[a-z-]+)`/g
    )) {
      if (!skills.has(name) && !NOT_SKILLS.has(name))
        errors.push(`${relative(root, file)}: unknown skill \`${name}\``)
    }
  }
  return errors
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const errors = validateRepo(root)
  for (const error of errors) process.stderr.write(`${error}\n`)
  process.stdout.write(
    errors.length ? `${errors.length} problem(s)\n` : 'Customizations valid\n'
  )
  process.exitCode = errors.length ? 1 : 0
}

#!/usr/bin/env node
// Lints commit and pull request text so a shell guard never misreads it: plain words, no shell metacharacters.
// The rule lives in .github/skills/aip-pull-request/SKILL.md ("Plain-text messages").
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_SUBJECT = 72
const ARROWS = ['->', '=>']
const CHARACTERS = [
  ['>', '>'],
  ['`', 'backtick'],
  ['$', 'dollar'],
  ['\\', 'backslash'],
  ['"', 'double quote'],
  ['|', 'pipe'],
  [';', 'semicolon'],
  ['&', 'ampersand']
]
// Commands a guard reads as a file write inside a quoted message (the writeTargets list in aip-guard.mjs).
const WRITE_WORDS = [
  'rm',
  'cp',
  'mv',
  'tee',
  'install',
  'touch',
  'mkdir',
  'set-content',
  'add-content',
  'clear-content',
  'out-file',
  'new-item',
  'copy-item',
  'move-item',
  'remove-item'
]
const WRITE_PATTERN = new RegExp(
  String.raw`\b((?:${WRITE_WORDS.join('|')})\b|sed\s+(?:-\S+\s+)*-i)`,
  'i'
)
// The one line allowed to hold angle brackets, and only around the email.
const TRAILER = /^(Co-authored-by: [^<>\n]+) <([^<>\s]+)>$/
const KINDS = ['commit', 'title', 'body']

function checkLine(line) {
  const found = []
  let rest = line
  for (const arrow of ARROWS) {
    if (rest.includes(arrow)) {
      found.push(`forbidden ${arrow} (write "to", "becomes" or "from X to Y")`)
      rest = rest.replaceAll(arrow, ' ')
    }
  }
  for (const [char, name] of CHARACTERS) {
    if (rest.includes(char)) found.push(`forbidden ${name} (${char})`)
  }
  const word = WRITE_PATTERN.exec(rest)
  if (word) found.push(`forbidden word ${word[1]} (write remove, copy or move)`)
  return found
}

/**
 * Checks commit or pull request text against the plain-text rule.
 * @param {string} text Commit message, PR title or PR body.
 * @param {{kind?: 'commit' | 'title' | 'body'}} [options] What the text is; the subject limit applies to a commit message or a title, not a body.
 * @returns {string[]} One readable problem per finding; empty when the text is plain.
 */
export function checkMessageText(text, { kind = 'commit' } = {}) {
  if (!KINDS.includes(kind))
    throw new RangeError(`kind must be one of ${KINDS.join(', ')}`)
  const problems = []
  const lines = text.split(/\r?\n/)
  if (kind !== 'body' && lines[0].length > MAX_SUBJECT)
    problems.push(
      `subject is ${lines[0].length} characters, over ${MAX_SUBJECT}`
    )
  lines.forEach((line, index) => {
    const trailer = TRAILER.exec(line)
    const checked = trailer ? `${trailer[1]} ${trailer[2]}` : line
    for (const problem of checkLine(checked))
      problems.push(`line ${index + 1}: ${problem}`)
  })
  return problems
}

function readKind(args) {
  const flag = args.indexOf('--kind')
  if (flag === -1) return { kind: 'commit', rest: args }
  return {
    kind: args[flag + 1],
    rest: args.filter((_, i) => i !== flag && i !== flag + 1)
  }
}

function readInput(args) {
  const fileFlag = args.indexOf('--file')
  if (fileFlag > -1) return readFileSync(args[fileFlag + 1], 'utf8')
  if (args.length) return args.join(' ')
  return readFileSync(0, 'utf8')
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) {
  const { kind, rest } = readKind(process.argv.slice(2))
  if (!KINDS.includes(kind)) {
    process.stderr.write(`--kind must be one of ${KINDS.join(', ')}\n`)
    process.exit(2)
  }
  const problems = checkMessageText(readInput(rest), { kind })
  for (const problem of problems) process.stderr.write(`${problem}\n`)
  process.stdout.write(problems.length ? '' : 'Message text is plain\n')
  process.exitCode = problems.length ? 1 : 0
}

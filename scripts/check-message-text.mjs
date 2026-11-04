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
// Words an older guard reads as a file write inside a quoted message.
const WRITE_WORDS =
  /\b(rm|cp|mv|tee|set-content|add-content|out-file|new-item|copy-item|move-item|remove-item)\b/i
// The one line allowed to hold angle brackets.
const TRAILER = /^Co-authored-by: [^<>\n]+ <[^<>\s]+>$/

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
  const word = WRITE_WORDS.exec(rest)
  if (word) found.push(`forbidden word ${word[1]} (write remove, copy or move)`)
  return found
}

/**
 * Checks commit or pull request text against the plain-text rule.
 * @param {string} text Commit message, PR title or PR body.
 * @returns {string[]} One readable problem per finding; empty when the text is plain.
 */
export function checkMessageText(text) {
  const problems = []
  const lines = text.split(/\r?\n/)
  if (lines[0].length > MAX_SUBJECT)
    problems.push(
      `subject is ${lines[0].length} characters, over ${MAX_SUBJECT}`
    )
  lines.forEach((line, index) => {
    if (TRAILER.test(line)) return
    for (const problem of checkLine(line))
      problems.push(`line ${index + 1}: ${problem}`)
  })
  return problems
}

function readInput(args) {
  const fileFlag = args.indexOf('--file')
  if (fileFlag > -1) return readFileSync(args[fileFlag + 1], 'utf8')
  if (args.length) return args.join(' ')
  return readFileSync(0, 'utf8')
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) {
  const problems = checkMessageText(readInput(process.argv.slice(2)))
  for (const problem of problems) process.stderr.write(`${problem}\n`)
  process.stdout.write(problems.length ? '' : 'Message text is plain\n')
  process.exitCode = problems.length ? 1 : 0
}

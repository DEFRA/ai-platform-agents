import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkMessageText } from '../scripts/check-message-text.mjs'

const script = fileURLToPath(
  new URL('../scripts/check-message-text.mjs', import.meta.url)
)
const TRAILER =
  'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>'

test('accepts plain British English text', () => {
  assert.deepEqual(
    checkMessageText('docs: write commit messages as plain text'),
    []
  )
  assert.deepEqual(
    checkMessageText(
      'fix: change the guard\n\nThe retry limit becomes 3, from 5. Tests pass (see run 12).'
    ),
    []
  )
})

test('flags each forbidden character with a readable name', () => {
  const cases = {
    '>': 'a > b',
    '->': 'a -> b',
    '=>': 'a => b',
    backtick: 'run `npm test`',
    dollar: 'cost $5',
    backslash: 'path C:\\x',
    'double quote': 'say "hello"',
    pipe: 'a | b',
    semicolon: 'a; b',
    ampersand: 'a & b'
  }
  for (const [name, text] of Object.entries(cases)) {
    const problems = checkMessageText(text).join('\n')
    assert.match(problems, new RegExp(`forbidden ${name}`), name)
  }
})

test('names an arrow once rather than as a bare greater-than sign', () => {
  assert.deepEqual(checkMessageText('a -> b'), [
    'line 1: forbidden -> (write "to", "becomes" or "from X to Y")'
  ])
})

test('flags the words the older guard reads as file writes', () => {
  for (const word of ['rm', 'cp', 'mv', 'tee', 'Set-Content', 'Out-File']) {
    assert.match(
      checkMessageText(`tidy ${word} wording`).join('\n'),
      /forbidden word/,
      word
    )
  }
  assert.deepEqual(checkMessageText('confirm the term and format'), [])
})

test('reports the line number and a subject over 72 characters', () => {
  assert.match(
    checkMessageText(`ok\n\nsecond; line`).join('\n'),
    /^line 3: forbidden semicolon/
  )
  const long = `docs: ${'a'.repeat(70)}`
  assert.match(
    checkMessageText(long).join('\n'),
    /subject is 76 characters, over 72/
  )
  assert.deepEqual(checkMessageText(`docs: ${'a'.repeat(66)}`), [])
  assert.deepEqual(
    checkMessageText(`docs: ${'a'.repeat(60)}\n${'b'.repeat(100)}`),
    []
  )
})

test('allows only the standard Co-authored-by trailer line', () => {
  assert.deepEqual(checkMessageText(`docs: tidy\n\nBody.\n\n${TRAILER}`), [])
  assert.notDeepEqual(checkMessageText('docs: tidy <x> y'), [])
  assert.notDeepEqual(checkMessageText(`docs: tidy ${TRAILER}`), [])
})

test('the CLI checks a file and standard input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aip-msg-'))
  const good = join(dir, 'good.txt')
  const bad = join(dir, 'bad.txt')
  writeFileSync(good, 'docs: plain text\n')
  writeFileSync(bad, 'docs: a -> b\n')

  const ok = spawnSync(process.execPath, [script, '--file', good], {
    encoding: 'utf8'
  })
  assert.equal(ok.status, 0)
  assert.match(ok.stdout, /Message text is plain/)

  const fail = spawnSync(process.execPath, [script, '--file', bad], {
    encoding: 'utf8'
  })
  assert.equal(fail.status, 1)
  assert.match(fail.stderr, /line 1: forbidden ->/)

  const piped = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    input: 'fix: use a pipe | here'
  })
  assert.equal(piped.status, 1)
  assert.match(piped.stderr, /forbidden pipe/)

  const inline = spawnSync(process.execPath, [script, 'docs: plain'], {
    encoding: 'utf8'
  })
  assert.equal(inline.status, 0)
})

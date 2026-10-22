import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseFrontmatter, validateRepo } from '../scripts/validate.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

test('parses scalars, inline arrays and blocks', () => {
  const parsed = parseFrontmatter(
    [
      '---',
      'name: AIP X',
      'description: "Use when: testing"',
      'agents: ["A B", Explore]',
      'flag: true',
      'handoffs:',
      '  - label: Go',
      '    agent: AIP Y',
      '---',
      'Body'
    ].join('\n')
  )
  assert.equal(parsed.data.name, 'AIP X')
  assert.equal(parsed.data.description, 'Use when: testing')
  assert.deepEqual(parsed.data.agents, ['A B', 'Explore'])
  assert.equal(parsed.data.flag, true)
  assert.match(parsed.data.handoffs, /agent: AIP Y/)
  assert.equal(parsed.body, 'Body')
  assert.equal(parseFrontmatter('no frontmatter'), null)
})

test('parses a flow sequence that Prettier wrapped over several lines', () => {
  const parsed = parseFrontmatter(
    [
      '---',
      'agents:',
      '  [',
      "    'AIP Planner',",
      "    'Explore'",
      '  ]',
      'tools: [read]',
      '---',
      ''
    ].join('\n')
  )
  assert.deepEqual(parsed.data.agents, ['AIP Planner', 'Explore'])
  assert.deepEqual(parsed.data.tools, ['read'])
})

test('every agent, skill and prompt in this repo is valid', () => {
  assert.deepEqual(validateRepo(root), [])
})

test('reports each kind of broken customization', () => {
  const bad = mkdtempSync(join(tmpdir(), 'aip-bad-'))
  const write = (path, text) => {
    mkdirSync(dirname(join(bad, path)), { recursive: true })
    writeFileSync(join(bad, path), text)
  }
  write('.github/agents/none.agent.md', 'no frontmatter')
  write(
    '.github/agents/x.agent.md',
    [
      '---',
      'name: X',
      'model: ["GPT Whatever"]',
      'agents: ["Ghost"]',
      'handoffs:',
      '  - label: Go',
      '    agent: Nobody',
      'hooks:',
      '  PreToolUse:',
      '    - command: "node ../ai-platform-agents/scripts/missing.mjs"',
      '---',
      `${'line\n'.repeat(130)}`
    ].join('\n')
  )
  write(
    '.github/skills/wrong/SKILL.md',
    '---\nname: other\n---\nBody uses `aip-ghost`.\n'
  )
  write(
    '.github/skills/long/SKILL.md',
    `---\nname: long\ndescription: "${'d'.repeat(1100)}"\n---\n${'x\n'.repeat(210)}`
  )
  write('.github/skills/bare/SKILL.md', 'no frontmatter')
  mkdirSync(join(bad, '.github/skills/empty'), { recursive: true })
  write(
    '.github/prompts/p.prompt.md',
    '---\nagent: Nobody\n---\nSee [missing](./missing.md).\n'
  )

  const errors = validateRepo(bad).join('\n')
  for (const expected of [
    /none\.agent\.md: missing frontmatter/,
    /x\.agent\.md: missing description/,
    /x\.agent\.md: body over 120 lines/,
    /unexpected model name "GPT Whatever"/,
    /unknown subagent "Ghost"/,
    /unknown handoff agent "Nobody"/,
    /hook script scripts\/missing\.mjs not found/,
    /wrong[\\/]SKILL\.md: name "other" does not match folder/,
    /wrong[\\/]SKILL\.md: missing description/,
    /long[\\/]SKILL\.md: description over 1024 characters/,
    /long[\\/]SKILL\.md: body over 200 lines/,
    /bare[\\/]SKILL\.md: missing frontmatter/,
    /empty[\\/]SKILL\.md: missing/,
    /p\.prompt\.md: missing description/,
    /p\.prompt\.md: unknown agent "Nobody"/,
    /p\.prompt\.md: broken link \.\/missing\.md/,
    /unknown skill `aip-ghost`/
  ]) {
    assert.match(errors, expected)
  }
})

test('the CLI reports this repo as valid', () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../scripts/validate.mjs', import.meta.url))],
    {
      encoding: 'utf8'
    }
  )
  assert.equal(result.status, 0)
  assert.match(result.stdout, /Customizations valid/)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runGates } from '../.github/skills/aip-quality-gates/scripts/run-gates.mjs'

const LCOV = [
  'SF:src/a.js',
  'FNF:1',
  'FNH:1',
  'LF:10',
  'LH:5',
  'BRF:0',
  'BRH:0',
  'end_of_record'
].join('\n')

function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'aip-repo-'))
  const pkg = {
    name: 'fake',
    scripts: {
      'format:check': 'node -e "process.exit(0)"',
      lint: 'node -e "console.log(\'lint broke\');process.exit(1)"',
      test: 'node write-lcov.mjs'
    },
    devDependencies: { loose: '^1.0.0' }
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
  writeFileSync(
    join(root, 'write-lcov.mjs'),
    `import { mkdirSync, writeFileSync } from 'node:fs'\nmkdirSync('coverage', { recursive: true })\nwriteFileSync('coverage/lcov.info', ${JSON.stringify(LCOV)})\n`
  )
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true })
  writeFileSync(
    join(root, '.github', 'workflows', 'ci.yml'),
    'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v7\n'
  )
  const git = (args) => execSync(`git ${args}`, { cwd: root, stdio: 'ignore' })
  git('init -q')
  git('add .')
  git('-c user.name=t -c user.email=t@example.com commit -q -m init')
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'a.js'), 'export const a = 1\n')
  return root
}

test('ignores coverage the tests did not write in this run, and passes when every gate passes', () => {
  const root = mkdtempSync(join(tmpdir(), 'aip-clean-'))
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'clean',
      scripts: { test: 'node -e "process.exit(0)"' },
      dependencies: { x: '1.0.0' }
    })
  )
  writeFileSync(join(root, 'package-lock.json'), '{}')
  mkdirSync(join(root, 'coverage'))
  writeFileSync(join(root, 'coverage', 'lcov.info'), LCOV)
  const old = new Date('2020-01-01')
  utimesSync(join(root, 'coverage', 'lcov.info'), old, old)

  const quick = runGates([
    '--repo',
    root,
    '--quick',
    '--base',
    'HEAD',
    '--out',
    join(root, 'gates-out')
  ])
  assert.match(quick.output, /COVERAGE ignored stale coverage\/lcov\.info/)
  assert.match(quick.output, /RESULT PASS/)
  assert.equal(quick.exitCode, 0)

  const plan = runGates([
    '--repo',
    root,
    '--full',
    '--base',
    'HEAD',
    '--dry-run'
  ]).output
  assert.match(plan, /^audit-high: npm audit --audit-level=high$/m)
  assert.match(plan, /^snyk-sca: snyk test --severity-threshold=high$/m)
  assert.match(plan, /^snyk-code: snyk code test --severity-threshold=high$/m)
})

test('runs quick gates on a real repo: pins, failures, coverage and changed files', () => {
  const root = fakeRepo()
  const out = join(root, 'gates-out')
  const { output, exitCode } = runGates([
    '--repo',
    root,
    '--quick',
    '--base',
    'HEAD',
    '--out',
    out
  ])
  assert.equal(exitCode, 1)
  assert.match(output, /FAIL pins/)
  assert.match(output, /PASS format/)
  assert.match(output, /FAIL lint .*log:/)
  assert.match(output, /\| lint broke/)
  assert.match(output, /PASS test/)
  assert.match(
    output,
    /COVERAGE repo lines 50 \| branches n\/a \| functions 100 {2}\(below target: lines 50 < 90\)/
  )
  assert.match(output, /changed file below target: src\/a\.js lines 50 < 90/)
  assert.match(output, /RESULT FAIL \(2 failed/)
})

test('full gates add advisory and tool-dependent checks without failing on missing tools', () => {
  const root = fakeRepo()
  const { output } = runGates([
    '--repo',
    root,
    '--full',
    '--base',
    'HEAD',
    '--out',
    join(root, 'gates-out')
  ])
  assert.match(output, /WARN action-pins/)
  assert.match(output, /(SKIP|PASS|FAIL) secrets/)
})

test('dry run lists the plan without running it', () => {
  const root = fakeRepo()
  const { output, exitCode } = runGates([
    '--repo',
    root,
    '--full',
    '--base',
    'HEAD',
    '--dry-run'
  ])
  assert.equal(exitCode, 0)
  assert.match(output, /^pins: built-in check$/m)
  assert.match(output, /^lint: npm run lint$/m)
  assert.match(output, /^action-pins: built-in check$/m)
})

test('refuses an unsafe base ref', () => {
  assert.throws(
    () => runGates(['--repo', '.', '--base', 'main;rm -rf /']),
    /Unsafe --base/
  )
})

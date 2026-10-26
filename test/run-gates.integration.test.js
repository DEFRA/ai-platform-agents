import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

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

test('ignores coverage the tests did not write in this run, and fails when coverage is required', () => {
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
  assert.match(quick.output, /COVERAGE missing: no fresh lcov\.info/)
  assert.match(quick.output, /RESULT FAIL .*1 coverage misses/)
  assert.equal(quick.exitCode, 1)

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

test('passes with no coverage report when the repo runs no unit tests', () => {
  const root = mkdtempSync(join(tmpdir(), 'aip-notests-'))
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'none', scripts: {}, dependencies: { x: '1.0.0' } })
  )
  const { output, exitCode } = runGates([
    '--repo',
    root,
    '--quick',
    '--base',
    'HEAD',
    '--out',
    join(root, 'gates-out')
  ])
  assert.match(output, /COVERAGE not measured/)
  assert.equal(exitCode, 0)
})

test('blocks changed-file coverage and the secrets scan when the base cannot be resolved', () => {
  const root = fakeRepo()
  const fakeBin = installFakeGitleaks()
  const { output, exitCode } = runGates([
    '--repo',
    root,
    '--full',
    '--base',
    'origin/mian',
    '--out',
    join(root, 'gates-out')
  ])
  assert.equal(exitCode, 1)
  assert.match(
    output,
    /changed-file coverage blocked: comparison base not resolved/
  )
  assert.match(output, /FAIL secrets/)
  assert.match(output, /comparison base not resolved/)
  restorePath(fakeBin)
})

function installFakeGitleaks() {
  const dir = mkdtempSync(join(tmpdir(), 'aip-bin-'))
  const script = [
    "if (process.argv.includes('--version')) process.exit(0)",
    "let text = ''",
    "process.stdin.on('data', (chunk) => (text += chunk))",
    "process.stdin.on('end', () => {",
    "  if (text.includes('SYNTHETIC_SECRET_VALUE')) {",
    "    console.log('leaks found: REDACTED')",
    '    process.exit(1)',
    '  }',
    '})'
  ].join('\n')
  writeFileSync(join(dir, 'gitleaks.mjs'), script)
  writeFileSync(
    join(dir, 'gitleaks'),
    `#!/bin/sh\nexec node "${join(dir, 'gitleaks.mjs')}" "$@"\n`
  )
  chmodSync(join(dir, 'gitleaks'), 0o755)
  writeFileSync(
    join(dir, 'gitleaks.cmd'),
    `@node "${join(dir, 'gitleaks.mjs')}" %*\r\n`
  )
  const previous = process.env.PATH
  process.env.PATH = `${dir}${delimiter}${previous}`
  return previous
}

function restorePath(previous) {
  process.env.PATH = previous
}

test('the secrets scan reads untracked files without staging them, and passes a clean tree', () => {
  const previous = installFakeGitleaks()
  try {
    const root = fakeRepo()
    const options = ['--repo', root, '--full', '--base', 'HEAD', '--out']
    const clean = runGates([...options, join(root, 'out-clean')])
    assert.match(clean.output, /PASS secrets/)

    writeFileSync(
      join(root, 'src', 'config.js'),
      "export const token = 'SYNTHETIC_SECRET_VALUE'\n"
    )
    const leaky = runGates([...options, join(root, 'out-leaky')])
    assert.match(leaky.output, /FAIL secrets/)
    assert.match(leaky.output, /leaks found: REDACTED/)
    assert.doesNotMatch(leaky.output, /SYNTHETIC_SECRET_VALUE/)
    const staged = execSync('git diff --cached --name-only', {
      cwd: root,
      encoding: 'utf8'
    })
    assert.equal(staged.trim(), '')
  } finally {
    restorePath(previous)
  }
})

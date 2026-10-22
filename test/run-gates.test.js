import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  belowTarget,
  findTerraformTestDirs,
  findUnpinnedActions,
  findUnpinnedDependencies,
  normaliseRoot,
  parseGitHubRemote,
  parseLcov,
  planGates,
  resultFor,
  splitEnvPrefix,
  summarise
} from '../.github/skills/aip-quality-gates/scripts/run-gates.mjs'

test('splits Unix env prefixes from npm scripts', () => {
  assert.deepEqual(
    splitEnvPrefix('AWS_EMF_ENVIRONMENT=Local TZ=UTC vitest run --coverage'),
    {
      env: { AWS_EMF_ENVIRONMENT: 'Local', TZ: 'UTC' },
      command: 'vitest run --coverage'
    }
  )
  assert.deepEqual(splitEnvPrefix('vitest run'), {
    env: {},
    command: 'vitest run'
  })
  assert.deepEqual(splitEnvPrefix('npm run build && node --test'), {
    env: {},
    command: 'npm run build && node --test'
  })
})

test('parses lcov totals and per-file percentages', () => {
  const lcov = [
    'TN:',
    'SF:src/a.js',
    'FNF:2',
    'FNH:2',
    'LF:10',
    'LH:9',
    'BRF:4',
    'BRH:2',
    'end_of_record',
    'SF:src\\b.js',
    'FNF:0',
    'FNH:0',
    'LF:10',
    'LH:10',
    'BRF:0',
    'BRH:0',
    'end_of_record'
  ].join('\n')
  const { total, files } = parseLcov(lcov)
  assert.deepEqual(total, { lines: 95, branches: 50, functions: 100 })
  assert.deepEqual(files['src/a.js'], {
    lines: 90,
    branches: 50,
    functions: 100
  })
  assert.deepEqual(files['src/b.js'], {
    lines: 100,
    branches: null,
    functions: null
  })
})

test('reports metrics under their targets and ignores unmeasured ones', () => {
  assert.deepEqual(
    belowTarget({ lines: 89.9, branches: null, functions: 90 }),
    ['lines 89.9 < 90']
  )
  assert.deepEqual(
    belowTarget({ lines: 100, branches: 85, functions: 100 }),
    []
  )
  assert.deepEqual(
    belowTarget({ lines: 100, branches: 84.9, functions: 100 }),
    ['branches 84.9 < 85']
  )
})

test('finds Terraform folders with tftest files and skips tooling folders', () => {
  const root = mkdtempSync(join(tmpdir(), 'aip-tf-'))
  for (const dir of [
    'modules/naming/tests',
    'platform/tests',
    'checks/tests',
    'node_modules/x/tests',
    'tests-only/tests'
  ]) {
    mkdirSync(join(root, dir), { recursive: true })
  }
  writeFileSync(join(root, 'modules/naming/tests/a.tftest.hcl'), '')
  writeFileSync(join(root, 'platform/tests/b.tftest.hcl'), '')
  writeFileSync(join(root, 'checks/tests/c.tftest.hcl'), '')
  writeFileSync(join(root, 'node_modules/x/tests/d.tftest.hcl'), '')
  writeFileSync(join(root, 'tests-only/tests/e.test.js'), '')
  assert.deepEqual(findTerraformTestDirs(root), ['modules/naming', 'platform'])
})

const node = {
  root: 'r',
  scripts: {
    'format:check': 'x',
    lint: 'x',
    test: 'TZ=UTC vitest run --coverage',
    'security-audit': 'x'
  },
  terraform: false,
  terraformRoots: [],
  terraformTests: [],
  checks: false,
  workflows: true,
  workflowFiles: ['.github/workflows/check.yml'],
  packageFiles: ['package.json'],
  github: { owner: 'DEFRA', repo: 'x' },
  shellScripts: []
}

test('quick gates run format, lint and tests with the env prefix split out', () => {
  const steps = planGates(node, 'quick', 'abc123')
  assert.deepEqual(
    steps.map((step) => step.id),
    ['pins', 'format', 'lint', 'test']
  )
  assert.equal(steps[3].command, 'npx vitest run --coverage')
  assert.deepEqual(steps[3].env, { TZ: 'UTC' })
})

test('full gates add audit, scans and linters; the secrets scan uses the base', () => {
  const ids = planGates(node, 'full', 'abc123').map((step) => step.id)
  for (const id of [
    'ghas-code-scanning',
    'ghas-dependabot',
    'ghas-secret-scanning',
    'audit',
    'secrets',
    'action-pins',
    'actionlint'
  ]) {
    assert.ok(ids.includes(id), id)
  }
  const dependabot = planGates(node, 'full', 'abc123').find(
    (step) => step.id === 'ghas-dependabot'
  )
  assert.match(
    dependabot.command,
    /repos\/DEFRA\/x\/dependabot\/alerts\?state=open/
  )
  const secrets = planGates(node, 'full', 'abc123').find(
    (step) => step.id === 'secrets'
  )
  assert.match(
    secrets.command,
    /git diff abc123 \| gitleaks stdin --no-banner --redact/
  )
})

test('Terraform and checks steps are planned for infra', () => {
  const infra = {
    ...node,
    scripts: {},
    terraform: true,
    terraformRoots: ['platform'],
    terraformTests: ['modules/naming'],
    checks: true,
    workflows: false,
    shellScripts: ['scripts/a.sh']
  }
  const ids = planGates(infra, 'full', 'b').map((step) => step.id)
  for (const id of [
    'checks-lint',
    'checks-test',
    'checks-audit',
    'tf-fmt',
    'tf-validate-platform',
    'tf-test-modules-naming',
    'checkov',
    'snyk-iac',
    'shellcheck'
  ]) {
    assert.ok(ids.includes(id), id)
  }
})

test('journey test suites are reported as skipped, not run', () => {
  const journey = {
    ...node,
    packageFiles: [],
    scripts: { test: 'npm run clean && wdio run wdio.conf.js' }
  }
  const steps = planGates(journey, 'quick', 'b')
  assert.deepEqual(steps, [
    { id: 'journey', skip: 'needs a running frontend: npm run test:local' }
  ])
})

test('upper-cases a Windows drive letter so Vitest loads once', () => {
  if (process.platform === 'win32') {
    assert.match(normaliseRoot('c:\\repos\\x'), /^C:\\repos\\x$/)
  } else {
    assert.equal(normaliseRoot('/repos/x'), '/repos/x')
  }
})

test('flags dependencies that are not exact-pinned', () => {
  const pkg = {
    dependencies: { a: '1.2.3', b: '^1.0.0', c: 'npm:x@2.0.0' },
    devDependencies: { d: '~2.1.0', e: '1.0.0-beta.1', f: 'file:../f', g: '*' },
    peerDependencies: { h: '>=1' }
  }
  assert.deepEqual(findUnpinnedDependencies(pkg), [
    'b@^1.0.0',
    'd@~2.1.0',
    'g@*'
  ])
  assert.deepEqual(findUnpinnedDependencies({}), [])
})

test('flags Actions not pinned to a full commit SHA', () => {
  const yaml = [
    'steps:',
    '  - uses: actions/checkout@v7',
    '  - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0',
    '  - uses: ./.github/actions/gitops',
    '  - uses: docker://rhysd/actionlint:1.7.12',
    "    uses: 'DEFRA/ai-platform-workflows/.github/workflows/apply-state.yml@v1'",
    '  - uses: owner/no-ref'
  ].join('\n')
  assert.deepEqual(findUnpinnedActions(yaml), [
    'actions/checkout@v7',
    'DEFRA/ai-platform-workflows/.github/workflows/apply-state.yml@v1',
    'owner/no-ref'
  ])
})

test('reads owner and repo from GitHub remotes', () => {
  assert.deepEqual(
    parseGitHubRemote('https://github.com/DEFRA/ai-platform-agents.git\n'),
    {
      owner: 'DEFRA',
      repo: 'ai-platform-agents'
    }
  )
  assert.deepEqual(
    parseGitHubRemote('git@github.com:DEFRA/ai-platform-infra'),
    { owner: 'DEFRA', repo: 'ai-platform-infra' }
  )
  assert.equal(parseGitHubRemote('https://dev.azure.com/x/y'), null)
})

test('maps exit codes to results', () => {
  assert.equal(resultFor({ count: true }, 0, '0\n'), 'PASS')
  assert.equal(resultFor({ count: true }, 0, '3\n'), 'WARN')
  assert.equal(resultFor({ count: true }, 1, ''), 'SKIP')
  assert.equal(resultFor({}, 0), 'PASS')
  assert.equal(resultFor({}, 1), 'FAIL')
  assert.equal(resultFor({ advisory: true }, 1), 'WARN')
  assert.equal(resultFor({ snyk: true }, 1), 'FAIL')
  assert.equal(resultFor({ snyk: true }, 2), 'SKIP')
  assert.equal(resultFor({ snyk: true }, 3), 'SKIP')
})

test('summary fails on a failed step or a coverage miss', () => {
  const pass = summarise(
    'repo',
    'quick',
    [{ id: 'lint', result: 'PASS', seconds: 1 }],
    ['COVERAGE ok'],
    0
  )
  assert.match(pass, /RESULT PASS/)
  const fail = summarise(
    'repo',
    'quick',
    [{ id: 'test', result: 'FAIL', seconds: 1, tail: ['boom'] }],
    [],
    0
  )
  assert.match(fail, /RESULT FAIL \(1 failed/)
  assert.match(fail, /\| boom/)
  const coverage = summarise('repo', 'quick', [], [], 2)
  assert.match(coverage, /RESULT FAIL .*2 coverage misses/)
})

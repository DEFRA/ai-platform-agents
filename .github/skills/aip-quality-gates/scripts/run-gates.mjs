#!/usr/bin/env node
// Runs one repository's local quality gates and prints a compact summary. Full logs go to --out.
// Usage: node run-gates.mjs --repo <path> [--quick|--full] [--base origin/main] [--out <dir>] [--dry-run]
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Defra: at least 90 percent; branches 85 as in ai-platform-workflows' vitest thresholds.
export const COVERAGE_TARGETS = { lines: 90, functions: 90, branches: 85 }
const STEP_TIMEOUT_MS = 20 * 60 * 1000
const TAIL_LINES = 25
const SKIP_DIRS = new Set([
  'node_modules',
  '.terraform',
  '.git',
  'coverage',
  'dist',
  'checks'
])
const TERRAFORM_ROOTS = ['platform', 'tenants', 'bootstrap', 'names']

const toPosix = (path) => path.replaceAll('\\', '/')
const byName = (a, b) => a.localeCompare(b)

/**
 * Splits leading `NAME=value` assignments off an npm script, so it runs on Windows shells too.
 * @param {string} script npm script text.
 * @returns {{ env: Record<string, string>, command: string }}
 */
export function splitEnvPrefix(script) {
  const env = {}
  let rest = script.trim()
  let match = /^([A-Z_][A-Z0-9_]*)=(\S+)\s+/.exec(rest)
  while (match) {
    env[match[1]] = match[2]
    rest = rest.slice(match[0].length)
    match = /^([A-Z_][A-Z0-9_]*)=(\S+)\s+/.exec(rest)
  }
  return { env, command: rest }
}

function percent(hit, found) {
  return found === 0 ? null : Math.round((hit / found) * 1000) / 10
}

function toRecord(counts) {
  return {
    lines: percent(counts.LH, counts.LF),
    branches: percent(counts.BRH, counts.BRF),
    functions: percent(counts.FNH, counts.FNF)
  }
}

const emptyCounts = () => ({ LF: 0, LH: 0, BRF: 0, BRH: 0, FNF: 0, FNH: 0 })

/**
 * Parses lcov text into total and per-file percentages for lines, branches and functions.
 * @param {string} text lcov.info contents.
 * @returns {{ total: object, files: Record<string, object> }}
 */
export function parseLcov(text) {
  const totals = emptyCounts()
  const files = {}
  let file = null
  let counts = null
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      file = toPosix(line.slice(3))
      counts = emptyCounts()
      continue
    }
    if (line === 'end_of_record' && file) {
      files[file] = toRecord(counts)
      file = null
      continue
    }
    const [key, value] = line.split(':')
    if (counts && key in totals) {
      totals[key] += Number(value)
      counts[key] += Number(value)
    }
  }
  return { total: toRecord(totals), files }
}

/**
 * Lists the metrics below their targets, for one coverage record.
 * @param {object} record `{ lines, branches, functions }` percentages (null when not measured).
 * @param {object} [targets] Minimum percentage per metric.
 * @returns {string[]}
 */
export function belowTarget(record, targets = COVERAGE_TARGETS) {
  return Object.entries(record)
    .filter(([metric, value]) => value !== null && value < targets[metric])
    .map(([metric, value]) => `${metric} ${value} < ${targets[metric]}`)
}

/**
 * Finds Terraform folders with a `tests/` folder holding `.tftest.hcl` files.
 * @param {string} root Repository root.
 * @returns {string[]} Folders relative to root, forward slashes.
 */
export function findTerraformTestDirs(root) {
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (
        entry.name === 'tests' &&
        readdirSync(full).some((name) => name.endsWith('.tftest.hcl'))
      ) {
        found.push(toPosix(relative(root, dir)) || '.')
      } else {
        walk(full)
      }
    }
  }
  walk(root)
  return found.sort(byName)
}

function nodeSteps(repo) {
  const { root, scripts } = repo
  const steps = []
  if (scripts['format:check'])
    steps.push({ id: 'format', command: 'npm run format:check', cwd: root })
  if (scripts.lint)
    steps.push({ id: 'lint', command: 'npm run lint', cwd: root })
  if (scripts.test && /\bwdio\b/.test(scripts.test)) {
    steps.push({
      id: 'journey',
      skip: 'needs a running frontend: npm run test:local'
    })
  } else if (scripts.test) {
    const { env, command } = splitEnvPrefix(scripts.test)
    const prefixed = Object.keys(env).length > 0
    steps.push(
      prefixed
        ? { id: 'test', command: `npx ${command}`, cwd: root, env }
        : { id: 'test', command: 'npm run test', cwd: root }
    )
  }
  if (repo.checks) {
    const cwd = join(root, 'checks')
    steps.push(
      { id: 'checks-lint', command: 'npm run lint', cwd },
      { id: 'checks-test', command: 'npm test', cwd }
    )
  }
  return steps
}

function terraformSteps(repo) {
  if (!repo.terraform) return []
  const tf = (id, command) => ({
    id,
    command,
    cwd: repo.root,
    tool: 'terraform'
  })
  return [
    tf('tf-fmt', 'terraform fmt -check -recursive'),
    ...repo.terraformRoots.map((dir) =>
      tf(
        `tf-validate-${dir}`,
        `terraform -chdir="${dir}" init -backend=false -input=false -lockfile=readonly && terraform -chdir="${dir}" validate`
      )
    ),
    ...repo.terraformTests.map((dir) =>
      tf(
        `tf-test-${dir.replaceAll('/', '-')}`,
        `terraform -chdir="${dir}" init -backend=false -input=false && terraform -chdir="${dir}" test`
      )
    )
  ]
}

function securitySteps(repo, base) {
  const { root } = repo
  const steps = [...ghasSteps(repo)]
  if (repo.scripts['security-audit'])
    steps.push({ id: 'audit', command: 'npm run security-audit', cwd: root })
  if (repo.checks) {
    steps.push({
      id: 'checks-audit',
      command: 'npm audit --audit-level=moderate',
      cwd: join(root, 'checks')
    })
  }
  if (existsSync(join(root, 'package-lock.json'))) {
    steps.push(
      {
        id: 'audit-high',
        command: 'npm audit --audit-level=high',
        cwd: root,
        advisory: true
      },
      {
        id: 'snyk-sca',
        command: 'snyk test --severity-threshold=high',
        cwd: root,
        tool: 'snyk',
        snyk: true
      },
      {
        id: 'snyk-code',
        command: 'snyk code test --severity-threshold=high',
        cwd: root,
        tool: 'snyk',
        snyk: true
      }
    )
  }
  steps.push({
    id: 'secrets',
    builtin: () => secretsScan(root, base),
    tool: 'gitleaks'
  })
  return steps
}

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/
const LOCAL_SPEC = /^(?:file|link|workspace):/
const SHA = /^[0-9a-f]{40}$/

function isExactVersion(version) {
  return (
    LOCAL_SPEC.test(version) || SEMVER.test(version.replace(/^npm:[^@]+@/, ''))
  )
}

/**
 * Lists dependencies not pinned to an exact version (Defra Node standard: no `^` or `~`).
 * @param {object} pkg Parsed package.json.
 * @returns {string[]} `name@range` entries.
 */
export function findUnpinnedDependencies(pkg) {
  return ['dependencies', 'devDependencies', 'optionalDependencies'].flatMap(
    (field) =>
      Object.entries(pkg[field] ?? {})
        .filter(([, version]) => !isExactVersion(version))
        .map(([name, version]) => `${name}@${version}`)
  )
}

/**
 * Lists `uses:` references not pinned to a full commit SHA (Defra CI standard), ignoring local and docker actions.
 * @param {string} text Workflow or action YAML.
 * @returns {string[]}
 */
export function findUnpinnedActions(text) {
  const refs = []
  for (const line of text.split('\n')) {
    const entry = line.trim().replace(/^- /, '')
    if (!entry.startsWith('uses:')) continue
    const ref = entry.slice(5).split('#')[0].trim().replaceAll(/['"]/g, '')
    if (ref.startsWith('./') || ref.startsWith('docker://')) continue
    const at = ref.lastIndexOf('@')
    if (at === -1 || !SHA.test(ref.slice(at + 1))) refs.push(ref)
  }
  return refs
}

/**
 * Reads `owner/repo` from a GitHub remote URL.
 * @param {string} url `git remote get-url origin` output.
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseGitHubRemote(url) {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\s*$/.exec(
    url ?? ''
  )
  return match ? { owner: match[1], repo: match[2] } : null
}

function pinsCheck(root, packageFiles) {
  const loose = packageFiles.flatMap((file) =>
    findUnpinnedDependencies(
      JSON.parse(readFileSync(join(root, file), 'utf8'))
    ).map((dep) => `${file}: ${dep}`)
  )
  return {
    status: loose.length ? 1 : 0,
    output: loose.length
      ? `Not exact-pinned:\n${loose.join('\n')}`
      : 'All exact'
  }
}

function actionPinsCheck(root, files) {
  const loose = files.flatMap((file) =>
    findUnpinnedActions(readFileSync(join(root, file), 'utf8')).map(
      (ref) => `${file}: ${ref}`
    )
  )
  return {
    status: loose.length ? 1 : 0,
    output: loose.length
      ? `Not SHA-pinned (${loose.length}):\n${loose.join('\n')}`
      : 'All SHA-pinned'
  }
}

function ghasSteps(repo) {
  if (!repo.github) return []
  const { owner, repo: name } = repo.github
  const alerts = (kind) => ({
    id: `ghas-${kind}`,
    command: `gh api "repos/${owner}/${name}/${kind}/alerts?state=open&per_page=100" --jq length`,
    cwd: repo.root,
    tool: 'gh',
    count: true
  })
  return [
    alerts('code-scanning'),
    alerts('dependabot'),
    alerts('secret-scanning')
  ]
}

function lintSteps(repo) {
  const { root } = repo
  const steps = []
  if (repo.workflowFiles?.length) {
    steps.push({
      id: 'action-pins',
      advisory: true,
      builtin: () => actionPinsCheck(root, repo.workflowFiles)
    })
  }
  if (repo.terraform) {
    const config = join(root, '.tflint.hcl')
    if (existsSync(config)) {
      const tflint = `tflint --init --config "${config}" && tflint --recursive --config "${config}"`
      steps.push({ id: 'tflint', command: tflint, cwd: root, tool: 'tflint' })
    }
    steps.push(
      {
        id: 'checkov',
        command: 'checkov -d . --framework terraform --quiet --compact',
        cwd: root,
        tool: 'checkov',
        advisory: true
      },
      {
        id: 'snyk-iac',
        command: 'snyk iac test --severity-threshold=high',
        cwd: root,
        tool: 'snyk',
        snyk: true
      }
    )
  }
  if (repo.workflows)
    steps.push({
      id: 'actionlint',
      command: 'actionlint',
      cwd: root,
      tool: 'actionlint'
    })
  if (repo.shellScripts.length) {
    const files = repo.shellScripts
      .map((file) => JSON.stringify(file))
      .join(' ')
    steps.push({
      id: 'shellcheck',
      command: `shellcheck ${files}`,
      cwd: root,
      tool: 'shellcheck'
    })
  }
  return steps
}

/**
 * Plans the gate steps for a repository.
 * @param {object} repo `{ root, scripts, terraform, terraformRoots, terraformTests, workflows, shellScripts, checks }`.
 * @param {'quick' | 'full'} mode Quick runs format, lint and tests; full adds audit, scans and linters.
 * @param {string} base Git ref the change is compared with.
 * @returns {Array<{ id: string, command?: string, cwd?: string, env?: object, tool?: string, advisory?: boolean, snyk?: boolean, skip?: string }>}
 */
export function planGates(repo, mode, base) {
  const pins = repo.packageFiles?.length
    ? [{ id: 'pins', builtin: () => pinsCheck(repo.root, repo.packageFiles) }]
    : []
  const quick = [...pins, ...nodeSteps(repo), ...terraformSteps(repo)]
  return mode === 'full'
    ? [...quick, ...securitySteps(repo, base), ...lintSteps(repo)]
    : quick
}

/**
 * Maps a step's exit code to a result.
 * @param {object} step Planned step.
 * @param {number | null} status Exit code (Snyk: 2 failure such as no auth, 3 nothing to scan).
 * @param {string} [stdout] Standard output, for alert-count steps.
 * @returns {'PASS' | 'FAIL' | 'WARN' | 'SKIP'}
 */
export function resultFor(step, status, stdout = '') {
  if (step.count) {
    if (status !== 0) return 'SKIP'
    return Number(stdout.trim()) > 0 ? 'WARN' : 'PASS'
  }
  if (status === 0) return 'PASS'
  if (step.snyk && (status === 2 || status === 3)) return 'SKIP'
  return step.advisory ? 'WARN' : 'FAIL'
}

function run(command, cwd, env) {
  const result = spawnSync(command, {
    cwd,
    env: { ...process.env, ...env, FORCE_COLOR: '0', NO_COLOR: '1' },
    shell: true,
    encoding: 'utf8',
    timeout: STEP_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024
  })
  const stdout = result.stdout ?? ''
  const combined = `${stdout}${result.stderr ?? ''}`.replaceAll(
    /\x1b\[[0-9;]*m/g,
    ''
  )
  const output = result.error
    ? `${result.error.message}\n${combined}`
    : combined
  return { status: result.error ? 1 : result.status, stdout, output }
}

function toolAvailable(tool, cache) {
  if (!(tool in cache))
    cache[tool] = run(`${tool} --version`, process.cwd()).status === 0
  return cache[tool]
}

// Returns null when the ref cannot be resolved, so dependent checks are blocked rather than passed.
function mergeBase(root, ref) {
  const found = run(`git merge-base ${ref} HEAD`, root)
  if (found.status === 0 && found.stdout.trim()) return found.stdout.trim()
  return run(`git rev-parse --verify --quiet ${ref}`, root).status === 0
    ? ref
    : null
}

const BASE_BLOCKED =
  'comparison base not resolved (check --base and fetch history)'

// Scans tracked changes and non-ignored untracked files, without staging anything. Output stays redacted.
function secretsScan(root, base) {
  if (!base) return { status: 1, stdout: '', output: BASE_BLOCKED }
  const diff = run(`git diff ${base}`, root)
  if (diff.status !== 0) return { status: 1, stdout: '', output: diff.output }
  const listed = spawnSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  if (listed.status !== 0)
    return { status: 1, stdout: '', output: listed.stderr ?? '' }
  const untracked = listed.stdout.split('\0').filter(Boolean)
  const added = untracked.map(
    (file) =>
      spawnSync('git', ['diff', '--no-index', '--', '/dev/null', file], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      }).stdout ?? ''
  )
  const scan = spawnSync('gitleaks', ['stdin', '--no-banner', '--redact'], {
    cwd: root,
    input: [diff.stdout, ...added].join('\n'),
    encoding: 'utf8',
    timeout: STEP_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024
  })
  const output = `${scan.stdout ?? ''}${scan.stderr ?? ''}`
  return {
    status: scan.error ? 1 : scan.status,
    stdout: scan.stdout ?? '',
    output: scan.error ? `${scan.error.message}\n${output}` : output
  }
}

function changedFiles(root, base) {
  if (!base) return null
  const diff = run(`git diff --name-only ${base}`, root)
  if (diff.status !== 0) return null
  const untracked = run('git ls-files --others --exclude-standard', root)
  return [...diff.stdout.split(/\r?\n/), ...untracked.stdout.split(/\r?\n/)]
    .map((file) => toPosix(file.trim()))
    .filter(Boolean)
}

function listFiles(root, dir, pattern) {
  const full = join(root, dir)
  if (!existsSync(full)) return []
  return readdirSync(full, { recursive: true })
    .map((name) => toPosix(join(dir, String(name))))
    .filter((file) => pattern.test(file))
}

function readRepo(root) {
  const pkgPath = join(root, 'package.json')
  const scripts = existsSync(pkgPath)
    ? (JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {})
    : {}
  const terraformTests = findTerraformTestDirs(root)
  const terraform =
    existsSync(join(root, '.terraform-version')) || terraformTests.length > 0
  const remote = run('git remote get-url origin', root)
  return {
    root,
    scripts,
    terraform,
    terraformRoots: terraform
      ? TERRAFORM_ROOTS.filter((dir) => existsSync(join(root, dir)))
      : [],
    terraformTests: terraform ? terraformTests : [],
    checks: existsSync(join(root, 'checks', 'package.json')),
    workflows: existsSync(join(root, '.github', 'workflows')),
    workflowFiles: [
      ...listFiles(root, '.github/workflows', /\.ya?ml$/),
      ...listFiles(root, '.github/actions', /action\.ya?ml$/)
    ],
    packageFiles: ['package.json', 'checks/package.json'].filter((file) =>
      existsSync(join(root, file))
    ),
    github: remote.status === 0 ? parseGitHubRemote(remote.stdout) : null,
    shellScripts: listFiles(root, 'scripts', /^scripts\/[^/]+\.sh$/)
  }
}

function changedFileMisses(root, files, prefix, changed) {
  const wanted = new Set(changed)
  const misses = []
  for (const [file, record] of Object.entries(files)) {
    const rel = (
      isAbsolute(file) ? toPosix(relative(root, file)) : `${prefix}${file}`
    ).replace(/^\.\//, '')
    const below = belowTarget(record)
    if (wanted.has(rel) && below.length)
      misses.push(`  changed file below target: ${rel} ${below.join(', ')}`)
  }
  return misses
}

function coverageFor(root, report, changed, since) {
  const { prefix, file } = report
  const lcovPath = join(root, file)
  if (!existsSync(lcovPath)) return { lines: [], below: 0 }
  if (statSync(lcovPath).mtimeMs < since) {
    return {
      lines: [
        `COVERAGE ignored stale ${file} (tests did not write it this run)`
      ],
      below: 0
    }
  }
  const { total, files } = parseLcov(readFileSync(lcovPath, 'utf8'))
  const totalBelow = belowTarget(total)
  const note = totalBelow.length
    ? `  (below target: ${totalBelow.join(', ')})`
    : ''
  const label = prefix ? 'checks ' : 'repo '
  const misses = changed
    ? changedFileMisses(root, files, prefix, changed)
    : [`  changed-file coverage blocked: ${BASE_BLOCKED}`]
  const show = (value) => value ?? 'n/a'
  return {
    measured: true,
    lines: [
      `COVERAGE ${label}lines ${show(total.lines)} | branches ${show(total.branches)} | functions ${show(total.functions)}${note}`,
      ...misses
    ],
    below: (totalBelow.length ? 1 : 0) + misses.length
  }
}

const COVERAGE_REPORTS = [
  { prefix: '', file: 'coverage/lcov.info' },
  { prefix: '', file: 'lcov.info' },
  { prefix: 'checks/', file: 'checks/coverage/lcov.info' }
]

function coverageReport(root, changed, since, required) {
  const parts = COVERAGE_REPORTS.map((report) =>
    coverageFor(root, report, changed, since)
  )
  const lines = parts.flatMap((part) => part.lines)
  const below = parts.reduce((sum, part) => sum + part.below, 0)
  if (required && !parts.some((part) => part.measured)) {
    return {
      lines: [...lines, 'COVERAGE missing: no fresh lcov.info from the tests'],
      below: below + 1
    }
  }
  return {
    lines: lines.length ? lines : ['COVERAGE not measured (no lcov.info)'],
    below
  }
}

// Coverage is required when the repo runs unit tests (not WebdriverIO journey tests).
const requiresCoverage = (repo) =>
  Boolean(repo.scripts.test) && !/\bwdio\b/.test(repo.scripts.test)

function formatResult(result) {
  const parts = [result.result.padEnd(4), result.id]
  if (result.seconds !== undefined) parts.push(`${result.seconds}s`)
  if (result.note) parts.push(` ${result.note}`)
  const lines = [parts.join(' ')]
  if (result.result === 'FAIL' && result.tail)
    lines.push(...result.tail.map((line) => `     | ${line}`))
  return lines
}

/**
 * Formats the run summary.
 * @param {string} name Repository name.
 * @param {string} mode Gate mode.
 * @param {Array<object>} results Step results.
 * @param {string[]} coverageLines Coverage lines.
 * @param {number} coverageBelow Count of coverage misses.
 * @returns {string}
 */
export function summarise(name, mode, results, coverageLines, coverageBelow) {
  const count = (kind) => results.filter((r) => r.result === kind).length
  const failed = count('FAIL')
  const verdict = failed || coverageBelow ? 'FAIL' : 'PASS'
  return [
    `GATES ${name} (${mode})`,
    ...results.flatMap(formatResult),
    ...coverageLines,
    `RESULT ${verdict} (${failed} failed, ${count('WARN')} warnings, ${count('SKIP')} skipped, ${coverageBelow} coverage misses)`
  ].join('\n')
}

function argValue(args, flag, fallback) {
  const index = args.indexOf(flag)
  return index > -1 && args[index + 1] ? args[index + 1] : fallback
}

/**
 * Resolves the repository path with an upper-case drive letter: a lower-case one makes Vitest
 * load two copies of itself on Windows ("failed to find the runner").
 * @param {string} path Repository path.
 * @returns {string}
 */
export function normaliseRoot(path) {
  return resolve(path).replace(/^[a-z]:/, (drive) => drive.toUpperCase())
}

function noteFor(step, result, stdout, logFile) {
  if (step.count)
    return result === 'SKIP'
      ? 'no access or not enabled'
      : `${stdout.trim()} open`
  return result === 'PASS' ? '' : `log: ${logFile}`
}

function runStep(step, name, outDir, cache) {
  if (step.skip) return { id: step.id, result: 'SKIP', note: step.skip }
  if (step.tool && !toolAvailable(step.tool, cache))
    return { id: step.id, result: 'SKIP', note: `${step.tool} not installed` }
  const started = Date.now()
  const {
    status,
    stdout = '',
    output
  } = step.builtin ? step.builtin() : run(step.command, step.cwd, step.env)
  const logFile = join(
    outDir,
    `${name}-${step.id.replaceAll(/[^\w.-]/g, '_')}.log`
  )
  writeFileSync(logFile, output)
  const result = resultFor(step, status, stdout)
  return {
    id: step.id,
    result,
    seconds: Math.round((Date.now() - started) / 1000),
    note: noteFor(step, result, stdout, logFile),
    tail: output
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .slice(-TAIL_LINES)
  }
}

/**
 * Runs the gates for one repository.
 * @param {string[]} args CLI arguments.
 * @returns {{ output: string, exitCode: number }}
 */
export function runGates(args) {
  const root = normaliseRoot(argValue(args, '--repo', process.cwd()))
  const mode = args.includes('--full') ? 'full' : 'quick'
  const ref = argValue(args, '--base', 'origin/main')
  if (!/^[\w./-]+$/.test(ref)) throw new Error(`Unsafe --base value: ${ref}`)
  const base = mergeBase(root, ref)
  const name = basename(root)
  const repo = readRepo(root)
  const steps = planGates(repo, mode, base)

  if (args.includes('--dry-run')) {
    const describe = (step) =>
      step.skip ? `SKIP ${step.skip}` : (step.command ?? 'built-in check')
    const lines = steps.map((step) => `${step.id}: ${describe(step)}`)
    return { output: `${lines.join('\n')}\n`, exitCode: 0 }
  }

  const outDir = resolve(argValue(args, '--out', join(tmpdir(), 'aip-gates')))
  mkdirSync(outDir, { recursive: true })
  const since = Date.now() - 1000
  const cache = {}
  const results = steps.map((step) => runStep(step, name, outDir, cache))
  const { lines, below } = coverageReport(
    root,
    changedFiles(root, base),
    since,
    requiresCoverage(repo)
  )
  const summary = summarise(name, mode, results, lines, below)
  writeFileSync(join(outDir, `${name}-summary.txt`), summary)
  return {
    output: `${summary}\n`,
    exitCode: summary.includes('RESULT PASS') ? 0 : 1
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) {
  const { output, exitCode } = runGates(process.argv.slice(2))
  process.stdout.write(output)
  process.exitCode = exitCode
}

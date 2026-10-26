import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  collectStrings,
  decide,
  readEvent,
  toOutput
} from '../scripts/aip-guard.mjs'

const guard = fileURLToPath(
  new URL('../scripts/aip-guard.mjs', import.meta.url)
)
const terminal = (command) => ({
  tool_name: 'run_in_terminal',
  tool_input: { command }
})
const edit = (filePath) => ({
  tool_name: 'replace_string_in_file',
  tool_input: { filePath, oldString: 'a', newString: 'b' }
})

test('reads Local and Copilot event shapes', () => {
  assert.deepEqual(readEvent({ tool_name: 'x', tool_input: { a: 1 } }), {
    tool: 'x',
    input: { a: 1 }
  })
  assert.deepEqual(
    readEvent({ toolName: 'bash', toolArgs: '{"command":"ls"}' }),
    { tool: 'bash', input: { command: 'ls' } }
  )
  assert.deepEqual(readEvent({ toolName: 'bash', toolArgs: 'not json' }), {
    tool: 'bash',
    input: { command: 'not json' }
  })
  assert.deepEqual(readEvent({}), { tool: '', input: {} })
})

test('collects nested commands and paths, including patch file headers', () => {
  const found = collectStrings({
    command: 'git status',
    replacements: [{ filePath: 'a.js' }, { filePath: 'b.js' }],
    input: '*** Begin Patch\n*** Update File: c.js\n*** End Patch'
  })
  assert.deepEqual(found.commands, ['git status'])
  assert.deepEqual(found.paths, ['a.js', 'b.js', 'c.js'])
})

for (const command of [
  'git commit -m "x" --no-verify',
  'git push --force origin main',
  'git push -f',
  'git push --force-with-lease',
  'git push origin +main',
  'git -C ../ai-platform-frontend push --force origin x',
  'git reset --hard HEAD~1',
  'git -C repo reset --hard',
  'terraform -chdir=platform apply',
  'terraform destroy -auto-approve',
  'terraform state rm module.x',
  'gh pr merge 12 --squash',
  "gh api graphql -f query='mutation{mergePullRequest(input:{})}'",
  'gh run rerun 123',
  'gh release create v1.0.0',
  'npm publish',
  'Get-Content .env',
  'cat ai-platform-backend-api/.env.local',
  'Set-Content ai-platform-tenants\\environments\\infradev\\cool-team.json "{}"'
]) {
  test(`denies: ${command}`, () => {
    assert.equal(decide(terminal(command)).decision, 'deny')
  })
}

for (const command of [
  'git push origin feature/x',
  'git -C C:\\repos\\ai-platform-frontend push origin feature/x',
  'git -c core.sshCommand=ssh push',
  'gh pr create --draft --title t',
  'gh workflow run apply.yml -R DEFRA/ai-platform-deployments -f environment=infradev',
  'gh api repos/DEFRA/x/actions/workflows/a.yml/dispatches -f ref=main',
  'az role assignment create --role Reader',
  'az keyvault secret set --name x',
  'rm -rf node_modules',
  'Remove-Item dist -Recurse -Force',
  'git clean -fd',
  'git branch -D old'
]) {
  test(`asks: ${command}`, () => {
    assert.equal(decide(terminal(command)).decision, 'ask')
  })
}

for (const command of [
  'git status',
  'git push --follow-tags --dry-run',
  'terraform -chdir=platform plan -out=apply.tfplan',
  'terraform fmt -check -recursive',
  'az group list',
  'cat .env.example',
  'node --env-file-if-exists=.env ./src',
  'Get-Content ai-platform-tenants/environments/infradev/cool-team.json',
  'npx vitest run --coverage'
]) {
  test(`allows: ${command}`, () => {
    const expected = command.startsWith('git push') ? 'ask' : null
    assert.equal(decide(terminal(command)).decision, expected)
  })
}

test('denies edits to machine-written state, for every role', () => {
  for (const role of [undefined, 'developer', 'docs']) {
    assert.equal(
      decide(
        edit('C:\\repos\\ai-platform-tenants\\environments\\infradev\\x.json'),
        role
      ).decision,
      'deny'
    )
    assert.equal(
      decide(
        edit(
          '/repos/ai-platform-deployments/environments/infradev/platform.json'
        ),
        role
      ).decision,
      'deny'
    )
  }
})

test('denies reading or writing .env files but allows examples', () => {
  assert.equal(
    decide({ tool_name: 'read_file', tool_input: { filePath: 'C:\\r\\.env' } })
      .decision,
    'deny'
  )
  assert.equal(
    decide({ toolName: 'view', toolArgs: { path: '/r/.env.local' } }).decision,
    'deny'
  )
  assert.equal(
    decide({
      tool_name: 'read_file',
      tool_input: { filePath: '/r/.env.local.example' }
    }).decision,
    null
  )
})

test('restricts edits by role', () => {
  const run =
    'C:\\repos\\ai-platform-agents\\.copilot-tracking\\runs\\2026-10-22-x\\review.md'
  const code = 'C:\\repos\\ai-platform-backend-api\\src\\routes\\teams.js'
  assert.equal(decide(edit(run), 'reviewer').decision, null)
  assert.equal(decide(edit(code), 'reviewer').decision, 'deny')
  assert.equal(decide(edit(code), 'releaser').decision, 'deny')
  assert.equal(decide(edit(code), 'orchestrator').decision, 'deny')
  assert.equal(decide(edit(code), 'developer').decision, null)
  assert.equal(
    decide(edit('/r/ai-platform-frontend/docs/plans/remaining.md'), 'planner')
      .decision,
    'deny'
  )
  assert.equal(
    decide(
      edit('/r/ai-platform-discovery-docs/src/content/design-identity.md'),
      'planner'
    ).decision,
    null
  )
  assert.equal(decide(edit(code), 'planner').decision, 'deny')
  assert.equal(
    decide(edit('/r/ai-platform-frontend/README.md'), 'docs').decision,
    null
  )
  assert.equal(
    decide(edit('/r/ai-platform-discovery-docs/test/site.test.js'), 'docs')
      .decision,
    null
  )
  assert.equal(decide(edit(code), 'docs').decision, 'deny')
  assert.equal(
    decide(
      { tool_name: 'read_file', tool_input: { filePath: code } },
      'reviewer'
    ).decision,
    null
  )
})

test('lets every role use the memory tool', () => {
  const memory = {
    tool_name: 'memory',
    tool_input: {
      command: 'create',
      path: '/memories/repo/aip.md',
      file_text: '- note'
    }
  }
  for (const role of ['orchestrator', 'reviewer', 'releaser', 'docs']) {
    assert.equal(decide(memory, role).decision, null)
  }
})

test('asks before agent, hook or workspace settings are edited', () => {
  assert.equal(
    decide(edit('/r/ai-platform-agents/scripts/aip-guard.mjs'), 'developer')
      .decision,
    'ask'
  )
  assert.equal(
    decide(
      edit('/r/ai-platform-agents/.github/agents/aip-developer.agent.md'),
      'developer'
    ).decision,
    'ask'
  )
  assert.equal(
    decide(edit('/r/defra-ai-platform.code-workspace')).decision,
    'ask'
  )
})

test('scopes the Developer to app repos and the Platform Engineer to platform repos', () => {
  const app = '/r/ai-platform-frontend/src/server/routes/home/controller.js'
  const tf = '/r/ai-platform-infra/modules/naming/main.tf'
  assert.equal(decide(edit(app), 'developer').decision, null)
  assert.equal(decide(edit(tf), 'developer').decision, 'deny')
  assert.equal(decide(edit(tf), 'platform').decision, null)
  assert.equal(
    decide(edit('/r/ai-platform-workflows/scripts/apply.sh'), 'platform')
      .decision,
    null
  )
  assert.equal(decide(edit(app), 'platform').decision, 'deny')
  assert.equal(decide(edit('src/relative.js'), 'developer').decision, null)
  assert.equal(
    decide(
      edit('/r/ai-platform-tenants/environments/infradev/x.json'),
      'platform'
    ).decision,
    'deny'
  )
})

test('lets the Developer edit the gitops worker and the Platform Engineer edit tenants and deployments callers', () => {
  const worker = '/r/ai-platform-gitops-worker/src/reconcile.js'
  const tenantsCaller = '/r/ai-platform-tenants/.github/workflows/apply.yml'
  const deploymentsCaller =
    'C:\\repos\\ai-platform-deployments\\.github\\workflows\\apply.yml'
  assert.equal(decide(edit(worker), 'developer').decision, null)
  assert.equal(decide(edit(worker), 'platform').decision, 'deny')
  assert.equal(decide(edit(tenantsCaller), 'platform').decision, null)
  assert.equal(decide(edit(deploymentsCaller), 'platform').decision, null)
  assert.equal(decide(edit(tenantsCaller), 'developer').decision, 'deny')
  assert.equal(decide(edit(deploymentsCaller), 'developer').decision, 'deny')
  for (const role of ['orchestrator', 'reviewer', 'releaser', 'docs']) {
    assert.equal(decide(edit(worker), role).decision, 'deny')
    assert.equal(decide(edit(tenantsCaller), role).decision, 'deny')
  }
})

test('keeps machine-written state denied for the Platform Engineer in tenants and deployments', () => {
  for (const state of [
    '/r/ai-platform-tenants/environments/infradev/cool-team.json',
    '/r/ai-platform-deployments/environments/infradev/platform.json'
  ]) {
    assert.equal(decide(edit(state), 'platform').decision, 'deny')
  }
})

test('limits the Platform Engineer in tenants and deployments to caller workflows, CODEOWNERS and README', () => {
  for (const repo of ['ai-platform-tenants', 'ai-platform-deployments']) {
    for (const allowed of [
      `/r/${repo}/.github/workflows/apply.yml`,
      `/r/${repo}/.github/workflows/apply.yaml`,
      `/r/${repo}/.github/CODEOWNERS`,
      `/r/${repo}/CODEOWNERS`,
      `/r/${repo}/README.md`
    ]) {
      assert.equal(decide(edit(allowed), 'platform').decision, null, allowed)
    }
    for (const refused of [
      `/r/${repo}/package.json`,
      `/r/${repo}/src/apply.js`,
      `/r/${repo}/docs/notes.md`,
      `/r/${repo}/.github/workflows/scripts/run.sh`,
      `/r/${repo}/.github/workflows/../../src/apply.js`,
      `/r/${repo}/.github/dependabot.yml`
    ]) {
      assert.equal(decide(edit(refused), 'platform').decision, 'deny', refused)
    }
  }
})

test('denies writes to the tenants and deployments state directory itself, for every role', () => {
  for (const role of [undefined, 'developer', 'platform']) {
    for (const command of [
      'rm -rf /r/ai-platform-tenants/environments',
      'Remove-Item -Recurse C:\\r\\ai-platform-deployments\\environments',
      'rm -rf "/r/ai-platform-deployments/environments"'
    ]) {
      assert.equal(decide(terminal(command), role).decision, 'deny', command)
    }
    assert.equal(
      decide(edit('/r/ai-platform-tenants/environments'), role).decision,
      'deny'
    )
  }
  assert.equal(
    decide(edit('/r/ai-platform-tenants/environments-notes.md')).decision,
    null
  )
})

test('denies MCP pull request merges and asks before MCP repository writes', () => {
  assert.equal(
    decide({
      tool_name: 'mcp_github_merge_pull_request',
      tool_input: { pullNumber: 1 }
    }).decision,
    'deny'
  )
  assert.equal(
    decide({ toolName: 'github/create_pull_request', toolArgs: { title: 't' } })
      .decision,
    'ask'
  )
  assert.equal(
    decide({ tool_name: 'mcp_github_push_files', tool_input: { branch: 'x' } })
      .decision,
    'ask'
  )
  assert.equal(
    decide(
      {
        tool_name: 'mcp_github_create_or_update_file',
        tool_input: { path: 'src/a.js' }
      },
      'reviewer'
    ).decision,
    'deny'
  )
  assert.equal(
    decide({ tool_name: 'mcp_github_list_pull_requests', tool_input: {} })
      .decision,
    null
  )
})

test('a deny wins over an ask in the same call', () => {
  assert.equal(
    decide(terminal('git push --force && gh pr create')).decision,
    'deny'
  )
})

test('output carries both harness shapes', () => {
  assert.deepEqual(toOutput({ decision: null }), {})
  const out = toOutput({ decision: 'deny', reason: 'r' })
  assert.equal(out.permissionDecision, 'deny')
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
  assert.equal(out.hookSpecificOutput.hookEventName, 'PreToolUse')
})

test('CLI exits 2 with a reason on deny, 0 otherwise, and tolerates bad input', () => {
  const deny = spawnSync(process.execPath, [guard], {
    input: JSON.stringify(terminal('gh pr merge 1')),
    encoding: 'utf8'
  })
  assert.equal(deny.status, 2)
  assert.match(deny.stderr, /Never merge/)
  assert.equal(JSON.parse(deny.stdout).permissionDecision, 'deny')

  const role = spawnSync(process.execPath, [guard, '--role', 'reviewer'], {
    input: JSON.stringify(edit('/r/ai-platform-backend-api/src/a.js')),
    encoding: 'utf8'
  })
  assert.equal(role.status, 2)

  const allow = spawnSync(process.execPath, [guard], {
    input: JSON.stringify(terminal('git status')),
    encoding: 'utf8'
  })
  assert.equal(allow.status, 0)
  assert.equal(allow.stdout, '{}')

  const bad = spawnSync(process.execPath, [guard], {
    input: 'not json',
    encoding: 'utf8'
  })
  assert.equal(bad.status, 0)
  assert.equal(bad.stdout, '{}')
})

test('handles quoted git -C paths containing spaces', () => {
  const repo = '"/r/work space/ai-platform-frontend"'
  assert.equal(
    decide(terminal(`git -C ${repo} push --force origin main`)).decision,
    'deny'
  )
  assert.equal(
    decide(terminal(`git -C ${repo} push origin main`)).decision,
    'ask'
  )
  assert.equal(decide(terminal(`git -C ${repo} reset --hard`)).decision, 'deny')
  assert.equal(
    decide(terminal(`git -c 'a b=c' push -f origin main`)).decision,
    'deny'
  )
})

test('checks patch rename destinations', () => {
  const patch = (to) => ({
    tool_name: 'apply_patch',
    tool_input: {
      input: `*** Begin Patch\n*** Update File: /r/ai-platform-agents/.copilot-tracking/runs/x/log.md\n*** Move to: ${to}\n*** End Patch`
    }
  })
  assert.equal(
    decide(patch('/r/ai-platform-backend-api/src/a.js'), 'reviewer').decision,
    'deny'
  )
  assert.equal(
    decide(
      patch('/r/ai-platform-tenants/environments/infradev/x.json'),
      'developer'
    ).decision,
    'deny'
  )
})

test('resolves relative paths and dot segments before authorising', () => {
  assert.equal(
    decide(
      {
        ...edit('environments/infradev/x.json'),
        cwd: '/r/ai-platform-tenants'
      },
      'platform'
    ).decision,
    'deny'
  )
  assert.equal(
    decide(
      edit('/r/ai-platform-frontend/../ai-platform-infra/main.tf'),
      'developer'
    ).decision,
    'deny'
  )
  assert.equal(
    decide({ ...edit('src/a.js'), cwd: '/r/ai-platform-frontend' }, 'developer')
      .decision,
    null
  )
})

test('applies role edit boundaries to terminal writes', () => {
  const code = '/r/ai-platform-backend-api/src/a.js'
  assert.equal(
    decide(terminal(`printf x > ${code}`), 'reviewer').decision,
    'deny'
  )
  assert.equal(
    decide(terminal(`echo x | tee -a ${code}`), 'releaser').decision,
    'deny'
  )
  assert.equal(
    decide(terminal(`Set-Content -Path ${code} -Value x`), 'reviewer').decision,
    'deny'
  )
  assert.equal(
    decide(terminal(`sed -i s/a/b/ ${code}`), 'reviewer').decision,
    'deny'
  )
  assert.equal(
    decide(terminal(`cp a.txt ${code}`), 'reviewer').decision,
    'deny'
  )
  assert.equal(
    decide(
      terminal(
        `npm test > /r/ai-platform-agents/.copilot-tracking/runs/x/log.md 2>&1`
      ),
      'reviewer'
    ).decision,
    null
  )
  assert.equal(
    decide(terminal('npm test > /tmp/out.txt 2>/dev/null'), 'reviewer')
      .decision,
    null
  )
  assert.equal(
    decide(terminal(`printf x > ${code}`), 'developer').decision,
    null
  )
  assert.equal(
    decide(
      terminal('printf x > /r/ai-platform-agents/scripts/aip-guard.mjs'),
      'developer'
    ).decision,
    'ask'
  )
})

test('treats MCP push_files as an edit restricted by role', () => {
  const push = {
    tool_name: 'mcp_github_push_files',
    tool_input: { files: [{ path: 'src/a.js', content: 'b' }] }
  }
  assert.equal(decide(push, 'reviewer').decision, 'deny')
})

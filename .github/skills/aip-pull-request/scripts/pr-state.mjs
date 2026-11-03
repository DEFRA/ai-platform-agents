#!/usr/bin/env node
// Reports where one pull request stands, from GitHub's own data, so no agent has to infer it from memory or timestamps.
// Usage: node pr-state.mjs --repo DEFRA/<repo> --pr <number> [--wait <minutes>] [--json]
// Exit 0: SETTLED, or HUMAN-REVIEW (cap reached, threads left for the human). 1: anything else. 2: could not read.
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Copilot reviews 1 to 3 are fixed and resolved automatically; from the fourth they are listed for the human.
export const AUTO_REVIEW_LIMIT = 3
// A Copilot review normally lands in 2 to 10 minutes; a request older than this has stalled.
export const STALLED_AFTER_MINUTES = 30
const POLL_SECONDS = 60
const GH_TIMEOUT_MS = 60 * 1000
const IN_FLIGHT = new Set(['REVIEW-PENDING', 'CHECKS-PENDING'])
const FAILED = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ERROR'])

const QUERY = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
state isDraft headRefOid
reviews(last:100){pageInfo{hasPreviousPage} nodes{author{__typename login} submittedAt body commit{oid} comments{totalCount}}}
timelineItems(last:50,itemTypes:[REVIEW_REQUESTED_EVENT]){nodes{... on ReviewRequestedEvent{createdAt requestedReviewer{__typename ... on Bot{login} ... on User{login}}}}}
reviewThreads(first:100){pageInfo{hasNextPage} nodes{id isResolved isOutdated comments(first:1){nodes{path line body}}}}
commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:100){nodes{__typename ... on CheckRun{name conclusion status} ... on StatusContext{context state}}}}}}}
}}}`

// Only GitHub's own reviewer bot counts: a person whose login starts with "copilot" must not be trusted as it.
const isCopilot = (actor) =>
  /^copilot-pull-request-reviewer(\[bot\])?$/i.test(actor?.login ?? '') &&
  (actor.__typename ?? 'Bot') === 'Bot'
const toMillis = (iso) => Date.parse(iso)

function copilotReviews(pr) {
  return pr.reviews.nodes
    .filter((review) => isCopilot(review.author))
    .sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt))
}

function latestCopilotRequest(pr) {
  const times = pr.timelineItems.nodes
    .filter((event) => isCopilot(event.requestedReviewer))
    .map((event) => toMillis(event.createdAt))
  return times.length ? Math.max(...times) : null
}

function copilotState(pr, now) {
  const reviews = copilotReviews(pr)
  const latest = reviews.at(-1) ?? null
  const requestedAt = latestCopilotRequest(pr)
  const pending =
    requestedAt !== null &&
    (!latest || requestedAt > toMillis(latest.submittedAt))
  return {
    count: reviews.length,
    mode: reviews.length <= AUTO_REVIEW_LIMIT ? 'auto' : 'human-only',
    latest: latest && {
      commit: latest.commit?.oid ?? null,
      submittedAt: latest.submittedAt,
      comments: latest.comments.totalCount,
      bodyHidesFindings: /suppressed|low[- ]confidence/i.test(latest.body ?? '')
    },
    onHead: latest?.commit?.oid === pr.headRefOid,
    pendingMinutes: pending ? Math.round((now - requestedAt) / 60000) : null
  }
}

function checkState(pr) {
  const rollup = pr.commits.nodes.at(-1)?.commit.statusCheckRollup ?? null
  const failing = (rollup?.contexts.nodes ?? [])
    .filter((context) => FAILED.has(context.conclusion ?? context.state))
    .map((context) => context.name ?? context.context)
  return { rollup: rollup?.state ?? 'NONE', failing }
}

function decide(pr, copilot, threads, checks, incomplete) {
  if (pr.state !== 'OPEN') return pr.state
  if (incomplete) return 'INCOMPLETE'
  if (copilot.pendingMinutes !== null)
    return copilot.pendingMinutes > STALLED_AFTER_MINUTES
      ? 'REQUEST-STALLED'
      : 'REVIEW-PENDING'
  const forHuman = copilot.mode === 'human-only'
  if (threads.length && !forHuman) return 'THREADS-OPEN'
  if (['FAILURE', 'ERROR'].includes(checks.rollup)) return 'CHECKS-FAILING'
  if (['PENDING', 'EXPECTED'].includes(checks.rollup)) return 'CHECKS-PENDING'
  if (copilot.count === 0) return 'NO-COPILOT-REVIEW'
  if (!copilot.onHead) return 'UNREVIEWED-HEAD'
  return threads.length ? 'HUMAN-REVIEW' : 'SETTLED'
}

/**
 * Works out a pull request's state from GitHub's GraphQL data.
 * The state is decided from commit SHAs, review requests and thread flags, never from comparing
 * the time of a review with the time of a push.
 * @param {object} pr The `pullRequest` node returned by the query.
 * @param {number} [now] Current time in milliseconds.
 * @returns {{ state: string, head: string, draft: boolean, copilot: object, threads: object[], checks: object }}
 */
export function assess(pr, now = Date.now()) {
  const copilot = copilotState(pr, now)
  const threads = pr.reviewThreads.nodes
    .filter((thread) => !thread.isResolved)
    .map((thread) => {
      const comment = thread.comments.nodes[0] ?? {}
      return {
        id: thread.id,
        outdated: thread.isOutdated,
        path: comment.path ?? null,
        line: comment.line ?? null,
        text: (comment.body ?? '').split('\n')[0].slice(0, 120)
      }
    })
  const checks = checkState(pr)
  // A connection longer than one page would hide older reviews or later threads: never call that clear.
  const incomplete = Boolean(
    pr.reviews.pageInfo?.hasPreviousPage ||
    pr.reviewThreads.pageInfo?.hasNextPage
  )
  return {
    state: decide(pr, copilot, threads, checks, incomplete),
    head: pr.headRefOid,
    draft: pr.isDraft,
    copilot,
    threads,
    checks
  }
}

const NEXT_STEP = {
  SETTLED: 'Nothing more to do on this PR.',
  'REVIEW-PENDING':
    'A Copilot review is on its way. Do not report "no unresolved threads" and do not request another: wait, then check again.',
  'REQUEST-STALLED':
    'The Copilot request has not been answered. Ask the user whether to request again.',
  'THREADS-OPEN': 'Handle every listed thread in one batch, then one push.',
  'CHECKS-FAILING': 'Read only the failing checks.',
  'CHECKS-PENDING': 'Checks are still running: wait, then check again.',
  'NO-COPILOT-REVIEW': 'Request a Copilot review once.',
  'UNREVIEWED-HEAD':
    'The newest Copilot review is of an older commit and none is pending: request one review.',
  MERGED: 'Merged.',
  CLOSED: 'Closed.',
  INCOMPLETE:
    'More than 100 reviews or threads: this read is partial and cannot show the PR is clear. Read it in the GitHub UI.',
  'HUMAN-REVIEW':
    'Copilot cap reached: list the open threads for the human reviewer and leave them open. Do not route, reply or resolve.'
}

/**
 * Formats an assessment as a few lines for an agent to read.
 * @param {string} slug `owner/repo#number`.
 * @param {ReturnType<typeof assess>} result Assessment.
 * @returns {string}
 */
export function format(slug, result) {
  const { copilot, threads, checks } = result
  const latest = copilot.latest
    ? `latest on ${copilot.latest.commit?.slice(0, 7)} (${copilot.onHead ? 'this head' : 'older head'}), ${copilot.latest.comments} comment(s)`
    : 'none yet'
  const pending =
    copilot.pendingMinutes === null
      ? 'no request pending'
      : `request pending ${copilot.pendingMinutes} min`
  const failing = checks.failing.length
    ? ` (failing: ${checks.failing.join(', ')})`
    : ''
  const lines = [
    `PR ${slug} head ${result.head.slice(0, 7)}${result.draft ? ' (draft)' : ''}`,
    `COPILOT reviews ${copilot.count} (${copilot.mode}) | ${latest} | ${pending}`,
    `THREADS unresolved ${threads.length}`,
    ...threads.map(
      (thread) =>
        `  ${thread.id} ${thread.path ?? 'review'}:${thread.line ?? '-'}${thread.outdated ? ' (outdated)' : ''} ${thread.text}`
    ),
    `CHECKS ${checks.rollup}${failing}`
  ]
  if (copilot.latest?.bodyHidesFindings)
    lines.push(
      'NOTE the latest Copilot review body mentions suppressed or low-confidence comments: read it, they are not threads.'
    )
  lines.push(`STATE ${result.state}`, `NEXT ${NEXT_STEP[result.state]}`)
  return lines.join('\n')
}

/**
 * Reads the pull request through the GitHub CLI.
 * @param {string} repo `owner/name`.
 * @param {number} number Pull request number.
 * @returns {object} The `pullRequest` node.
 */
export function readPullRequest(repo, number) {
  const [owner, name] = repo.split('/')
  const args = ['api', 'graphql', '-f', `query=${QUERY}`]
  args.push('-F', `o=${owner}`, '-F', `r=${name}`, '-F', `n=${number}`)
  let out
  try {
    out = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: GH_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024
    })
  } catch (error) {
    const reason =
      error.code === 'ETIMEDOUT'
        ? `no answer within ${GH_TIMEOUT_MS / 1000} s`
        : String(error.stderr || error.message).split('\n')[0]
    throw new Error(`gh could not read ${repo}#${number}: ${reason}`)
  }
  const pr = JSON.parse(out).data?.repository?.pullRequest
  if (!pr) throw new Error(`Pull request ${repo}#${number} not found`)
  return pr
}

/**
 * Checks again until the state is no longer waiting on a review or on checks, or the time runs out.
 * @param {() => object} read Returns the current `pullRequest` node.
 * @param {number} waitMinutes Longest wait in minutes; 0 reads once.
 * @param {(ms: number) => Promise<void>} sleep Waits for the given milliseconds.
 * @param {() => number} [clock] Current time in milliseconds.
 * @returns {Promise<ReturnType<typeof assess>>}
 */
export async function settle(read, waitMinutes, sleep, clock = Date.now) {
  const deadline = clock() + waitMinutes * 60000
  let result = assess(read(), clock())
  while (
    IN_FLIGHT.has(result.state) &&
    clock() + POLL_SECONDS * 1000 <= deadline
  ) {
    await sleep(POLL_SECONDS * 1000)
    result = assess(read(), clock())
  }
  return result
}

/**
 * Parses and validates the command-line arguments.
 * @param {string[]} args Arguments after the script name.
 * @returns {{ repo: string, pr: number, wait: number, json: boolean }}
 */
export function parseArgs(args) {
  const value = (flag) =>
    args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined
  const repo = value('--repo') ?? ''
  const pr = value('--pr') ?? ''
  const wait = value('--wait') ?? '0'
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo))
    throw new Error(`Unsafe or missing --repo: ${repo}`)
  if (!/^\d+$/.test(pr)) throw new Error(`Missing or invalid --pr: ${pr}`)
  if (!/^\d{1,3}$/.test(wait))
    throw new Error(`Invalid --wait minutes: ${wait}`)
  return {
    repo,
    pr: Number(pr),
    wait: Number(wait),
    json: args.includes('--json')
  }
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) {
  try {
    const { repo, pr, wait, json } = parseArgs(process.argv.slice(2))
    const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
    const result = await settle(() => readPullRequest(repo, pr), wait, sleep)
    const text = json
      ? JSON.stringify(result, null, 2)
      : format(`${repo}#${pr}`, result)
    process.stdout.write(`${text}\n`)
    process.exitCode = ['SETTLED', 'HUMAN-REVIEW'].includes(result.state)
      ? 0
      : 1
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 2
  }
}

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  assess,
  format,
  parseArgs,
  settle,
  STALLED_AFTER_MINUTES
} from '../.github/skills/aip-pull-request/scripts/pr-state.mjs'

const HEAD = 'a'.repeat(40)
const OLD = 'b'.repeat(40)
const NOW = Date.parse('2026-11-03T12:00:00Z')
const minutesAgo = (minutes) => new Date(NOW - minutes * 60000).toISOString()

const review = (login, commit, minutes, extra = {}) => ({
  author: { login },
  commit: { oid: commit },
  submittedAt: minutesAgo(minutes),
  body: '',
  comments: { totalCount: 0 },
  ...extra
})
const request = (login, minutes) => ({
  createdAt: minutesAgo(minutes),
  requestedReviewer: { login }
})
const thread = (id, resolved, extra = {}) => ({
  id,
  isResolved: resolved,
  isOutdated: false,
  comments: {
    nodes: [{ path: 'src/a.js', line: 7, body: 'Use a Joi schema\nmore' }]
  },
  ...extra
})

function pr(overrides = {}) {
  const {
    reviews = [],
    requests = [],
    threads = [],
    rollup = 'SUCCESS'
  } = overrides
  return {
    state: 'OPEN',
    isDraft: false,
    headRefOid: HEAD,
    reviews: { nodes: reviews },
    timelineItems: { nodes: requests },
    reviewThreads: { nodes: threads },
    commits: {
      nodes: [
        {
          commit: {
            statusCheckRollup: rollup && {
              state: rollup,
              contexts: { nodes: overrides.contexts ?? [] }
            }
          }
        }
      ]
    },
    ...(overrides.pr ?? {})
  }
}

const COPILOT = 'copilot-pull-request-reviewer'

test('a PR is settled only when the newest Copilot review is of the head, nothing is open and checks pass', () => {
  const result = assess(pr({ reviews: [review(COPILOT, HEAD, 20)] }), NOW)
  assert.equal(result.state, 'SETTLED')
  assert.equal(result.copilot.onHead, true)
})

test('a review requested after the last review is pending, even when every earlier thread is resolved', () => {
  const result = assess(
    pr({
      reviews: [review(COPILOT, OLD, 30)],
      requests: [request(COPILOT, 4)],
      threads: [thread('T1', true)]
    }),
    NOW
  )
  assert.equal(result.state, 'REVIEW-PENDING')
  assert.equal(result.copilot.pendingMinutes, 4)
  assert.match(
    format('DEFRA/x#1', result),
    /Do not report "no unresolved threads"/
  )
})

test('a request that nobody answered for too long is stalled, not pending', () => {
  const result = assess(
    pr({
      reviews: [review(COPILOT, OLD, 90)],
      requests: [request(COPILOT, STALLED_AFTER_MINUTES + 1)]
    }),
    NOW
  )
  assert.equal(result.state, 'REQUEST-STALLED')
})

test('a request answered by a later review is not pending', () => {
  const result = assess(
    pr({
      reviews: [review(COPILOT, HEAD, 3)],
      requests: [request(COPILOT, 6)]
    }),
    NOW
  )
  assert.equal(result.copilot.pendingMinutes, null)
  assert.equal(result.state, 'SETTLED')
})

test('a push after the newest review needs one request; a request for a person is ignored', () => {
  const result = assess(
    pr({
      reviews: [review(COPILOT, OLD, 40)],
      requests: [request('a-human', 2)]
    }),
    NOW
  )
  assert.equal(result.state, 'UNREVIEWED-HEAD')
  assert.equal(result.copilot.pendingMinutes, null)
})

test('no Copilot review yet asks for one', () => {
  assert.equal(assess(pr(), NOW).state, 'NO-COPILOT-REVIEW')
})

test('unresolved threads are listed, outdated ones too, and resolved ones are not', () => {
  const result = assess(
    pr({
      reviews: [review(COPILOT, HEAD, 5)],
      threads: [
        thread('T1', false),
        thread('T2', false, { isOutdated: true }),
        thread('T3', true)
      ]
    }),
    NOW
  )
  assert.equal(result.state, 'THREADS-OPEN')
  assert.deepEqual(
    result.threads.map((item) => [item.id, item.outdated, item.text]),
    [
      ['T1', false, 'Use a Joi schema'],
      ['T2', true, 'Use a Joi schema']
    ]
  )
})

test('failing and pending checks are reported after threads, with the failing names', () => {
  const failing = assess(
    pr({
      reviews: [review(COPILOT, HEAD, 5)],
      rollup: 'FAILURE',
      contexts: [
        { name: 'tests', conclusion: 'FAILURE' },
        { context: 'sonar', state: 'ERROR' },
        { name: 'lint', conclusion: 'SUCCESS' }
      ]
    }),
    NOW
  )
  assert.equal(failing.state, 'CHECKS-FAILING')
  assert.deepEqual(failing.checks.failing, ['tests', 'sonar'])
  const waiting = assess(
    pr({ reviews: [review(COPILOT, HEAD, 5)], rollup: 'PENDING' }),
    NOW
  )
  assert.equal(waiting.state, 'CHECKS-PENDING')
})

test('a PR with no checks configured can still be settled', () => {
  const result = assess(
    pr({ reviews: [review(COPILOT, HEAD, 5)], rollup: null }),
    NOW
  )
  assert.equal(result.checks.rollup, 'NONE')
  assert.equal(result.state, 'SETTLED')
})

test('the handling mode is auto for reviews 1 to 3 and human-only from the fourth', () => {
  const reviews = (count) =>
    Array.from({ length: count }, (_, index) =>
      review(COPILOT, HEAD, 50 - index)
    )
  assert.equal(assess(pr({ reviews: reviews(3) }), NOW).copilot.mode, 'auto')
  assert.equal(
    assess(pr({ reviews: reviews(4) }), NOW).copilot.mode,
    'human-only'
  )
})

test('a review body that mentions suppressed comments is flagged, because those are not threads', () => {
  const result = assess(
    pr({
      reviews: [
        review(COPILOT, HEAD, 5, {
          body: 'Comments suppressed due to low confidence (2)',
          comments: { totalCount: 1 }
        })
      ]
    }),
    NOW
  )
  assert.equal(result.copilot.latest.bodyHidesFindings, true)
  assert.match(format('DEFRA/x#1', result), /suppressed or low-confidence/)
})

test('a merged or closed PR reports that and nothing to do', () => {
  assert.equal(assess(pr({ pr: { state: 'MERGED' } }), NOW).state, 'MERGED')
  assert.equal(assess(pr({ pr: { state: 'CLOSED' } }), NOW).state, 'CLOSED')
})

test('settle waits while a review is pending, stops when it lands, and gives up at the limit', async () => {
  let now = NOW
  const clock = () => now
  const sleeps = []
  const sleep = async (ms) => {
    sleeps.push(ms)
    now += ms
  }
  const pending = pr({
    reviews: [review(COPILOT, OLD, 30)],
    requests: [request(COPILOT, 1)]
  })
  const landed = pr({ reviews: [review(COPILOT, HEAD, 0)] })
  let reads = 0
  const reader = () => (++reads < 3 ? pending : landed)
  const done = await settle(reader, 10, sleep, clock)
  assert.equal(done.state, 'SETTLED')
  assert.equal(sleeps.length, 2)

  sleeps.length = 0
  const stuck = await settle(() => pending, 3, sleep, clock)
  assert.equal(stuck.state, 'REVIEW-PENDING')
  assert.equal(sleeps.length, 3)

  sleeps.length = 0
  const once = await settle(() => pending, 0, sleep, clock)
  assert.equal(once.state, 'REVIEW-PENDING')
  assert.equal(sleeps.length, 0)
})

test('in human-only mode open threads stay visible without hiding checks or a new head', () => {
  const reviews = Array.from({ length: 4 }, (_, index) =>
    review(COPILOT, HEAD, 50 - index)
  )
  const open = [thread('T1', false)]
  const settledForHuman = assess(pr({ reviews, threads: open }), NOW)
  assert.equal(settledForHuman.state, 'HUMAN-REVIEW')
  assert.match(
    format('DEFRA/x#1', settledForHuman),
    /Do not route, reply or resolve/
  )
  assert.equal(
    assess(pr({ reviews, threads: open, rollup: 'FAILURE' }), NOW).state,
    'CHECKS-FAILING'
  )
  const newHead = [...reviews.slice(0, 3), review(COPILOT, OLD, 10)]
  assert.equal(
    assess(pr({ reviews: newHead, threads: open }), NOW).state,
    'UNREVIEWED-HEAD'
  )
})

test('only the Copilot reviewer bot counts, not a person whose login starts with copilot', () => {
  const impostor = [
    review('copilot-fan', HEAD, 5),
    review(COPILOT, HEAD, 5, { author: { login: COPILOT, __typename: 'User' } })
  ]
  const result = assess(pr({ reviews: impostor }), NOW)
  assert.equal(result.copilot.count, 0)
  assert.equal(result.state, 'NO-COPILOT-REVIEW')
  const requested = assess(
    pr({
      reviews: [review(COPILOT, HEAD, 5)],
      requests: [
        {
          createdAt: minutesAgo(1),
          requestedReviewer: { login: 'copilot-fan', __typename: 'User' }
        }
      ]
    }),
    NOW
  )
  assert.equal(requested.copilot.pendingMinutes, null)
  const bot = [
    review(`${COPILOT}[bot]`, HEAD, 5, {
      author: { login: `${COPILOT}[bot]`, __typename: 'Bot' }
    })
  ]
  assert.equal(assess(pr({ reviews: bot }), NOW).state, 'SETTLED')
})

test('a connection longer than one page is never reported as clear', () => {
  const moreThreads = pr({ reviews: [review(COPILOT, HEAD, 5)] })
  moreThreads.reviewThreads.pageInfo = { hasNextPage: true }
  assert.equal(assess(moreThreads, NOW).state, 'INCOMPLETE')
  const moreReviews = pr({ reviews: [review(COPILOT, HEAD, 5)] })
  moreReviews.reviews.pageInfo = { hasPreviousPage: true }
  assert.equal(assess(moreReviews, NOW).state, 'INCOMPLETE')
})

test('arguments are validated before anything reaches the shell or GitHub', () => {
  assert.deepEqual(
    parseArgs([
      '--repo',
      'DEFRA/ai-platform-agents',
      '--pr',
      '12',
      '--wait',
      '10',
      '--json'
    ]),
    {
      repo: 'DEFRA/ai-platform-agents',
      pr: 12,
      wait: 10,
      json: true
    }
  )
  assert.throws(
    () => parseArgs(['--repo', 'DEFRA/x;rm', '--pr', '1']),
    /--repo/
  )
  assert.throws(() => parseArgs(['--pr', '1']), /--repo/)
  assert.throws(() => parseArgs(['--repo', 'DEFRA/x', '--pr', 'one']), /--pr/)
  assert.throws(
    () => parseArgs(['--repo', 'DEFRA/x', '--pr', '1', '--wait', '-5']),
    /--wait/
  )
})

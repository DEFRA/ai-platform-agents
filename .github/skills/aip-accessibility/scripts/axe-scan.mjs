#!/usr/bin/env node
// Scans pages with axe (WCAG 2.2 A and AA tags) plus reflow and no-JavaScript checks; prints a compact result.
// Usage: node axe-scan.mjs <url> [<url> ...] [--no-js] [--out <file.json>]
// Uses Playwright and @axe-core/playwright installed in ai-platform-discovery-docs (or AIP_AXE_FROM=<package dir>).
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const REFLOW_WIDTH = 320
const TIMEOUT_MS = 30_000

/**
 * Summarises axe violations as one line each, most severe first.
 * @param {Array<{ id: string, impact: string, help: string, nodes: Array<{ target: string[] }> }>} violations
 * @returns {string[]}
 */
export function summariseViolations(violations) {
  const order = ['critical', 'serious', 'moderate', 'minor']
  return [...violations]
    .sort((a, b) => order.indexOf(a.impact) - order.indexOf(b.impact))
    .map(
      (v) =>
        `${v.impact ?? 'unknown'} ${v.id}: ${v.help} (${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target?.join(' ') ?? '?'})`
    )
}

function loadTools() {
  const from =
    process.env.AIP_AXE_FROM ??
    resolve(here, '../../../../../ai-platform-discovery-docs')
  const require = createRequire(join(from, 'package.json'))
  const axe = require('@axe-core/playwright')
  return {
    chromium: require('playwright').chromium,
    AxeBuilder: axe.AxeBuilder ?? axe.default
  }
}

// Axe needs JavaScript in the page, so "no JavaScript" blocks the site's own scripts instead of disabling JS.
async function blockSiteScripts(page) {
  await page.route('**/*', async (route) => {
    const type = route.request().resourceType()
    if (type === 'script') return route.abort()
    if (type !== 'document' || !/^https?:/.test(route.request().url()))
      return route.continue()
    const response = await route.fetch()
    const body = (await response.text())
      .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replaceAll(/<\/?noscript\b[^>]*>/gi, '')
    return route.fulfill({ response, body })
  })
}

async function scan(browser, AxeBuilder, url, javaScriptEnabled) {
  const context = await browser.newContext()
  context.setDefaultTimeout(TIMEOUT_MS)
  const page = await context.newPage()
  if (!javaScriptEnabled) await blockSiteScripts(page)
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT_MS
  })
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  await page.setViewportSize({ width: REFLOW_WIDTH, height: 800 })
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth
  )
  const title = await page.title()
  await context.close()
  return {
    url,
    status: response?.status(),
    title,
    violations,
    reflow: scrollWidth <= REFLOW_WIDTH
  }
}

/**
 * Parses CLI arguments.
 * @param {string[]} args Arguments after the script path.
 * @returns {{ urls: string[], out: string | null, javaScriptEnabled: boolean }}
 */
export function parseArgs(args) {
  const outIndex = args.indexOf('--out')
  const out = outIndex > -1 ? (args[outIndex + 1] ?? null) : null
  const urls = args.filter(
    (arg, i) => !arg.startsWith('--') && (outIndex === -1 || i !== outIndex + 1)
  )
  return { urls, out, javaScriptEnabled: !args.includes('--no-js') }
}

/**
 * Scans the URLs in parallel in one browser.
 * @param {string[]} urls Pages to scan.
 * @param {{ javaScriptEnabled?: boolean }} [options]
 * @returns {Promise<Array<{ url: string, status?: number, title: string, violations: object[], reflow: boolean }>>}
 */
export async function scanUrls(urls, { javaScriptEnabled = true } = {}) {
  const { chromium, AxeBuilder } = loadTools()
  const browser = await chromium.launch()
  try {
    return await Promise.all(
      urls.map((url) => scan(browser, AxeBuilder, url, javaScriptEnabled))
    )
  } finally {
    await browser.close()
  }
}

/**
 * Formats scan results as one line per page plus one per violation.
 * @param {Awaited<ReturnType<typeof scanUrls>>} results
 * @returns {string}
 */
export function formatResults(results) {
  return results
    .flatMap((r) => [
      `${r.violations.length ? 'FAIL' : 'PASS'} ${r.url} [${r.status}] "${r.title}" reflow@320px ${r.reflow ? 'ok' : 'FAIL'}`,
      ...summariseViolations(r.violations).map((line) => `     ${line}`)
    ])
    .join('\n')
}

/**
 * Runs the scan for CLI arguments and writes the summary.
 * @param {string[]} args CLI arguments.
 * @param {(text: string) => void} [write] Output sink.
 * @returns {Promise<number>} Exit code: 1 when any page has a violation or fails reflow.
 */
export async function cli(args, write = (text) => process.stdout.write(text)) {
  const { urls, out, javaScriptEnabled } = parseArgs(args)
  if (!urls.length) throw new Error('Give at least one URL')
  const results = await scanUrls(urls, { javaScriptEnabled })
  write(`${formatResults(results)}\n`)
  if (out) writeFileSync(out, JSON.stringify(results, null, 2))
  return results.some((r) => r.violations.length || !r.reflow) ? 1 : 0
}

const invoked = process.argv[1] ? resolve(process.argv[1]).toLowerCase() : ''
if (invoked === fileURLToPath(import.meta.url).toLowerCase()) {
  try {
    process.exitCode = await cli(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`axe-scan: ${error.message}\n`)
    process.exitCode = 2
  }
}

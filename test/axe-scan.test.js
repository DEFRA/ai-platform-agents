import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  cli,
  formatResults,
  parseArgs,
  scanUrls,
  summariseViolations
} from '../.github/skills/aip-accessibility/scripts/axe-scan.mjs'

const toolsFrom =
  process.env.AIP_AXE_FROM ??
  fileURLToPath(new URL('../../ai-platform-discovery-docs', import.meta.url))
const toolsDir = join(toolsFrom, 'node_modules/@axe-core/playwright')
const browserTestsRequired = process.env.AIP_REQUIRE_BROWSER_TESTS === '1'

test('browser test prerequisites are installed when required', () => {
  if (browserTestsRequired)
    assert.ok(existsSync(toolsDir), `missing ${toolsDir}`)
})

test(
  'scans a real page and reports violations, reflow and no-JavaScript results',
  {
    skip:
      !browserTestsRequired &&
      !existsSync(toolsDir) &&
      'needs ai-platform-discovery-docs dependencies or AIP_AXE_FROM'
  },
  async () => {
    const html =
      '<!doctype html><html lang="en"><head><title>Home</title></head><body><main><h1>Hi</h1>' +
      '<noscript><img src="nojs.png"></noscript>' +
      '<script>document.querySelector("main").insertAdjacentHTML("beforeend", "<img src=js.png>")</script>' +
      '</main></body></html>'
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end(html)
    })
    await new Promise((resolve) => server.listen(0, resolve))
    const url = `http://localhost:${server.address().port}/`
    try {
      const [withJs] = await scanUrls([url])
      assert.equal(withJs.title, 'Home')
      assert.equal(withJs.reflow, true)
      assert.deepEqual(
        withJs.violations.map((v) => v.id),
        ['image-alt']
      )
      assert.match(withJs.violations[0].nodes[0].html, /js\.png/)
      assert.match(
        formatResults([withJs]),
        /^FAIL http:\/\/localhost:\d+\/ \[200\] "Home" reflow@320px ok\n {5}critical image-alt/
      )

      const out = join(tmpdir(), `aip-axe-${process.pid}.json`)
      let written = ''
      const code = await cli([url, '--no-js', '--out', out], (text) => {
        written += text
      })
      assert.equal(code, 1)
      assert.match(written, /critical image-alt/)
      const [withoutJs] = JSON.parse(readFileSync(out, 'utf8'))
      assert.match(withoutJs.violations[0].nodes[0].html, /nojs\.png/)
    } finally {
      server.close()
    }
  }
)

test('refuses to run without a URL', async () => {
  await assert.rejects(cli([]), /Give at least one URL/)
})

test('formats a clean page as one PASS line', () => {
  const line = formatResults([
    {
      url: 'http://a',
      status: 200,
      title: 'Home',
      violations: [],
      reflow: true
    }
  ])
  assert.equal(line, 'PASS http://a [200] "Home" reflow@320px ok')
})

test('labels a page FAIL when reflow fails even without violations', () => {
  const line = formatResults([
    {
      url: 'http://a',
      status: 200,
      title: 'Home',
      violations: [],
      reflow: false
    }
  ])
  assert.equal(line, 'FAIL http://a [200] "Home" reflow@320px FAIL')
})

test('keeps every URL when no output file is given', () => {
  assert.deepEqual(parseArgs(['http://a', 'http://b']), {
    urls: ['http://a', 'http://b'],
    out: null,
    javaScriptEnabled: true
  })
})

test('separates the output file and the no-JavaScript flag from URLs', () => {
  assert.deepEqual(parseArgs(['--out', 'r.json', 'http://a', '--no-js']), {
    urls: ['http://a'],
    out: 'r.json',
    javaScriptEnabled: false
  })
})

test('summarises violations most severe first', () => {
  const lines = summariseViolations([
    {
      id: 'region',
      impact: 'moderate',
      help: 'Content in landmarks',
      nodes: [{ target: ['div'] }]
    },
    {
      id: 'color-contrast',
      impact: 'serious',
      help: 'Contrast',
      nodes: [{ target: ['a.x'] }, { target: ['a.y'] }]
    }
  ])
  assert.equal(
    lines[0],
    'serious color-contrast: Contrast (2 node(s), e.g. a.x)'
  )
  assert.match(lines[1], /^moderate region/)
})

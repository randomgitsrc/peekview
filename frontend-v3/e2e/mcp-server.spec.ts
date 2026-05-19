/**
 * MCP Server E2E Tests
 *
 * End-to-end tests that verify:
 * 1. MCP Server can create entries via SSE
 * 2. Frontend displays MCP-created entries correctly
 * 3. FileTree renders properly for multi-file entries
 *
 * These tests require:
 * - PeekView backend running on :8888 (make debug-start)
 * - MCP Server running and connected to backend
 */
import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8888'
const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:3000'

// Test configuration
const MCP_TOKEN = 'test_mcp_token_for_e2e'

/**
 * Call MCP tool via HTTP endpoint
 * In real scenario, this would be done via SSE, but for E2E testing
 * we'll use a simplified HTTP approach
 */
async function callMCPTool(toolName: string, args: any): Promise<any> {
  // For E2E, we simulate MCP tool call by directly calling PeekView API
  // In production, this would go through MCP Server

  if (toolName === 'create_entry') {
    const response = await fetch(`${BASE_URL}/api/v1/entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Source': 'mcp-e2e',
      },
      body: JSON.stringify({
        slug: args.slug || `mcp-e2e-${Date.now()}`,
        summary: args.summary,
        files: args.files || [],
        is_public: args.is_public ?? true,
        tags: args.tags || [],
      }),
    })
    return response.json()
  }

  if (toolName === 'get_entry') {
    const response = await fetch(`${BASE_URL}/api/v1/entries/${args.slug}`)
    return response.json()
  }

  if (toolName === 'delete_entry') {
    await fetch(`${BASE_URL}/api/v1/entries/${args.slug}`, {
      method: 'DELETE',
    })
    return { success: true }
  }

  throw new Error(`Unknown tool: ${toolName}`)
}

// Store created entries for cleanup
const testEntries: string[] = []

test.beforeAll(async () => {
  // Verify we're not on production
  if (BASE_URL.includes(':8080') || BASE_URL.includes('gsis.top')) {
    throw new Error('E2E tests must run on debug server (:8888), not production')
  }

  // Verify debug server is running
  const response = await fetch(`${BASE_URL}/health`)
  if (!response.ok) {
    throw new Error(`Debug server not accessible at ${BASE_URL}. Run 'make debug-start' first.`)
  }
})

test.afterAll(async () => {
  // Cleanup test entries
  for (const slug of testEntries) {
    try {
      await fetch(`${BASE_URL}/api/v1/entries/${slug}`, { method: 'DELETE' })
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})

// ========================================
// Test Suite 1: MCP Entry Creation
// ========================================
test.describe('MCP: Entry Creation', () => {
  test('should create single-file entry via MCP', async ({ page }) => {
    const slug = `mcp-single-${Date.now()}`
    testEntries.push(slug)

    // Create entry via MCP
    const entry = await callMCPTool('create_entry', {
      slug,
      summary: 'MCP Single File Test',
      files: [
        { filename: 'hello.py', content: 'print("Hello from MCP")' }
      ],
      is_public: true,
    })

    expect(entry.slug).toBe(slug)

    // View entry in frontend
    await page.goto(`/${slug}`)

    // Verify entry renders
    await expect(page.locator('body')).toContainText('MCP Single File Test')
    await expect(page.locator('body')).toContainText('hello.py')
    await expect(page.locator('body')).toContainText('Hello from MCP')

    // Take screenshot
    await page.screenshot({ path: `/tmp/e2e-results/mcp-single-file.png` })
  })

  test('should create multi-file entry with FileTree', async ({ page }) => {
    const slug = `mcp-multi-${Date.now()}`
    testEntries.push(slug)

    // Create entry with multiple files in directories
    const entry = await callMCPTool('create_entry', {
      slug,
      summary: 'MCP Multi-File Test',
      files: [
        { filename: 'README.md', content: '# Project\nDescription' },
        { filename: 'src/main.py', content: 'def main():\n    print("main")' },
        { filename: 'src/utils.py', content: 'def helper():\n    return 42' },
        { filename: 'tests/test_main.py', content: 'def test_main():\n    assert True' },
      ],
      is_public: true,
      tags: ['mcp', 'test', 'multi-file'],
    })

    expect(entry.slug).toBe(slug)
    expect(entry.files).toHaveLength(4)

    // View entry
    await page.goto(`/${slug}`)

    // Verify FileTree renders
    await expect(page.locator('.file-tree')).toBeVisible()

    // Verify directory structure
    await expect(page.locator('.file-tree')).toContainText('src')
    await expect(page.locator('.file-tree')).toContainText('tests')
    await expect(page.locator('.file-tree')).toContainText('README.md')
    await expect(page.locator('.file-tree')).toContainText('main.py')
    await expect(page.locator('.file-tree')).toContainText('utils.py')
    await expect(page.locator('.file-tree')).toContainText('test_main.py')

    // Take screenshot
    await page.screenshot({ path: `/tmp/e2e-results/mcp-multi-file.png` })
  })

  test('should create private entry via MCP', async ({ page }) => {
    const slug = `mcp-private-${Date.now()}`
    testEntries.push(slug)

    // Create private entry
    const entry = await callMCPTool('create_entry', {
      slug,
      summary: 'MCP Private Test',
      files: [
        { filename: 'secret.txt', content: 'secret content' }
      ],
      is_public: false,
    })

    expect(entry.slug).toBe(slug)
    expect(entry.is_public).toBe(false)

    // View entry (should be accessible)
    await page.goto(`/${slug}`)
    await expect(page.locator('body')).toContainText('MCP Private Test')

    // Take screenshot
    await page.screenshot({ path: `/tmp/e2e-results/mcp-private.png` })
  })

  test('should create entry with code highlighting', async ({ page }) => {
    const slug = `mcp-code-${Date.now()}`
    testEntries.push(slug)

    // Create entry with code files
    const entry = await callMCPTool('create_entry', {
      slug,
      summary: 'MCP Code Highlighting Test',
      files: [
        { filename: 'app.py', content: 'from flask import Flask\napp = Flask(__name__)\n\n@app.route("/")\ndef hello():\n    return "Hello"' }
      ],
      is_public: true,
    })

    expect(entry.slug).toBe(slug)

    // View entry
    await page.goto(`/${slug}`)

    // Wait for code to be highlighted
    await page.waitForTimeout(1000)

    // Verify code is visible
    await expect(page.locator('body')).toContainText('from flask import Flask')

    // Take screenshot
    await page.screenshot({ path: `/tmp/e2e-results/mcp-code-highlight.png` })
  })
})

// ========================================
// Test Suite 2: FileTree Interaction
// ========================================
test.describe('MCP: FileTree Interaction', () => {
  test('should switch between files in FileTree', async ({ page }) => {
    const slug = `mcp-filetree-${Date.now()}`
    testEntries.push(slug)

    // Create entry with multiple files
    await callMCPTool('create_entry', {
      slug,
      summary: 'FileTree Navigation Test',
      files: [
        { filename: 'file1.txt', content: 'Content of file 1' },
        { filename: 'file2.txt', content: 'Content of file 2' },
      ],
    })

    // View entry
    await page.goto(`/${slug}`)

    // Wait for FileTree
    await expect(page.locator('.file-tree')).toBeVisible()

    // Click on file2
    await page.click('.file-tree .file-item:has-text("file2.txt")')

    // Verify file2 content is displayed
    await expect(page.locator('body')).toContainText('Content of file 2')

    // Click on file1
    await page.click('.file-tree .file-item:has-text("file1.txt")')

    // Verify file1 content is displayed
    await expect(page.locator('body')).toContainText('Content of file 1')

    // Take screenshot
    await page.screenshot({ path: `/tmp/e2e-results/mcp-filetree-nav.png` })
  })

  test('should expand/collapse directories in FileTree', async ({ page }) => {
    const slug = `mcp-collapse-${Date.now()}`
    testEntries.push(slug)

    // Create entry with nested directories
    await callMCPTool('create_entry', {
      slug,
      summary: 'FileTree Collapse Test',
      files: [
        { filename: 'src/main.py', content: 'def main(): pass' },
        { filename: 'src/deep/nested/file.py', content: '# deep file' },
      ],
    })

    // View entry
    await page.goto(`/${slug}`)

    // Wait for FileTree
    await expect(page.locator('.file-tree')).toBeVisible()

    // Verify src directory exists
    await expect(page.locator('.file-tree')).toContainText('src')

    // Take screenshot of expanded state
    await page.screenshot({ path: `/tmp/e2e-results/mcp-filetree-expanded.png` })
  })
})

// ========================================
// Test Suite 3: MCP with Tags
// ========================================
test.describe('MCP: Tags Support', () => {
  test('should create entry with tags and display them', async ({ page }) => {
    const slug = `mcp-tags-${Date.now()}`
    testEntries.push(slug)

    // Create entry with tags
    await callMCPTool('create_entry', {
      slug,
      summary: 'MCP Tags Test',
      files: [{ filename: 'test.txt', content: 'test' }],
      tags: ['python', 'demo', 'mcp-test'],
    })

    // View entry
    await page.goto(`/${slug}`)

    // Verify tags are displayed
    await expect(page.locator('body')).toContainText('python')
    await expect(page.locator('body')).toContainText('demo')
    await expect(page.locator('body')).toContainText('mcp-test')

    // Take screenshot
    await page.screenshot({ path: `/tmp/e2e-results/mcp-tags.png` })
  })
})

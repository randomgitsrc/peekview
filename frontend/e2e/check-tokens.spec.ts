import { test, expect } from '@playwright/test'

test('check syntax token colors', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/lu4prg')
  await page.waitForTimeout(3000)
  
  // Get all spans and their colors
  const tokens = await page.evaluate(() => {
    const spans = document.querySelectorAll('.code-content .shiki span')
    return Array.from(spans).map(span => ({
      text: span.textContent,
      color: window.getComputedStyle(span).color
    }))
  })
  
  console.log('=== Tokens ===')
  tokens.forEach(t => console.log(`${t.text}: ${t.color}`))
  
  // Check different token types
  const defToken = tokens.find(t => t.text === 'def')
  const returnToken = tokens.find(t => t.text === 'return')
  const printToken = tokens.find(t => t.text?.includes('print'))
  const stringToken = tokens.find(t => t.text?.includes('Hello'))
  
  console.log('\n=== Token Colors ===')
  console.log('def:', defToken?.color)
  console.log('return:', returnToken?.color)  
  console.log('print:', printToken?.color)
  console.log('string:', stringToken?.color)
})

test('theme switch changes colors', async ({ page }) => {
  await page.goto('http://127.0.0.1:8080/lu4prg')
  await page.waitForTimeout(2000)
  
  // Get dark theme color
  const darkColor = await page.evaluate(() => {
    const span = document.querySelector('.code-content .shiki span')
    return span ? window.getComputedStyle(span).color : null
  })
  console.log('Dark theme color:', darkColor)
  
  // Switch to light theme
  await page.locator('.action-btn').filter({hasText: /Light|Dark/}).click()
  await page.waitForTimeout(500)
  
  // Get light theme color
  const lightColor = await page.evaluate(() => {
    const span = document.querySelector('.code-content .shiki span')
    return span ? window.getComputedStyle(span).color : null
  })
  console.log('Light theme color:', lightColor)
  
  await page.screenshot({path: '/tmp/light_theme.png'})
})

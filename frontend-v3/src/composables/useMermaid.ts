import mermaid from 'mermaid'
import { ref } from 'vue'

const MERMAID_TIMEOUT = 5000 // 5 seconds

export function useMermaid() {
  const isInitialized = ref(false)

  async function init(theme: 'dark' | 'light') {
    if (isInitialized.value) return

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    })

    isInitialized.value = true
  }

  async function render(id: string, code: string, theme: 'dark' | 'light'): Promise<string> {
    await init(theme)

    // Update theme if changed
    mermaid.initialize({ theme: theme === 'dark' ? 'dark' : 'default' })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Mermaid render timeout'))
      }, MERMAID_TIMEOUT)

      try {
        mermaid.render(`mermaid-${id}`, code).then(({ svg }) => {
          clearTimeout(timeout)
          resolve(svg)
        }).catch((err) => {
          clearTimeout(timeout)
          reject(err)
        })
      } catch (err) {
        clearTimeout(timeout)
        reject(err)
      }
    })
  }

  return { render }
}

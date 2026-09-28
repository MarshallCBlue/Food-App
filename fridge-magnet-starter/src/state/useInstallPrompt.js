import { useEffect, useState } from 'react'
import { getDeferredInstallPrompt, onInstallPromptChange, isStandalone, getPlatform } from '../lib/installPrompt'

// Bridges the module-level beforeinstallprompt listener (registered once,
// outside React, in main.jsx) into ordinary component state.
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(getDeferredInstallPrompt)

  useEffect(() => onInstallPromptChange(setPrompt), [])

  return {
    platform: getPlatform(),
    standalone: isStandalone(),
    canPromptInstall: Boolean(prompt),
    promptInstall: async () => {
      if (!prompt) return null
      prompt.prompt()
      const choice = await prompt.userChoice
      setPrompt(null)
      return choice.outcome
    },
  }
}

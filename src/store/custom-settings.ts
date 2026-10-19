import { useStorage } from '@/composables/use-storage'

const LEGACY_CUSTOM_IP_API_KEY = 'config/custom-ip-api-key'
const CUSTOM_IP_API_KEY = 'secret/custom-ip-api-key'

// Kept outside the `config/` prefix so the key is not included in exported or synced settings
try {
  const legacy = localStorage.getItem(LEGACY_CUSTOM_IP_API_KEY)

  if (legacy !== null) {
    if (localStorage.getItem(CUSTOM_IP_API_KEY) === null) {
      localStorage.setItem(CUSTOM_IP_API_KEY, legacy)
    }
    localStorage.removeItem(LEGACY_CUSTOM_IP_API_KEY)
  }
} catch {
  // storage unavailable
}

export const customIPAPIKey = useStorage(CUSTOM_IP_API_KEY, '')

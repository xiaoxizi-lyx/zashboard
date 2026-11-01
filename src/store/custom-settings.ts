import { useStorage } from '@/composables/use-storage'
import { computed } from 'vue'

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

// Not a secret, so it is exported and synced like other settings
export const customIPAPIBaseURL = useStorage('config/custom-ip-api-base-url', '')

// No address is built in: the custom API is used only when both its address and key are filled in
export const customIPAPIEnabled = computed(
  () => !!customIPAPIBaseURL.value.trim() && !!customIPAPIKey.value,
)

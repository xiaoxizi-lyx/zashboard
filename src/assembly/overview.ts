import type { HonkStats } from '@/types'
import { shallowRef } from 'vue'
import { can } from './backend'
import { driver } from './driver'

export const trafficStream = () => driver().metrics.traffic()

export const memoryStream = () => driver().metrics.memory()

export const honkStats = shallowRef<HonkStats>()

const POLL_INTERVAL = 5000

let timer: ReturnType<typeof setInterval> | undefined

export const fetchHonkStats = async () => {
  if (!can('runtimeStats')) {
    honkStats.value = undefined
    return
  }

  try {
    honkStats.value = await driver().metrics.fetchRuntimeStats()
  } catch {
    honkStats.value = undefined
  }
}

export const startHonkStats = () => {
  if (timer) return

  fetchHonkStats()
  timer = setInterval(fetchHonkStats, POLL_INTERVAL)
}

export const stopHonkStats = () => {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
  honkStats.value = undefined
}

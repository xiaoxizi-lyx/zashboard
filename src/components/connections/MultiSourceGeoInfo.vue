<template>
  <div
    v-if="geoSources.length"
    class="border-base-content/8 bg-base-200/40 rounded-lg border p-3 text-sm"
  >
    <div class="text-primary mb-2 font-semibold">{{ $t('geoInfo') }}</div>
    <div class="flex flex-col gap-2">
      <div
        v-for="source in geoSources"
        :key="source.name"
        class="border-base-content/6 rounded-md border p-2"
      >
        <div class="text-base-content/50 mb-1.5 flex items-center gap-1 text-xs font-medium">
          <MapPinIcon class="h-3 w-3 shrink-0" />
          {{ source.name }}
          <span
            v-if="source.loading"
            class="loading loading-spinner loading-xs"
          />
        </div>
        <div
          v-if="source.info"
          class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs"
        >
          <div class="text-base-content/50">{{ $t('geoCountry') }}</div>
          <div>{{ source.info.country || '-' }}</div>
          <div class="text-base-content/50">{{ $t('geoRegion') }}</div>
          <div>{{ source.info.region || '-' }}</div>
          <div class="text-base-content/50">{{ $t('geoCity') }}</div>
          <div>{{ source.info.city || '-' }}</div>
          <div class="text-base-content/50">ASN</div>
          <div :class="source.asnMismatch ? 'text-error font-semibold' : ''">
            {{ source.info.asn ? `AS${source.info.asn}` : '-' }}
          </div>
          <div class="text-base-content/50">{{ $t('geoOrg') }}</div>
          <div>{{ source.info.organization || '-' }}</div>
        </div>
      </div>
    </div>
  </div>

  <div
    v-for="section in customSections"
    :key="section.title"
    class="border-base-content/8 bg-base-200/40 rounded-lg border p-3 text-sm"
  >
    <div class="text-primary mb-2 font-semibold">{{ section.title }}</div>
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      <template
        v-for="row in section.rows"
        :key="row.label"
      >
        <div class="text-base-content/50">{{ row.label }}</div>
        <div class="min-w-0 break-all">{{ row.value }}</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IPInfo } from '@/api/geoip'
import {
  customAPIResponseToIPInfo,
  getIPFromCustomAPI,
  getPublicGeoSourceInfo,
  PUBLIC_GEO_SOURCES,
  type CustomIPAPIResponse,
} from '@/api/geoip-custom'
import { LANG } from '@/constant'
import { customIPAPIKey } from '@/store/custom-settings'
import { language } from '@/store/settings'
import { MapPinIcon } from '@heroicons/vue/24/outline'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface GeoSource {
  name: string
  loading: boolean
  info: IPInfo | null
}

interface Row {
  label: string
  value: string
}

const props = defineProps<{
  ip: string
}>()

const { t } = useI18n()

const useChinese = computed(() => language.value === LANG.ZH_CN || language.value === LANG.ZH_TW)

const custom = ref<CustomIPAPIResponse | null>(null)
const customLoading = ref(false)
const publicSources = ref<GeoSource[]>([])

let lookupId = 0

watch(
  () => props.ip,
  (ip) => {
    const id = ++lookupId
    const isCurrent = () => id === lookupId

    custom.value = null
    customLoading.value = !!customIPAPIKey.value

    if (customLoading.value) {
      getIPFromCustomAPI(ip)
        .then((res) => {
          if (isCurrent()) custom.value = res
        })
        .catch(() => {})
        .finally(() => {
          if (isCurrent()) customLoading.value = false
        })
    }

    publicSources.value = PUBLIC_GEO_SOURCES.map((api) => ({
      name: api,
      loading: true,
      info: null,
    }))

    // Each source renders as soon as it resolves instead of waiting for the slowest one
    publicSources.value.forEach((source, index) => {
      getPublicGeoSourceInfo(ip, PUBLIC_GEO_SOURCES[index]!)
        .then((info) => {
          if (isCurrent()) source.info = info
        })
        .catch(() => {})
        .finally(() => {
          if (isCurrent()) source.loading = false
        })
    })
  },
  { immediate: true },
)

// ASN that strictly outnumbers every other ASN, or '' when there is no clear winner
const pluralityASN = (asns: string[]) => {
  const counts = new Map<string, number>()

  for (const asn of asns) {
    counts.set(asn, (counts.get(asn) ?? 0) + 1)
  }

  const [first, second] = [...counts.entries()].sort((a, b) => b[1] - a[1])

  if (!first || first[1] < 2 || (second && second[1] === first[1])) {
    return ''
  }

  return first[0]
}

// Hide sources that failed; keep pending ones visible with a spinner
const geoSources = computed(() => {
  const sources: GeoSource[] = []

  if (customLoading.value || custom.value) {
    sources.push({
      name: t('customAPI'),
      loading: customLoading.value,
      info: custom.value ? customAPIResponseToIPInfo(custom.value, useChinese.value) : null,
    })
  }

  sources.push(...publicSources.value.filter((source) => source.loading || source.info))

  const majorityASN = pluralityASN(sources.map((source) => source.info?.asn ?? '').filter(Boolean))

  return sources.map((source) => ({
    ...source,
    asnMismatch: !!majorityASN && !!source.info?.asn && source.info.asn !== majorityASN,
  }))
})

// Skip empty values and placeholders the upstream API returns for paid fields
const isDisplayable = (val: unknown): val is string | number => {
  if (val === null || val === undefined || val === '') return false
  if (typeof val === 'string' && val.toLowerCase().includes('business plan required')) return false
  return true
}

const pushValue = (rows: Row[], label: string, val: unknown) => {
  if (isDisplayable(val)) rows.push({ label, value: String(val) })
}

const pushBool = (rows: Row[], label: string, val: boolean | undefined) => {
  if (typeof val === 'boolean') rows.push({ label, value: val ? '✅' : '❌' })
}

const extraGeoRows = (geo: CustomIPAPIResponse['geo'], cn: boolean) => {
  const rows: Row[] = []
  const continent = cn ? geo.continent : geo.continent_en

  pushValue(rows, t('geoDistrict'), cn ? geo.district : geo.district_en)
  if (continent) {
    rows.push({
      label: t('geoContinent'),
      value: geo.continent_code ? `${continent} (${geo.continent_code})` : continent,
    })
  }
  pushValue(rows, t('geoCarrier'), geo.carrier)
  pushValue(rows, 'ISP', geo.isp)
  pushValue(rows, t('geoDomain'), geo.domain)
  pushValue(rows, 'RIR', geo.rir)
  pushValue(rows, t('geoTimezone'), geo.timezone)
  if (geo.latitude && geo.longitude) {
    rows.push({ label: t('geoCoordinates'), value: `${geo.latitude}, ${geo.longitude}` })
  }
  pushBool(rows, 'Anycast', geo.is_anycast)

  return rows
}

const privacyRows = (privacy: NonNullable<CustomIPAPIResponse['privacy']>) => {
  const rows: Row[] = []

  pushValue(rows, t('privacyType'), privacy.type)
  pushBool(rows, t('privacyDatacenter'), privacy.is_datacenter)
  pushBool(rows, t('privacyAnonymous'), privacy.is_anonymous)
  pushBool(rows, 'Tor', privacy.is_tor)
  pushBool(rows, 'iCloud Relay', privacy.is_icloud_relay)
  pushBool(rows, t('privacyKnownBot'), privacy.is_known_bot)

  return rows
}

const threatRows = (threat: NonNullable<CustomIPAPIResponse['threat_intelligence']>) => {
  const rows: Row[] = []

  pushBool(rows, t('threatIsThreat'), threat.is_threat)
  pushValue(rows, t('threatFirstSeen'), threat.first_seen)
  pushValue(rows, t('threatLastSeen'), threat.last_seen)
  pushValue(rows, t('threatRecentAbuse'), threat.recent_abuse?.join(', '))
  pushValue(rows, t('threatHistoryAbuse'), threat.history_abuse?.join(', '))

  return rows
}

const proxyIntelRows = (proxy: NonNullable<CustomIPAPIResponse['proxy_intelligence']>) => {
  const rows: Row[] = []

  pushBool(rows, t('proxyIsProxy'), proxy.is_proxy)
  pushValue(rows, t('proxySources'), proxy.source_count)
  pushValue(rows, t('proxyActiveDays7d'), proxy.active_days_7d)
  pushValue(rows, t('proxyActiveDays30d'), proxy.active_days_30d)
  pushValue(rows, t('proxyActiveDays90d'), proxy.active_days_90d)
  pushValue(rows, t('proxyTotalDaysSeen'), proxy.num_days_seen)
  pushValue(rows, t('proxyFirstSeen'), proxy.first_seen)
  pushValue(rows, t('proxyLastSeen'), proxy.last_seen)

  return rows
}

const customSections = computed(() => {
  const data = custom.value

  if (!data) return []

  return [
    { title: t('extraGeoInfo'), rows: extraGeoRows(data.geo, useChinese.value) },
    { title: t('privacyInfo'), rows: data.privacy ? privacyRows(data.privacy) : [] },
    {
      title: t('threatIntel'),
      rows: data.threat_intelligence ? threatRows(data.threat_intelligence) : [],
    },
    {
      title: t('proxyIntel'),
      rows: data.proxy_intelligence ? proxyIntelRows(data.proxy_intelligence) : [],
    },
  ].filter((section) => section.rows.length)
})
</script>

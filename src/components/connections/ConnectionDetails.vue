<template>
  <DialogWrapper
    v-model="connectionDetailModalShow"
    :title="$t('connectionDetails')"
    :no-padding="true"
    box-class="max-w-160"
  >
    <template #title-right>
      <button
        v-if="sourceIP"
        type="button"
        class="btn btn-ghost btn-xs absolute top-2 right-10"
        :title="$t('sourceIPLabels')"
        @click="sourceIPDialogVisible = true"
      >
        <PencilSquareIcon class="h-4 w-4" />
        <span>{{ $t('sourceIPLabels') }}</span>
      </button>
    </template>

    <div class="flex h-[70dvh] max-h-[70dvh] flex-col overflow-hidden">
      <div class="m-2 mb-0 shrink-0">
        <SegmentedControl
          block
          :model-value="activeTab"
          :options="tabOptions"
          @update:model-value="activeTab = $event as TabType"
        />
      </div>

      <!-- 概览:美化后的分组展示 -->
      <div
        v-if="activeTab === 'overview'"
        class="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        <template
          v-for="section in sections"
          :key="section.id"
        >
          <div class="border-base-content/8 bg-base-200/40 rounded-lg border p-3">
            <div class="text-primary mb-2 text-sm font-semibold">{{ section.title }}</div>
            <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <template
                v-for="row in section.rows"
                :key="row.label"
              >
                <div class="text-base-content/60">{{ row.label }}</div>
                <div class="min-w-0 break-all">{{ row.value }}</div>
              </template>
            </div>
          </div>

          <!-- 多源 IP 信息对比区域 -->
          <template v-if="section.id === 'sourceAndDestination' && showGeoInfo">
            <!-- 各 API 对比卡片 -->
            <div class="border-base-content/8 bg-base-200/40 rounded-lg border p-3 text-sm">
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
                  </div>
                  <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
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

            <!-- 自定义 API 额外地理信息 -->
            <div
              v-if="multiDetails?.custom && customExtraGeoRows.length"
              class="border-base-content/8 bg-base-200/40 rounded-lg border p-3 text-sm"
            >
              <div class="text-primary mb-2 font-semibold">{{ $t('extraGeoInfo') }}</div>
              <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <template
                  v-for="row in customExtraGeoRows"
                  :key="row.label"
                >
                  <div class="text-base-content/50">{{ row.label }}</div>
                  <div>{{ row.value }}</div>
                </template>
              </div>
            </div>

            <!-- 隐私信息 -->
            <div
              v-if="multiDetails?.custom && privacyRows.length"
              class="border-base-content/8 bg-base-200/40 rounded-lg border p-3 text-sm"
            >
              <div class="text-primary mb-2 font-semibold">{{ $t('privacyInfo') }}</div>
              <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <template
                  v-for="row in privacyRows"
                  :key="row.label"
                >
                  <div class="text-base-content/50">{{ row.label }}</div>
                  <div>{{ row.value }}</div>
                </template>
              </div>
            </div>

            <!-- 威胁情报 -->
            <div
              v-if="multiDetails?.custom && threatRows.length"
              class="border-base-content/8 bg-base-200/40 rounded-lg border p-3 text-sm"
            >
              <div class="text-primary mb-2 font-semibold">{{ $t('threatIntel') }}</div>
              <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <template
                  v-for="row in threatRows"
                  :key="row.label"
                >
                  <div class="text-base-content/50">{{ row.label }}</div>
                  <div>{{ row.value }}</div>
                </template>
              </div>
            </div>

            <!-- 代理情报 -->
            <div
              v-if="multiDetails?.custom && proxyIntelRows.length"
              class="border-base-content/8 bg-base-200/40 rounded-lg border p-3 text-sm"
            >
              <div class="text-primary mb-2 font-semibold">{{ $t('proxyIntel') }}</div>
              <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <template
                  v-for="row in proxyIntelRows"
                  :key="row.label"
                >
                  <div class="text-base-content/50">{{ row.label }}</div>
                  <div>{{ row.value }}</div>
                </template>
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- 原始 JSON -->
      <div
        v-if="activeTab === 'raw'"
        class="flex-1 overflow-y-auto p-4"
      >
        <VueJsonPretty :data="infoConn">
          <template #renderNodeValue="{ node, defaultValue }">
            <template
              v-if="
                (node.path.startsWith('root.chains') || node.path.startsWith('root.chainList')) &&
                proxyMap[node.content]?.icon
              "
            >
              <span
                >"<ProxyIcon
                  :icon="proxyMap[node.content].icon"
                  class="inline-block"
                  :margin="0"
                />
                {{ node.content }}"
              </span>
            </template>
            <template v-else>
              {{ defaultValue }}
            </template>
          </template>
        </VueJsonPretty>
      </div>

      <!-- 切换代理组 -->
      <div
        v-if="proxyChainStart && activeTab === 'proxies'"
        class="flex flex-1 flex-col overflow-y-auto"
        :class="PROXIES_PARENT_CLASS"
      >
        <div class="shrink-0 p-3 pb-0">
          <ProxyChainPath
            :proxy="proxyChainStart"
            :selected="selectedProxy"
            :show-now-node="true"
            :show-latency="true"
            @update:selected="selectedProxy = $event"
          />
        </div>
        <ProxyGroupPanel :name="selectedProxy || proxyChainStart" />
      </div>
    </div>
  </DialogWrapper>

  <SourceIPLabels
    v-model="sourceIPDialogVisible"
    :show-trigger="false"
    :default-key="sourceIP"
  />
</template>

<script setup lang="ts">
import {
  customAPIResponseToIPInfo,
  getMultiSourceIPInfo,
  type IPInfo,
  type MultiSourceIPResult,
} from '@/api/geoip'
import { getConnectionDisplayValue } from '@/assembly/connections'
import { proxyMap } from '@/assembly/proxies'
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import ProxyChainPath from '@/components/common/ProxyChainPath.vue'
import SegmentedControl, { type SegmentOption } from '@/components/common/SegmentedControl.vue'
import ProxyGroupPanel from '@/components/proxies/ProxyGroupPanel.vue'
import SourceIPLabels from '@/components/settings/connections/SourceIPLabels.vue'
import { useConnections } from '@/composables/connections'
import { CONNECTIONS_TABLE_ACCESSOR_KEY, LANG } from '@/constant'
import { getConnectionChains, getConnectionSourceIP, getDestinationFromConnection } from '@/helper'
import { PROXIES_PARENT_CLASS } from '@/helper/utils'
import { language, proxyChainDirection, showFullProxyChain } from '@/store/settings'
import { MapPinIcon, PencilSquareIcon } from '@heroicons/vue/24/outline'
import * as ipaddr from 'ipaddr.js'
import { last } from 'lodash'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'
import ProxyIcon from '../proxies/ProxyIcon.vue'

const KEY = CONNECTIONS_TABLE_ACCESSOR_KEY

const { infoConn, connectionDetailModalShow } = useConnections()
const { t } = useI18n()
const multiDetails = ref<MultiSourceIPResult | null>(null)
const selectedProxy = ref('')
const sourceIPDialogVisible = ref(false)

type TabType = 'overview' | 'raw' | 'proxies'
const tabLabel: Record<TabType, string> = {
  overview: 'overview',
  raw: 'rawData',
  proxies: 'proxies',
}
const activeTab = ref<TabType>('overview')

const destinationIP = computed(() =>
  infoConn.value ? getDestinationFromConnection(infoConn.value) : undefined,
)
const sourceIP = computed(() => (infoConn.value ? getConnectionSourceIP(infoConn.value) : ''))
const isValidDestinationIP = computed(
  () => !!destinationIP.value && ipaddr.isValid(destinationIP.value),
)
const isPrivateIP = computed(() => {
  if (!isValidDestinationIP.value) {
    return false
  }

  const addr = ipaddr.parse(destinationIP.value!)
  const range = addr.range()

  return ['private', 'uniqueLocal', 'loopback', 'linkLocal'].includes(range)
})

const showGeoInfo = computed(() => {
  if (!isValidDestinationIP.value || isPrivateIP.value || !multiDetails.value) return false
  const md = multiDetails.value
  return !!(md.custom || md.ipsb || md.ipwhois || md.ipapi)
})

// Compute whether to use Chinese geo text
const useChinese = computed(() => language.value === LANG.ZH_CN || language.value === LANG.ZH_TW)

// Collect all successfully returned sources into a unified list for comparison
const geoSources = computed(() => {
  const md = multiDetails.value
  if (!md) return []

  const sources: { name: string; info: IPInfo }[] = []

  if (md.custom) {
    sources.push({ name: t('customAPI'), info: customAPIResponseToIPInfo(md.custom) })
  }
  if (md.ipsb) {
    sources.push({ name: 'ip.sb', info: md.ipsb })
  }
  if (md.ipwhois) {
    sources.push({ name: 'ipwho.is', info: md.ipwhois })
  }
  if (md.ipapi) {
    sources.push({ name: 'ipapi.is', info: md.ipapi })
  }

  // Compute ASN majority for mismatch highlighting
  const asnCounts = new Map<string, number>()
  for (const s of sources) {
    const asn = s.info.asn || ''
    if (asn) {
      asnCounts.set(asn, (asnCounts.get(asn) || 0) + 1)
    }
  }
  let majorityASN = ''
  let maxCount = 0
  for (const [asn, count] of asnCounts) {
    if (count > maxCount) {
      maxCount = count
      majorityASN = asn
    }
  }

  return sources.map((s) => ({
    ...s,
    asnMismatch: !!s.info.asn && s.info.asn !== majorityASN && sources.length > 1,
  }))
})

// Helper: check if a value is displayable (not empty, not "business plan required")
const isDisplayable = (val: unknown): val is string | number | boolean => {
  if (val === null || val === undefined || val === '') return false
  if (typeof val === 'string' && val.toLowerCase().includes('business plan required')) return false
  return true
}

const boolIcon = (val: boolean) => (val ? '✅' : '❌')

// Custom API extra geo info rows
const customExtraGeoRows = computed(() => {
  const custom = multiDetails.value?.custom
  if (!custom) return []

  const cn = useChinese.value
  const geo = custom.geo
  const rows: { label: string; value: string }[] = []

  const district = cn ? geo.district : geo.district_en
  if (district) rows.push({ label: t('geoDistrict'), value: district })

  const continent = cn ? geo.continent : geo.continent_en
  if (continent) rows.push({ label: t('geoContinent'), value: `${continent} (${geo.continent_code})` })

  if (geo.carrier) rows.push({ label: t('geoCarrier'), value: geo.carrier })
  if (geo.isp) rows.push({ label: 'ISP', value: geo.isp })
  if (geo.domain) rows.push({ label: t('geoDomain'), value: geo.domain })
  if (geo.rir) rows.push({ label: 'RIR', value: geo.rir })
  if (geo.timezone) rows.push({ label: t('geoTimezone'), value: geo.timezone })

  if (geo.longitude && geo.latitude) {
    rows.push({ label: t('geoCoordinates'), value: `${geo.latitude}, ${geo.longitude}` })
  }

  rows.push({ label: 'Anycast', value: boolIcon(geo.is_anycast) })

  return rows
})

// Privacy info rows
const privacyRows = computed(() => {
  const custom = multiDetails.value?.custom
  if (!custom) return []

  const p = custom.privacy
  const rows: { label: string; value: string }[] = []

  if (p.type) rows.push({ label: t('privacyType'), value: p.type })
  rows.push({ label: t('privacyDatacenter'), value: boolIcon(p.is_datacenter) })
  rows.push({ label: t('privacyAnonymous'), value: boolIcon(p.is_anonymous) })
  rows.push({ label: 'Tor', value: boolIcon(p.is_tor) })
  rows.push({ label: 'iCloud Relay', value: boolIcon(p.is_icloud_relay) })
  rows.push({ label: t('privacyKnownBot'), value: boolIcon(p.is_known_bot) })

  return rows
})

// Threat intelligence rows
const threatRows = computed(() => {
  const custom = multiDetails.value?.custom
  if (!custom) return []

  const ti = custom.threat_intelligence
  const rows: { label: string; value: string }[] = []

  rows.push({ label: t('threatIsThreat'), value: boolIcon(ti.is_threat) })

  if (isDisplayable(ti.first_seen)) {
    rows.push({ label: t('threatFirstSeen'), value: ti.first_seen as string })
  }
  if (isDisplayable(ti.last_seen)) {
    rows.push({ label: t('threatLastSeen'), value: ti.last_seen as string })
  }
  if (ti.recent_abuse?.length) {
    rows.push({ label: t('threatRecentAbuse'), value: ti.recent_abuse.join(', ') })
  }
  if (ti.history_abuse?.length) {
    rows.push({ label: t('threatHistoryAbuse'), value: ti.history_abuse.join(', ') })
  }

  return rows
})

// Proxy intelligence rows
const proxyIntelRows = computed(() => {
  const custom = multiDetails.value?.custom
  if (!custom) return []

  const pi = custom.proxy_intelligence
  const rows: { label: string; value: string }[] = []

  rows.push({ label: t('proxyIsProxy'), value: boolIcon(pi.is_proxy) })

  if (isDisplayable(pi.source_count)) {
    rows.push({ label: t('proxySources'), value: String(pi.source_count) })
  }
  if (isDisplayable(pi.active_days_7d)) {
    rows.push({ label: t('proxyActiveDays7d'), value: String(pi.active_days_7d) })
  }
  if (isDisplayable(pi.active_days_30d)) {
    rows.push({ label: t('proxyActiveDays30d'), value: String(pi.active_days_30d) })
  }
  if (isDisplayable(pi.active_days_90d)) {
    rows.push({ label: t('proxyActiveDays90d'), value: String(pi.active_days_90d) })
  }
  if (isDisplayable(pi.num_days_seen)) {
    rows.push({ label: t('proxyTotalDaysSeen'), value: String(pi.num_days_seen) })
  }
  if (isDisplayable(pi.first_seen)) {
    rows.push({ label: t('proxyFirstSeen'), value: pi.first_seen as string })
  }
  if (isDisplayable(pi.last_seen)) {
    rows.push({ label: t('proxyLastSeen'), value: pi.last_seen as string })
  }

  return rows
})

const proxyChainStart = computed(() => {
  if (!infoConn.value || !getConnectionChains(infoConn.value).length) {
    return null
  }

  return last(getConnectionChains(infoConn.value))
})

const availableTabs = computed<TabType[]>(() =>
  proxyChainStart.value ? ['overview', 'raw', 'proxies'] : ['overview', 'raw'],
)
const tabOptions = computed<SegmentOption[]>(() =>
  availableTabs.value.map((tab) => ({
    value: tab,
    label: t(tabLabel[tab]),
  })),
)

const sectionDefs: { id: string; keys: CONNECTIONS_TABLE_ACCESSOR_KEY[] }[] = [
  {
    id: 'basic',
    keys: [KEY.Type, KEY.ConnectTime, KEY.Rule, KEY.Process, KEY.InboundUser, KEY.Protocol],
  },
  {
    id: 'sourceAndDestination',
    keys: [
      KEY.SourceIP,
      KEY.SourcePort,
      KEY.Host,
      KEY.SniffHost,
      KEY.Destination,
      KEY.DestinationType,
      KEY.RemoteAddress,
    ],
  },
  { id: 'traffic', keys: [KEY.Download, KEY.Upload, KEY.DlSpeed, KEY.UlSpeed] },
  { id: 'outbound', keys: [KEY.Chains, KEY.Outbound, KEY.OutboundType, KEY.FromOutbound] },
]

const sections = computed(() => {
  const conn = infoConn.value
  if (!conn) return []

  const options = {
    mode: 'table' as const,
    proxyChainDirection: proxyChainDirection.value,
    showFullProxyChain: showFullProxyChain.value,
  }
  const rowsOf = (keys: CONNECTIONS_TABLE_ACCESSOR_KEY[]) =>
    keys
      .map((key) => ({
        label: t(key),
        value: String(getConnectionDisplayValue(conn, key, options) ?? ''),
      }))
      .filter((row) => row.value && row.value !== '-')

  return sectionDefs
    .map((def) => {
      const rows = rowsOf(def.keys)
      if (def.id === 'basic') {
        rows.unshift({ label: 'ID', value: conn.id })
      }
      return { id: def.id, title: t(def.id), rows }
    })
    .filter((section) => section.rows.length)
})

watch(
  () => proxyChainStart.value,
  (name) => {
    selectedProxy.value = name || ''
    if (!name && activeTab.value === 'proxies') {
      activeTab.value = 'overview'
    }
  },
  { immediate: true },
)

watch(
  () => connectionDetailModalShow.value,
  (show) => {
    if (show) {
      activeTab.value = 'overview'
    }
  },
)

watch(
  () => destinationIP.value,
  (newIP) => {
    if (!newIP || !isValidDestinationIP.value || isPrivateIP.value) {
      multiDetails.value = null
      return
    }

    // If already queried this IP, skip
    const existingCustomIP = multiDetails.value?.custom?.ip
    const existingOtherIP = multiDetails.value?.ipsb?.ip || multiDetails.value?.ipwhois?.ip || multiDetails.value?.ipapi?.ip
    if (existingCustomIP === newIP || existingOtherIP === newIP) {
      return
    }

    multiDetails.value = null
    getMultiSourceIPInfo(newIP).then((res) => {
      multiDetails.value = res
    })
  },
)
</script>

import { IP_INFO_API, LANG } from '@/constant'
import { customIPAPIKey, IPInfoAPI, language } from '@/store/settings'
import * as ipaddr from 'ipaddr.js'

export interface IPInfo {
  ip: string
  country: string
  region: string
  city: string
  asn: string
  organization: string
  latitude: number | null
  longitude: number | null
}

const coordinate = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const ensureResponseOK = (response: Response, service: string) => {
  if (!response.ok) {
    throw new Error(`${service} lookup failed: ${response.status}`)
  }
}

export const getIPFromIpipnetAPI = async () => {
  const response = await fetch('https://myip.ipip.net/json', { cache: 'no-store' })
  ensureResponseOK(response, IP_INFO_API.IPIP)

  return (await response.json()) as {
    ret: string
    data: {
      ip: string
      location: string[]
    }
  }
}

export const getIPFromIpsbAPI = async (ip = '') => {
  const response = await fetch('https://api.ip.sb/geoip' + (ip ? `/${ip}` : ''), {
    cache: 'no-store',
  })
  ensureResponseOK(response, IP_INFO_API.IPSB)

  return (await response.json()) as {
    ip: string
    organization?: string
    asn_organization?: string
    asn?: number
    country?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
  }
}

const getIPFromIPWhoisAPI = async (ip = '') => {
  const response = await fetch('https://ipwho.is' + (ip ? `/${ip}` : ''), {
    cache: 'no-store',
  })
  ensureResponseOK(response, IP_INFO_API.IPWHOIS)

  return (await response.json()) as
    | {
        ip: string
        success: true
        country?: string
        region?: string
        city?: string
        latitude?: number
        longitude?: number
        connection?: {
          asn?: number
          org?: string
        }
      }
    | {
        ip?: string
        success: false
        message: string
      }
}

const getIPFromIPapiisAPI = async (ip = '') => {
  const response = await fetch('https://api.ipapi.is' + (ip ? `/?q=${ip}` : ''), {
    cache: 'no-store',
  })
  ensureResponseOK(response, IP_INFO_API.IPAPI)

  return (await response.json()) as
    | {
        ip: string
        company_name: string | null
        asn_num: number | null
        asn_org: string | null
        cc: string | null
        lat: number | null
        lon: number | null
      }
    | {
        error: string
      }
}

const CUSTOM_IP_API_BASE_URL = 'https://my-ipapi.xiaoxizicute.workers.dev/'

export interface CustomIPAPIResponse {
  ip: string
  geo: {
    rir: string
    continent: string
    continent_en: string
    continent_code: string
    country: string
    country_en: string
    country_code: string
    region: string
    region_en: string
    city: string
    city_en: string
    district: string
    district_en: string
    longitude: string
    latitude: string
    timezone: string
    carrier: string
    org: string
    org_en: string
    isp: string
    asn: string
    domain: string
    is_anycast: boolean
  }
  privacy: {
    type: string
    is_datacenter: boolean
    is_anonymous: boolean
    is_icloud_relay: boolean
    is_tor: boolean
    is_known_bot: boolean
  }
  threat_intelligence: {
    is_threat: boolean
    last_seen?: string
    first_seen?: string
    recent_abuse?: string[]
    history_abuse?: string[]
  }
  proxy_intelligence: {
    is_proxy: boolean
    source_list?: string
    source_count?: number
    last_seen?: string
    first_seen?: string
    active_days_7d?: number
    active_days_30d?: number
    active_days_90d?: number
    num_days_seen?: number
  }
}

export const getIPFromCustomAPI = async (ip: string): Promise<CustomIPAPIResponse> => {
  const key = customIPAPIKey.value
  if (!key) {
    throw new Error('Custom IP API key is not configured')
  }
  const response = await fetch(
    `${CUSTOM_IP_API_BASE_URL}?key=${encodeURIComponent(key)}&ip=${encodeURIComponent(ip)}&t=${Date.now()}`,
  )
  if (!response.ok) {
    throw new Error(`Custom IP API request failed: ${response.status}`)
  }
  return (await response.json()) as CustomIPAPIResponse
}

const useChineseGeo = () => {
  return language.value === LANG.ZH_CN || language.value === LANG.ZH_TW
}

export const customAPIResponseToIPInfo = (resp: CustomIPAPIResponse): IPInfo => {
  const cn = useChineseGeo()
  return {
    ip: resp.ip,
    country: cn ? resp.geo.country : resp.geo.country_en,
    region: cn ? resp.geo.region : resp.geo.region_en,
    city: cn ? resp.geo.city : resp.geo.city_en,
    asn: resp.geo.asn.replace(/^AS/i, ''),
    organization: cn ? resp.geo.org : resp.geo.org_en,
    latitude: coordinate(Number(resp.geo.latitude)),
    longitude: coordinate(Number(resp.geo.longitude)),
  }
}

export interface MultiSourceIPResult {
  custom: CustomIPAPIResponse | null
  ipsb: IPInfo | null
  ipwhois: IPInfo | null
  ipapi: IPInfo | null
}

const ipsbToIPInfo = (resp: Awaited<ReturnType<typeof getIPFromIpsbAPI>>): IPInfo => ({
  ip: resp.ip,
  country: resp.country ?? '',
  region: resp.region ?? '',
  city: resp.city ?? '',
  asn: resp.asn?.toString() ?? '',
  organization: resp.organization ?? resp.asn_organization ?? '',
  latitude: coordinate(resp.latitude),
  longitude: coordinate(resp.longitude),
})

const ipwhoisToIPInfo = (resp: Awaited<ReturnType<typeof getIPFromIPWhoisAPI>>): IPInfo => {
  if (!resp.success) {
    throw new Error(`IPWhois lookup failed: ${resp.message}`)
  }
  return {
    ip: resp.ip,
    region: resp.region ?? '',
    country: resp.country ?? '',
    city: resp.city ?? '',
    asn: resp.connection?.asn?.toString() ?? '',
    organization: resp.connection?.org ?? '',
    latitude: coordinate(resp.latitude),
    longitude: coordinate(resp.longitude),
  }
}

const ipapiToIPInfo = (resp: Awaited<ReturnType<typeof getIPFromIPapiisAPI>>): IPInfo => {
  if ('error' in resp) {
    throw new Error(`ipapi.is lookup failed: ${resp.error}`)
  }
  return {
    ip: resp.ip,
    country: resp.cc ?? '',
    region: '',
    city: '',
    asn: resp.asn_num?.toString() ?? '',
    organization: resp.asn_org ?? resp.company_name ?? '',
    latitude: coordinate(resp.lat),
    longitude: coordinate(resp.lon),
  }
}

export const getMultiSourceIPInfo = async (ip: string): Promise<MultiSourceIPResult> => {
  const [custom, ipsb, ipwhois, ipapi] = await Promise.allSettled([
    getIPFromCustomAPI(ip),
    getIPFromIpsbAPI(ip).then(ipsbToIPInfo),
    getIPFromIPWhoisAPI(ip).then(ipwhoisToIPInfo),
    getIPFromIPapiisAPI(ip).then(ipapiToIPInfo),
  ])

  return {
    custom: custom.status === 'fulfilled' ? custom.value : null,
    ipsb: ipsb.status === 'fulfilled' ? ipsb.value : null,
    ipwhois: ipwhois.status === 'fulfilled' ? ipwhois.value : null,
    ipapi: ipapi.status === 'fulfilled' ? ipapi.value : null,
  }
}

export const getIPInfo = async (ip = '', api: IP_INFO_API = IPInfoAPI.value): Promise<IPInfo> => {
  switch (api) {
    case IP_INFO_API.IPIP:
      if (ip) {
        throw new Error('IPIP.net only supports public IP detection')
      }

      const ipip = await getIPFromIpipnetAPI()

      if (ipip.ret !== 'ok' || !ipaddr.isValid(ipip.data?.ip)) {
        throw new Error('IPIP.net lookup failed')
      }

      const [country = '', region = '', city = '', ...organizationParts] = ipip.data.location ?? []

      return {
        ip: ipip.data.ip,
        country,
        region,
        city,
        asn: '',
        organization: organizationParts.filter(Boolean).join(' '),
        latitude: null,
        longitude: null,
      }
    case IP_INFO_API.IPAPI:
      const ipapi = await getIPFromIPapiisAPI(ip)

      if ('error' in ipapi) {
        throw new Error(`ipapi.is lookup failed: ${ipapi.error}`)
      }

      return {
        ip: ipapi.ip,
        country: ipapi.cc ?? '',
        region: '',
        city: '',
        asn: ipapi.asn_num?.toString() ?? '',
        organization: ipapi.asn_org ?? ipapi.company_name ?? '',
        latitude: coordinate(ipapi.lat),
        longitude: coordinate(ipapi.lon),
      }
    case IP_INFO_API.IPWHOIS:
      const ipwhois = await getIPFromIPWhoisAPI(ip)

      if (!ipwhois.success) {
        throw new Error(`IPWhois lookup failed: ${ipwhois.message}`)
      }

      return {
        ip: ipwhois.ip,
        region: ipwhois.region ?? '',
        country: ipwhois.country ?? '',
        city: ipwhois.city ?? '',
        asn: ipwhois.connection?.asn?.toString() ?? '',
        organization: ipwhois.connection?.org ?? '',
        latitude: coordinate(ipwhois.latitude),
        longitude: coordinate(ipwhois.longitude),
      }
    case IP_INFO_API.IPSB:
    default:
      const ipsb = await getIPFromIpsbAPI(ip)

      return {
        ip: ipsb.ip,
        country: ipsb.country ?? '',
        region: ipsb.region ?? '',
        city: ipsb.city ?? '',
        asn: ipsb.asn?.toString() ?? '',
        organization: ipsb.organization ?? ipsb.asn_organization ?? '',
        latitude: coordinate(ipsb.latitude),
        longitude: coordinate(ipsb.longitude),
      }
  }
}

export const getPublicIPInfo = async (api: IP_INFO_API): Promise<IPInfo> => {
  const info = await getIPInfo('', api)

  if (!ipaddr.isValid(info.ip)) {
    throw new Error(`${api} returned an invalid public IP`)
  }

  return info
}

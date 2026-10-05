import { getIPInfo, type IPInfo } from '@/api/geoip'
import { IP_INFO_API } from '@/constant'
import { customIPAPIKey } from '@/store/custom-settings'

const CUSTOM_IP_API_BASE_URL = 'https://my-ipapi.xiaoxizicute.workers.dev/'
const LOOKUP_TIMEOUT = 8000

export interface CustomIPAPIResponse {
  ip: string
  geo: {
    rir?: string
    continent?: string
    continent_en?: string
    continent_code?: string
    country?: string
    country_en?: string
    country_code?: string
    region?: string
    region_en?: string
    city?: string
    city_en?: string
    district?: string
    district_en?: string
    longitude?: string
    latitude?: string
    timezone?: string
    carrier?: string
    org?: string
    org_en?: string
    isp?: string
    asn?: string
    domain?: string
    is_anycast?: boolean
  }
  privacy?: {
    type?: string
    is_datacenter?: boolean
    is_anonymous?: boolean
    is_icloud_relay?: boolean
    is_tor?: boolean
    is_known_bot?: boolean
  }
  threat_intelligence?: {
    is_threat?: boolean
    last_seen?: string
    first_seen?: string
    recent_abuse?: string[]
    history_abuse?: string[]
  }
  proxy_intelligence?: {
    is_proxy?: boolean
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

const withTimeout = <T>(promise: Promise<T>, ms = LOOKUP_TIMEOUT) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Lookup timed out after ${ms}ms`)), ms)

    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })

export const getIPFromCustomAPI = async (ip: string): Promise<CustomIPAPIResponse> => {
  const key = customIPAPIKey.value

  if (!key) {
    throw new Error('Custom IP API key is not configured')
  }

  const response = await fetch(
    `${CUSTOM_IP_API_BASE_URL}?key=${encodeURIComponent(key)}&ip=${encodeURIComponent(ip)}`,
    { cache: 'no-store', signal: AbortSignal.timeout(LOOKUP_TIMEOUT) },
  )

  if (!response.ok) {
    throw new Error(`Custom IP API request failed: ${response.status}`)
  }

  const data = await response.json()

  // The worker may answer 200 with an error body (e.g. invalid key)
  if (!data || typeof data !== 'object' || !data.geo || typeof data.geo !== 'object') {
    throw new Error(`Custom IP API returned an invalid response: ${data?.error ?? data?.message}`)
  }

  return data as CustomIPAPIResponse
}

const coordinate = (value: unknown) => {
  const num = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN

  return value !== '' && Number.isFinite(num) ? num : null
}

export const customAPIResponseToIPInfo = (resp: CustomIPAPIResponse, cn: boolean): IPInfo => {
  const geo = resp.geo

  return {
    ip: resp.ip,
    country: (cn ? geo.country : geo.country_en) ?? '',
    region: (cn ? geo.region : geo.region_en) ?? '',
    city: (cn ? geo.city : geo.city_en) ?? '',
    asn: String(geo.asn ?? '').replace(/^AS/i, ''),
    organization: (cn ? geo.org : geo.org_en) ?? '',
    latitude: coordinate(geo.latitude),
    longitude: coordinate(geo.longitude),
  }
}

export const PUBLIC_GEO_SOURCES = [IP_INFO_API.IPSB, IP_INFO_API.IPWHOIS, IP_INFO_API.IPAPI]

// ipapi.is has shipped several response schemas over time. The anonymous tier currently
// returns a flat one (`asn: "AS7018 AT&T Enterprises, LLC"`, `company: "..."`), which the
// upstream parser in geoip.ts does not match, so parse it here and accept the older shapes too.
interface IPapiisResponse {
  ip?: string
  error?: string
  country?: string | null
  region?: string | null
  city?: string | null
  company?: string | { name?: string } | null
  asn?: string | { asn?: number; org?: string } | null
  lat?: number | null
  lon?: number | null
  cc?: string | null
  asn_num?: number | null
  asn_org?: string | null
  company_name?: string | null
  location?: {
    country?: string
    state?: string
    city?: string
    latitude?: number
    longitude?: number
  }
}

const getIPFromIPapiis = async (ip: string): Promise<IPInfo> => {
  const response = await fetch(`https://api.ipapi.is/?q=${encodeURIComponent(ip)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT),
  })

  if (!response.ok) {
    throw new Error(`ipapi.is lookup failed: ${response.status}`)
  }

  const data = (await response.json()) as IPapiisResponse

  if (!data || data.error || !data.ip) {
    throw new Error(`ipapi.is lookup failed: ${data?.error}`)
  }

  const asnObject = typeof data.asn === 'object' ? data.asn : null
  const [, asnFromText, orgFromText] =
    (typeof data.asn === 'string' && data.asn.match(/^AS(\d+)\s*(.*)$/i)) || []
  const company = typeof data.company === 'string' ? data.company : data.company?.name

  return {
    ip: data.ip,
    country: data.country ?? data.location?.country ?? data.cc ?? '',
    region: data.region ?? data.location?.state ?? '',
    city: data.city ?? data.location?.city ?? '',
    asn: String(asnObject?.asn ?? data.asn_num ?? asnFromText ?? ''),
    organization:
      company || asnObject?.org || data.asn_org || data.company_name || orgFromText || '',
    latitude: coordinate(data.lat ?? data.location?.latitude),
    longitude: coordinate(data.lon ?? data.location?.longitude),
  }
}

export const getPublicGeoSourceInfo = (ip: string, api: IP_INFO_API) =>
  withTimeout(api === IP_INFO_API.IPAPI ? getIPFromIPapiis(ip) : getIPInfo(ip, api))

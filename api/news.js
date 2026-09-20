import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({ ignoreAttributes:false, attributeNamePrefix:'@_' })
const DEFAULT_FEEDS = [
  { id:'pib', name:'PIB India', type:'common', url:'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1' },
  { id:'google-news-india', name:'Google News India', type:'common', url:'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en' },
]

function configuredLocalFeeds(place) {
  try {
    const map = JSON.parse(process.env.NEWS_LOCAL_FEEDS_JSON || '{}')
    const key = Object.keys(map).find(k => k.toLowerCase() === place.toLowerCase())
    const urls = Array.isArray(map[key]) ? map[key] : []
    return urls.filter(x => typeof x === 'string' && /^https:\/\//i.test(x)).map((url,i)=>({ id:`local-${i}`, name:`${place} local source ${i+1}`, type:'local', url }))
  } catch { return [] }
}

function clean(value='') { return String(value).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim() }
function first(v) { return Array.isArray(v) ? v[0] : v }
async function parseFeed(feed) {
  const res = await fetch(feed.url, { headers:{ 'User-Agent':'RentalManager-News/1.0' }, signal:AbortSignal.timeout(7000) })
  if (!res.ok) throw new Error(`Feed returned ${res.status}`)
  const xml = await res.text(); const data = parser.parse(xml)
  const channel = data?.rss?.channel || data?.feed
  const raw = channel?.item || channel?.entry || []
  return (Array.isArray(raw)?raw:[raw]).filter(Boolean).slice(0,12).map((x,i)=>({
    id:`${feed.id}-${i}-${clean(x.guid?.['#text']||x.guid||x.id||x.link?.['@_href']||x.link||x.title)}`,
    title:clean(x.title),
    summary:clean(x.description || x.summary || x['content:encoded']).slice(0,220),
    url:typeof x.link === 'object' ? (x.link?.['@_href'] || x.link?.href || '') : String(x.link||''),
    published:first(x.pubDate || x.published || x.updated || ''),
    source:feed.name,
    type:feed.type,
  })).filter(x=>x.title && x.url)
}

export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'})
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=600, stale-while-revalidate=1800')
  try {
    const place = String(req.query?.place || 'Tamil Nadu').trim().slice(0,80)
    const custom = String(process.env.NEWS_FEED_URLS || '').split(',').map(x=>x.trim()).filter(Boolean).map((url,i)=>({id:`custom-${i}`,name:`Local source ${i+1}`,type:'local',url}))
    const feeds = [...DEFAULT_FEEDS, ...configuredLocalFeeds(place), ...custom]
    const results = await Promise.allSettled(feeds.map(parseFeed))
    const items = results.flatMap(x=>x.status==='fulfilled'?x.value:[]).map(x=>({...x, place}))
    return res.status(200).json({ place, updatedAt:new Date().toISOString(), sources:feeds.map(x=>({name:x.name,type:x.type})), items:items.slice(0,30) })
  } catch(e) { return res.status(502).json({error:'News service unavailable'}) }
}

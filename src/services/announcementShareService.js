function safeText(value) { return String(value || '').trim() }

function bilingual(primary, tamil) {
  const en = safeText(primary)
  const ta = safeText(tamil)
  if (ta && ta !== en) return `${en}\nதமிழ்: ${ta}`
  return en
}

export function buildAnnouncementText(notice, affectedHomes = []) {
  const lines = []
  const title = safeText(notice.title || notice.message || 'Rental Manager Notice')
  const titleTamil = safeText(notice.titleTamil)
  lines.push(`📢 ${title}`)
  if (notice.updateNumber) lines.push(`🔄 ${notice.continuationLabel || `Update #${notice.updateNumber}`} / தொடர்ச்சி புதுப்பிப்பு`)
  if (titleTamil) lines.push(`📢 ${titleTamil}`)
  if (affectedHomes.length) lines.push(`🏠 Affected house(s): ${affectedHomes.join(', ')}`)
  else if (notice.targetHouseIds === 'all') lines.push('🏠 Affected: All houses')
  if (notice.category) lines.push(`Type: ${notice.category}${notice.categoryTamil ? ` / ${notice.categoryTamil}` : ''}`)
  const showTime = notice.showTimeDetails !== false
  if (notice.happenedAt) lines.push(`Started: ${showTime ? formatDateTime(notice.happenedAt) : formatDateOnly(notice.happenedAt)}`)
  if (notice.expectedResolutionAt) lines.push(`Expected resolution: ${showTime ? formatDateTime(notice.expectedResolutionAt) : formatDateOnly(notice.expectedResolutionAt)}`)
  if (notice.resolvedAt) lines.push(`Resolved: ${showTime ? formatDateTime(notice.resolvedAt) : formatDateOnly(notice.resolvedAt)}`)
  if (notice.reason) lines.push(`Reason: ${bilingual(notice.reason, notice.reasonTamil)}`)
  if (notice.message) lines.push(`\n${notice.message}${notice.messageTamil ? `\n${notice.messageTamil}` : ''}`)
  if (notice.additionalDetails) lines.push(`\nAdditional details: ${bilingual(notice.additionalDetails, notice.additionalDetailsTamil)}`)
  if (Array.isArray(notice.linkedAnnouncements) && notice.linkedAnnouncements.length) {
    lines.push('\nRelated announcements / தொடர்புடைய அறிவிப்புகள்:')
    notice.linkedAnnouncements.slice(0, 8).forEach(item => lines.push(`• ${item.title || 'Announcement'}${item.titleTamil ? ` / ${item.titleTamil}` : ''}: ${item.shareUrl || ''}`))
  }
  if (Array.isArray(notice.previousUpdates) && notice.previousUpdates.length) {
    lines.push('\nPrevious updates / முந்தைய புதுப்பிப்புகள்:')
    notice.previousUpdates.slice(0, 8).forEach(item => lines.push(`• ${item.continuationLabel || `Update #${item.updateNumber || ''}`} — ${item.title || ''}: ${item.shareUrl || ''}`))
  }
  if (notice.shareUrl) lines.push(`\nDetails / விவரங்கள்: ${notice.shareUrl}`)
  lines.push('\n— Rental Manager')
  return lines.join('\n')
}

export function formatDateOnly(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

export function formatDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function shareViaWhatsApp(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function shareViaEmail(subject, text) {
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}

export async function shareAnnouncementFile({ title, text, file, url }) {
  if (!file) throw new Error('Announcement file is not ready')
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return false
  await navigator.share({ title, text, ...(url ? { url } : {}), files: [file] })
  return true
}

export async function shareNative({ title, text, file, url }) {
  if (!navigator.share) return false
  const payload = { title, text, ...(url ? { url } : {}) }
  if (file && navigator.canShare?.({ files: [file] })) payload.files = [file]
  await navigator.share(payload)
  return true
}

function wrapText(ctx, text, maxWidth) {
  const lines = []
  String(text || '').split(/\n/).forEach(paragraph => {
    if (!paragraph) { lines.push(''); return }
    let line = ''
    for (const char of paragraph) {
      const candidate = line + char
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line)
        line = char
      } else line = candidate
    }
    if (line) lines.push(line)
  })
  return lines
}

function drawAnnouncementCanvas(notice, affectedHomes = []) {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fbf8ef'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#172033'
  ctx.fillRect(0, 0, canvas.width, 190)
  ctx.fillStyle = '#f2d28b'
  ctx.font = '700 38px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  ctx.fillText('RENTAL MANAGER', 70, 70)
  if (notice.updateNumber) { ctx.fillStyle = '#f2d28b'; ctx.font = '700 24px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'; ctx.fillText(notice.continuationLabel || `Update #${notice.updateNumber}`, 1040, 70) }
  ctx.fillStyle = '#fff'
  ctx.font = '700 44px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  const titleLines = wrapText(ctx, safeText(notice.title || notice.message || 'Announcement'), 1260).slice(0, 2)
  titleLines.forEach((line, i) => ctx.fillText(line, 70, 130 + i * 48))

  ctx.fillStyle = '#2b2620'
  ctx.font = '600 28px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  let y = 260
  const rows = [
    affectedHomes.length ? `Affected house(s): ${affectedHomes.join(', ')}` : (notice.targetHouseIds === 'all' ? 'Affected: All houses / அனைத்து வீடுகளும்' : ''),
    notice.category ? `Type: ${notice.category}${notice.categoryTamil ? ` / ${notice.categoryTamil}` : ''}` : '',
    notice.updateNumber ? `Update: ${notice.continuationLabel || `#${notice.updateNumber}`}` : '',
    notice.happenedAt ? `Started: ${notice.showTimeDetails === false ? formatDateOnly(notice.happenedAt) : formatDateTime(notice.happenedAt)}` : '',
    notice.expectedResolutionAt ? `Expected resolution: ${notice.showTimeDetails === false ? formatDateOnly(notice.expectedResolutionAt) : formatDateTime(notice.expectedResolutionAt)}` : '',
    notice.resolvedAt ? `Resolved: ${notice.showTimeDetails === false ? formatDateOnly(notice.resolvedAt) : formatDateTime(notice.resolvedAt)}` : '',
    notice.reason ? `Reason: ${notice.reason}${notice.reasonTamil ? ` / ${notice.reasonTamil}` : ''}` : '',
  ].filter(Boolean)
  rows.forEach(row => { wrapText(ctx, row, 1260).slice(0, 2).forEach(line => { ctx.fillText(line, 70, y); y += 40 }); y += 5 })
  y += 20
  ctx.font = '400 28px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  const body = [safeText(notice.message), safeText(notice.messageTamil), notice.additionalDetails ? `\n${notice.additionalDetails}` : '', notice.additionalDetailsTamil ? `\n${notice.additionalDetailsTamil}` : ''].filter(Boolean).join('\n')
  wrapText(ctx, body, 1260).slice(0, 18).forEach(line => { ctx.fillText(line, 70, y); y += 39 })
  ctx.fillStyle = '#6b6255'
  ctx.font = '400 20px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  ctx.fillText('Details / விவரங்கள்: open the shared link', 70, 1145)
  return canvas
}

export async function buildAnnouncementImage(notice, affectedHomes = []) {
  const canvas = drawAnnouncementCanvas(notice, affectedHomes)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95))
  return new File([blob], 'rental-manager-announcement-bilingual.png', { type: 'image/png' })
}

function base64ToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function ascii(text) { return new TextEncoder().encode(text) }
function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach(p => { out.set(p, offset); offset += p.length })
  return out
}

// PDF contains the rendered bilingual announcement as a JPEG image. This avoids
// PDF font/Unicode limitations while preserving Tamil exactly as rendered by the browser.
export async function buildAnnouncementPdf(notice, affectedHomes = [], filename = 'rental-manager-announcement-bilingual.pdf') {
  const canvas = drawAnnouncementCanvas(notice, affectedHomes)
  const jpeg = base64ToBytes(canvas.toDataURL('image/jpeg', 0.92))
  const pageContent = 'q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    pageContent,
  ]
  const chunks = [ascii('%PDF-1.4\n%RM-TAMIL\n')]
  const offsets = [0]
  let byteOffset = chunks[0].length
  const addObject = (number, header, body, binary = null) => {
    offsets[number] = byteOffset
    const pre = ascii(`${number} 0 obj\n${header}`)
    chunks.push(pre); byteOffset += pre.length
    if (binary) { chunks.push(binary); byteOffset += binary.length; chunks.push(ascii('\nendstream\n')); byteOffset += 11 }
    else { const b = ascii(body); chunks.push(b); byteOffset += b.length }
    const end = ascii('endobj\n'); chunks.push(end); byteOffset += end.length
  }
  addObject(1, '', `${objects[0]}\n`)
  addObject(2, '', `${objects[1]}\n`)
  addObject(3, '', `${objects[2]}\n`)
  addObject(4, '', `${objects[3]}`, jpeg)
  addObject(5, `<< /Length ${new TextEncoder().encode(pageContent).length} >>\nstream\n`, '', ascii(pageContent))
  const xrefOffset = byteOffset
  let xref = `xref\n0 6\n0000000000 65535 f \n`
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(ascii(xref))
  return new File([concatBytes(chunks)], filename, { type: 'application/pdf' })
}

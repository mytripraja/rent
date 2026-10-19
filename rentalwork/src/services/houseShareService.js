function safe(value) { return String(value ?? '').trim() }

export function buildHouseShareText(houses, options = {}) {
  const rows = Array.isArray(houses) ? houses : [houses]
  const lines = ['🏠 Rental Manager · House details']
  rows.forEach((house, index) => {
    if (index) lines.push('\n────────────────')
    lines.push(`House: ${safe(house.internalDoorNumber) || '—'}`)
    if (options.houseDetails) {
      if (house.govtDoorNumber) lines.push(`Government door: ${house.govtDoorNumber}`)
      if (house.floor) lines.push(`Floor: ${house.floor}`)
      if (house.ebNumber) lines.push(`EB number: ${house.ebNumber}`)
      const r = house.roomCounts || {}
      const rooms = [
        ['Bedrooms', r.bedrooms], ['Hall', r.halls], ['Kitchen', r.kitchens],
        ['Bathrooms', r.bathrooms], ['Dressing rooms', r.dressingRooms]
      ].filter(([,v]) => Number(v) > 0).map(([label,v]) => `${label}: ${v}`)
      if (rooms.length) lines.push(`Rooms: ${rooms.join(' · ')}`)
    }
    if (options.tenantName && house.status === 'occupied') lines.push(`Tenant: ${safe(house.tenantName) || '—'}`)
    if (options.tenantPhone && house.status === 'occupied') lines.push(`Tenant phone: ${safe(house.tenantPhone) || '—'}`)
    if (options.rent && house.status === 'occupied') lines.push(`Monthly rent: ₹${Number(house.rentAmount || 0).toLocaleString('en-IN')}`)
    if (options.advance && house.status === 'occupied') lines.push(`Advance: ₹${Number(house.advanceAmount || 0).toLocaleString('en-IN')}`)
    if (options.moveInDate && house.moveInDate) lines.push(`Move-in: ${house.moveInDate}${house.moveInDateApproximate ? ' (approx.)' : ''}`)
    if (options.household && house.status === 'occupied') lines.push(`Household members: ${Number(house.memberCount || house.familyMemberCount || house.householdMembers?.length || 0)}`)
    if (options.otherDetails) {
      if (house.ownerNotes) lines.push(`Notes: ${house.ownerNotes}`)
      if (Array.isArray(house.providedFixtures) && house.providedFixtures.length) {
        lines.push(`Provided items: ${house.providedFixtures.map(x => `${x.name || 'Item'} ×${Number(x.quantity || 1)}`).join(', ')}`)
      }
    }
  })
  if (options.loginLink) lines.push(`\n🔐 Tenant login: ${window.location.origin}/login`)
  lines.push('\n— Rental Manager')
  return lines.join('\n')
}

function wrap(ctx, text, width) {
  const out = []
  String(text || '').split(/\n/).forEach(paragraph => {
    if (!paragraph) { out.push(''); return }
    let line = ''
    for (const char of paragraph) {
      const next = line + char
      if (line && ctx.measureText(next).width > width) { out.push(line); line = char }
      else line = next
    }
    if (line) out.push(line)
  })
  return out
}

export function buildHouseShareCanvas(houses, options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 1200
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fbf8ef'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#172033'
  ctx.fillRect(0, 0, canvas.width, 170)
  ctx.fillStyle = '#f2d28b'
  ctx.font = '700 36px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  ctx.fillText('RENTAL MANAGER', 60, 62)
  ctx.fillStyle = '#fff'
  ctx.font = '700 42px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  ctx.fillText('House details', 60, 125)
  ctx.fillStyle = '#2b2620'
  ctx.font = '600 26px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  let y = 220
  const text = buildHouseShareText(houses, options).replace('🏠 Rental Manager · House details\n', '')
  for (const line of wrap(ctx, text, 1260)) {
    if (y > 1120) break
    ctx.fillText(line, 60, y)
    y += 34
  }
  ctx.fillStyle = '#6b6255'
  ctx.font = '400 18px system-ui, "Nirmala UI", "Noto Sans Tamil", sans-serif'
  ctx.fillText('Shared from Rental Manager', 60, 1160)
  return canvas
}

export async function buildHouseShareImage(houses, options = {}) {
  const canvas = buildHouseShareCanvas(houses, options)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95))
  return new File([blob], 'rental-manager-house-details.png', { type: 'image/png' })
}

function ascii(text) { return new TextEncoder().encode(text) }
function base64ToBytes(dataUrl) {
  const binary = atob(dataUrl.split(',')[1] || '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) { out.set(p, offset); offset += p.length }
  return out
}

export async function buildHouseSharePdf(houses, options = {}) {
  const canvas = buildHouseShareCanvas(houses, options)
  const jpeg = base64ToBytes(canvas.toDataURL('image/jpeg', 0.92))
  const pageContent = 'q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n'
  const parts = [ascii('%PDF-1.4\n%RM-HOUSE\n')]
  const offsets = [0]
  let offset = parts[0].length
  const add = (num, header, body = '', binary = null) => {
    offsets[num] = offset
    const pre = ascii(`${num} 0 obj\n${header}`); parts.push(pre); offset += pre.length
    if (binary) { parts.push(binary); offset += binary.length; const endStream = ascii('\nendstream\n'); parts.push(endStream); offset += endStream.length }
    else { const b = ascii(body); parts.push(b); offset += b.length }
    const end = ascii('endobj\n'); parts.push(end); offset += end.length
  }
  add(1, '', '<< /Type /Catalog /Pages 2 0 R >>\n')
  add(2, '', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n')
  add(3, '', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n')
  add(4, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, '', jpeg)
  add(5, `<< /Length ${new TextEncoder().encode(pageContent).length} >>\nstream\n`, '', ascii(pageContent))
  const xref = offset
  let table = 'xref\n0 6\n0000000000 65535 f \n'
  for (let i = 1; i <= 5; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  table += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  parts.push(ascii(table))
  return new File([concat(parts)], 'rental-manager-house-details.pdf', { type: 'application/pdf' })
}

export async function shareHouseFile({ title, text, file, url }) {
  if (!file) throw new Error('House sharing file is not ready')
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) return false
  await navigator.share({ title, text, ...(url ? { url } : {}), files: [file] })
  return true
}

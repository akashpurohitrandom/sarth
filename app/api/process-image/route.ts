import { NextRequest, NextResponse } from 'next/server'
import { authorizeAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req)
    if (auth.response) return auth.response
    const supabase = auth.client!
    const { photograph_id, original_path, tags, city, country, year } = await req.json()
    const normalizedTags = Array.isArray(tags)
      ? Array.from(new Set(tags.map((tag: unknown) => typeof tag === 'string' ? tag.trim().toLowerCase() : '').filter(Boolean)))
      : null
    if (typeof photograph_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(photograph_id) ||
        typeof original_path !== 'string' || !original_path.startsWith(`${photograph_id}/`) ||
        original_path.includes('..') || original_path.split('/').length !== 2 ||
        !normalizedTags || normalizedTags.length > 20 || normalizedTags.some(tag => tag.length > 50) ||
        (city != null && (typeof city !== 'string' || city.length > 120)) ||
        (country != null && (typeof country !== 'string' || country.length > 120)) ||
        (year != null && (!Number.isInteger(year) || year < 1000 || year > 9999))) {
      return NextResponse.json({ error: 'Invalid photograph details.' }, { status: 400 })
    }

    const { data: fileData, error: downloadError } = await supabase.storage.from('originals').download(original_path)
    if (downloadError || !fileData) throw new Error('Could not download the original. Please retry.')
    if (fileData.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Photographs must be under 50 MB.' }, { status: 413 })
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const sharp = (await import('sharp')).default
    const source = sharp(buffer, { limitInputPixels: 100_000_000 }).rotate()
    const { data: webBuffer, info } = await source.clone()
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true })
    const thumbBuffer = await source.clone()
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, mozjpeg: true }).toBuffer()
    const path = original_path.replace(/\.[^.]+$/, '') + '.jpg'
    const { error: webError } = await supabase.storage.from('photographs')
      .upload(path, webBuffer, { contentType: 'image/jpeg', upsert: true })
    if (webError) throw new Error('Could not save the web photograph. Please retry.')
    const { error: thumbError } = await supabase.storage.from('thumbnails')
      .upload(path, thumbBuffer, { contentType: 'image/jpeg', upsert: true })
    if (thumbError) throw new Error('Could not save the thumbnail. Please retry.')
    const { error: dbError } = await supabase.from('photographs').upsert({
      id: photograph_id,
      storage_path: `originals/${original_path}`,
      web_path: `photographs/${path}`,
      thumbnail_path: `thumbnails/${path}`,
      width: info.width,
      height: info.height,
      tags: normalizedTags,
      city: city?.trim() || null,
      country: country?.trim() || null,
      year: year || null,
    }, { onConflict: 'id' })
    if (dbError) throw new Error('Could not save photograph details. Please retry.')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Image processing failed:', error)
    return NextResponse.json({ error: 'Photograph processing failed. Your upload is saved; please retry.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { authorizeAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdmin(req)
    if (auth.response) return auth.response
    const supabase = auth.client!
    const { story_id, original_path, caption, display_order } = await req.json()
    if (typeof story_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(story_id) ||
        typeof original_path !== 'string' || !original_path.startsWith(`${story_id}/`) ||
        original_path.includes('..') || original_path.split('/').length !== 2 ||
        !Number.isInteger(display_order) || display_order < 0 ||
        (caption != null && (typeof caption !== 'string' || caption.length > 2000))) {
      return NextResponse.json({ error: 'Invalid photograph details.' }, { status: 400 })
    }
    const { data: story, error: storyError } = await supabase.from('stories')
      .select('id, published').eq('id', story_id).single()
    if (storyError || !story) return NextResponse.json({ error: 'Story not found.' }, { status: 404 })
    if (story.published) return NextResponse.json({ error: 'Unpublish the story before changing its photographs.' }, { status: 409 })

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
      story_id, storage_path: `originals/${original_path}`,
      web_path: `photographs/${path}`, thumbnail_path: `thumbnails/${path}`,
      width: info.width, height: info.height,
      caption: caption || null, display_order,
    }, { onConflict: 'storage_path' })
    if (dbError) throw new Error('Could not save photograph details. Please retry.')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Image processing failed:', error)
    return NextResponse.json({ error: 'Photograph processing failed. Your draft is saved; please retry.' }, { status: 500 })
  }
}

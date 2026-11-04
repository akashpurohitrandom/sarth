import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key for storage write access
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { story_id, original_path, caption, display_order, width, height } = body

    const supabase = getAdminClient()

    // Download the original from storage
    const { data: fileData, error: downloadErr } = await supabase
      .storage
      .from('originals')
      .download(original_path)

    if (downloadErr || !fileData) {
      return NextResponse.json({ error: 'Could not download original' }, { status: 500 })
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Dynamic import of sharp (only available server-side)
    const sharp = (await import('sharp')).default

    // Web version — max 2000px, MozJPEG quality 82
    const webBuffer = await sharp(buffer)
      .rotate() // auto-rotate from EXIF
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()

    // Thumbnail version — max 600px, quality 75
    const thumbBuffer = await sharp(buffer)
      .rotate()
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer()

    // Get final dimensions after processing
    const meta = await sharp(buffer).rotate().metadata()
    const finalW = meta.width  || width  || 1200
    const finalH = meta.height || height || 800

    const webPath   = original_path.replace('originals/', '')
    const thumbPath = original_path.replace('originals/', 'thumb-')

    // Upload web version
    const { error: webErr } = await supabase.storage
      .from('photographs')
      .upload(webPath, webBuffer, { contentType: 'image/jpeg', upsert: true })

    // Upload thumbnail
    const { error: thumbErr } = await supabase.storage
      .from('thumbnails')
      .upload(thumbPath, thumbBuffer, { contentType: 'image/jpeg', upsert: true })

    if (webErr || thumbErr) {
      console.error('Upload errors:', webErr, thumbErr)
    }

    // Create database record
    const { error: dbErr } = await supabase.from('photographs').insert({
      story_id,
      storage_path:   `originals/${original_path}`,
      web_path:       `photographs/${webPath}`,
      thumbnail_path: `thumbnails/${thumbPath}`,
      width:          finalW,
      height:         finalH,
      caption:        caption || null,
      display_order,
    })

    if (dbErr) throw new Error(dbErr.message)

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('process-image error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

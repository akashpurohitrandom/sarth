import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { authorizeAdmin } from '@/lib/server/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizeAdmin(req)
    if (auth.response) return auth.response
    const client = auth.client!
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid photograph.' }, { status: 400 })
    const { action } = await req.json()
    if (action !== 'delete') return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
    const { data: photo, error: fetchError } = await client.from('photographs')
      .select('storage_path, web_path, thumbnail_path').eq('id', id).maybeSingle()
    if (fetchError) throw fetchError
    if (!photo) return NextResponse.json({ error: 'Photograph not found.' }, { status: 404 })

    const objects = [
      ['originals', photo.storage_path],
      ['photographs', photo.web_path],
      ['thumbnails', photo.thumbnail_path],
    ] as const
    for (const [bucket, fullPath] of objects) {
      const prefix = `${bucket}/`
      if (!fullPath?.startsWith(prefix)) continue
      const { error } = await client.storage.from(bucket).remove([fullPath.slice(prefix.length)])
      if (error) throw error
    }
    const { error: deleteError } = await client.from('photographs').delete().eq('id', id)
    if (deleteError) throw deleteError
    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Photograph deletion failed:', error)
    return NextResponse.json({ error: 'Could not delete photograph. Please retry.' }, { status: 500 })
  }
}

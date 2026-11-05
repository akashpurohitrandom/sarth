import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { authorizeAdmin } from '@/lib/server/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizeAdmin(req)
    if (auth.response) return auth.response
    const client = auth.client!
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })
    const { action, expectedPhotos } = await req.json()
    if (!['publish', 'unpublish', 'delete'].includes(action)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
    const { data: story } = await client.from('stories').select('id').eq('id', id).maybeSingle()
    if (!story) return NextResponse.json({ error: 'Story not found.' }, { status: 404 })
    if (action === 'publish') {
      const { count, error } = await client.from('photographs').select('id', { count: 'exact', head: true })
        .eq('story_id', id).not('web_path', 'is', null).not('thumbnail_path', 'is', null)
      if (error) throw error
      if (!count || (expectedPhotos !== undefined && count !== expectedPhotos)) {
        return NextResponse.json({ error: 'Finish uploading all photographs before publishing.' }, { status: 409 })
      }
    }
    const { error: updateError } = await client.from('stories').update({ published: action === 'publish' }).eq('id', id)
    if (updateError) throw updateError
    const { error: cacheError } = await client.from('homepage_layouts').update({ is_active: false }).eq('is_active', true)
    if (cacheError) throw cacheError
    revalidatePath('/')
    if (action === 'delete') {
      for (const bucket of ['originals', 'photographs', 'thumbnails']) {
        // Remove from the first page repeatedly so deleting does not skip later objects.
        while (true) {
          const { data: objects, error: listError } = await client.storage.from(bucket).list(id, { limit: 100 })
          if (listError) throw listError
          if (!objects?.length) break
          const { error: removeError } = await client.storage.from(bucket).remove(objects.map(o => `${id}/${o.name}`))
          if (removeError) throw removeError
        }
      }
      const { error } = await client.from('stories').delete().eq('id', id)
      if (error) throw error
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Story action failed:', error)
    return NextResponse.json({ error: 'Could not complete the change. Please retry.' }, { status: 500 })
  }
}

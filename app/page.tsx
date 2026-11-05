import { createClient } from '@supabase/supabase-js'
import Gallery from '@/components/gallery/Gallery'
import type { GalleryStory } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data } = await supabase
    .from('stories')
    .select('id, title, slug, photographs(id, story_id, web_path, photograph_title, taken_on, city, country, width, height, display_order)')
    .eq('published', true)
    .order('display_order', { referencedTable: 'photographs', ascending: true })
    .order('display_order', { ascending: true })

  const stories = (data ?? []).map(story => ({
    ...story,
    photographs: (story.photographs ?? []).filter(photo => photo.web_path),
  })) as unknown as GalleryStory[]

  return <Gallery stories={stories} />
}

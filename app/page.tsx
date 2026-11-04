import { supabase } from '@/lib/supabase'
import { generateLayout, getHourlySeed, StoryWithPhoto } from '@/lib/layout-engine'
import { HomepageLayout } from '@/lib/supabase'
import World from '@/components/canvas/World'
import Cursor from '@/components/ui/Cursor'

// Revalidate every hour — matches the layout refresh cadence
export const revalidate = 3600

async function getLayout(): Promise<HomepageLayout> {
  // 1. Check if a valid cached layout exists in the DB
  const { data: existing } = await supabase
    .from('homepage_layouts')
    .select('layout_data, expires_at')
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (existing?.layout_data) {
    return existing.layout_data as HomepageLayout
  }

  // 2. No valid layout — generate a new one
  // Fetch all published stories with their photographs
  const { data: stories, error } = await supabase
    .from('stories')
    .select(`
      id,
      title,
      slug,
      photographs (
        id,
        story_id,
        storage_path,
        web_path,
        thumbnail_path,
        width,
        height,
        caption,
        display_order,
        created_at
      )
    `)
    .eq('published', true)
    .order('display_order')

  if (error || !stories?.length) {
    return { cards: [] }
  }

  // 3. For each story, pick one photograph using the cycle algorithm
  const storiesWithPhotos: StoryWithPhoto[] = []

  for (const story of stories) {
    const photos = story.photographs
    if (!photos || photos.length === 0) continue

    // Get which photos have been shown this cycle
    const { data: selections } = await supabase
      .from('homepage_selections')
      .select('photograph_id, cycle_number')
      .eq('story_id', story.id)
      .order('cycle_number', { ascending: false })

    // Determine current cycle
    const maxCycle = selections?.length
      ? Math.max(...selections.map(s => s.cycle_number))
      : 1

    const shownThisCycle = new Set(
      selections
        ?.filter(s => s.cycle_number === maxCycle)
        .map(s => s.photograph_id) ?? []
    )

    // Pick unseen photo, or reset cycle
    const unseen = photos.filter((p: any) => !shownThisCycle.has(p.id))
    const pool   = unseen.length > 0 ? unseen : photos
    const chosen = pool[Math.floor(Math.random() * pool.length)]

    const nextCycle = unseen.length === 0 ? maxCycle + 1 : maxCycle

    // Record the selection
    await supabase.from('homepage_selections').insert({
      story_id:      story.id,
      photograph_id: chosen.id,
      cycle_number:  nextCycle,
    })

    storiesWithPhotos.push({
      story_id:    story.id,
      story_title: story.title,
      story_slug:  story.slug,
      photograph:  chosen,
    })
  }

  if (!storiesWithPhotos.length) return { cards: [] }

  // 4. Generate the beautiful-random layout
  const seed   = getHourlySeed()
  const layout = generateLayout(storiesWithPhotos, seed)

  // 5. Store in DB so all visitors get the same layout this hour
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await supabase.from('homepage_layouts').update({ is_active: false })
    .eq('is_active', true)

  await supabase.from('homepage_layouts').insert({
    layout_data: layout,
    expires_at:  expiresAt,
    is_active:   true,
  })

  return layout
}

export default async function HomePage() {
  const layout = await getLayout()

  return (
    <>
      <Cursor />
      <World cards={layout.cards} />
    </>
  )
}

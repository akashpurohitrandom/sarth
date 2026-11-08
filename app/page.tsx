import { createClient } from '@supabase/supabase-js'
import Gallery from '@/components/gallery/Gallery'
import type { GalleryPhoto } from '@/lib/supabase'
import { randomizeByTagDistance } from '@/lib/tag-order'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const [{ data: photographs }, { data: settings }] = await Promise.all([
    supabase.from('photographs')
      .select('id, web_path, tags, city, country, year')
      .not('web_path', 'is', null)
      .order('created_at', { ascending: true }),
    supabase.from('site_settings').select('logo_path').eq('singleton', true).maybeSingle(),
  ])
  const photos = (photographs ?? []).filter(photo => photo.web_path) as GalleryPhoto[]
  const logoUrl = settings?.logo_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${settings.logo_path}`
    : null

  return <Gallery photographs={randomizeByTagDistance(photos)} logoUrl={logoUrl} />
}

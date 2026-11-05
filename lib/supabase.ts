import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types matching our database schema
export type Story = {
  id: string
  title: string
  slug: string
  introduction: string | null
  published: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type Photograph = {
  id: string
  story_id: string
  storage_path: string
  web_path: string | null
  thumbnail_path: string | null
  width: number | null
  height: number | null
  photograph_title: string | null
  taken_on: string | null
  city: string | null
  country: string | null
  caption: string | null
  display_order: number
  created_at: string
}

export type GalleryPhoto = Pick<Photograph,
  'id' | 'story_id' | 'web_path' | 'photograph_title' | 'taken_on' | 'city' | 'country' | 'width' | 'height'
> & { web_path: string }

export type GalleryStory = {
  id: string
  title: string
  slug: string
  photographs: GalleryPhoto[]
}

export type HomepageCard = {
  story_id: string
  photograph_id: string
  story_title: string
  story_slug: string
  thumbnail_path: string
  web_path: string
  width: number
  height: number
  canvas_x: number
  canvas_y: number
  display_width: number
  rotation: number
  aspect: 'portrait' | 'landscape' | 'square'
}

export type HomepageLayout = {
  cards: HomepageCard[]
}

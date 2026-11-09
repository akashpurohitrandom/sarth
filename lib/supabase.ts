import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Photograph = {
  id: string
  storage_path: string
  web_path: string | null
  thumbnail_path: string | null
  width: number | null
  height: number | null
  tags: string[]
  city: string | null
  country: string | null
  year: number | null
  display_target: 'desktop' | 'mobile'
  display_order: number
  created_at: string
}

export type GalleryPhoto = Pick<Photograph,
  'id' | 'web_path' | 'tags' | 'city' | 'country' | 'year'
> & { web_path: string }

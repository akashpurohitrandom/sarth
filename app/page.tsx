import Script from 'next/script'
import { createClient } from '@supabase/supabase-js'
import Gallery from '@/components/gallery/Gallery'

export const dynamic = 'force-dynamic'

const GA_MEASUREMENT_ID = 'G-7RTSTF63MD'

export default async function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const settingsResult = await supabase.from('site_settings')
    .select('logo_path, logo_scale, logo_opacity').eq('singleton', true).maybeSingle()
  const settings = (settingsResult.error
    ? (await supabase.from('site_settings').select('logo_path').eq('singleton', true).maybeSingle()).data
    : settingsResult.data) as { logo_path?: string | null; logo_scale?: number | null; logo_opacity?: number | null } | null
  const logoScale = Math.min(200, Math.max(50, Number(settings?.logo_scale ?? 100)))
  const logoOpacity = Math.min(100, Math.max(0, Number(settings?.logo_opacity ?? 100)))
  const logoUrl = settings?.logo_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${settings.logo_path}`
    : null

  return (
    <>
      <Gallery logoUrl={logoUrl} logoScale={logoScale} logoOpacity={logoOpacity} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = function gtag() { window.dataLayer.push(arguments); };
          window.gtag('js', new Date());
          window.gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}

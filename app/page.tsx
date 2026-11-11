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
  const { data: settings } = await supabase.from('site_settings')
    .select('logo_path').eq('singleton', true).maybeSingle()
  const logoUrl = settings?.logo_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${settings.logo_path}`
    : null

  return (
    <>
      <Gallery logoUrl={logoUrl} />
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

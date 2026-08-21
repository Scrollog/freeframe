'use client'

import SharePage from '@/app/share/[token]/page'

export default function ShortSharePage({ params }: { params: { code: string } }) {
  return <SharePage params={{ token: params.code }} />
}

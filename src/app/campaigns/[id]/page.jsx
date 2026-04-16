'use client'

import { CampaignDetailPage } from '@/components/campaigns/CampaignDetailPage'

export default function CampaignDetailRoute({ params }) {
  return <CampaignDetailPage id={params.id} />
}
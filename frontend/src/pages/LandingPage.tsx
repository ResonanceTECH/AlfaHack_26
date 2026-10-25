import { Box } from '@mui/material'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ApplicationSection } from '@/components/landing/ApplicationSection'
import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { CreditTypesSection } from '@/components/landing/CreditTypesSection'
import { DesignSystemSection } from '@/components/landing/DesignSystemSection'
import { FaqSection } from '@/components/landing/FaqSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { HeroSection } from '@/components/landing/HeroSection'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'

export function LandingPage() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash !== '#design-system') return
    const el = document.getElementById('design-system')
    if (el) window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [location.hash])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#1A1A1A' }}>
      <LandingHeader />
      <HeroSection />
      <Box
        sx={{
          bgcolor: '#fff',
          borderTopLeftRadius: { xs: 28, sm: 40, md: 56 },
          borderTopRightRadius: { xs: 28, sm: 40, md: 56 },
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        <BenefitsSection />
        <FeaturesSection />
        <CreditTypesSection />
        <FaqSection />
        <ApplicationSection />
      </Box>
      <DesignSystemSection />
      <LandingFooter />
    </Box>
  )
}

import { Box } from '@mui/material'
import { ApplicationSection } from '@/components/landing/ApplicationSection'
import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { CreditTypesSection } from '@/components/landing/CreditTypesSection'
import { FaqSection } from '@/components/landing/FaqSection'
import { FeaturesSection } from '@/components/landing/FeaturesSection'
import { HeroSection } from '@/components/landing/HeroSection'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'

export function LandingPage() {
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
      <LandingFooter />
    </Box>
  )
}

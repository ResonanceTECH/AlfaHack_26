# Design System — Линия решения

**Живой UI-kit:** [/design-system](/design-system)  
Футер лендинга → **Разработчикам → Design System**.

## Assets (как в репо)

| Файл | URL | Где используется |
|------|-----|------------------|
| [`public/logo.png`](../public/logo.png) | `/logo.png` | `AlfaLogo` / `AlfaMark` (`BRAND_LOGO_SRC`) |
| [`public/favicon.png`](../public/favicon.png) | `/favicon.png` | `index.html` → `<link rel="icon">` |
| [`public/favicon-source.png`](../public/favicon-source.png) | — | исходник 1254px |

```ts
import {
  AlfaLogo,
  AlfaMark,
  BRAND_LOGO_SRC,   // '/logo.png'
  BRAND_FAVICON_SRC // '/favicon.png'
} from '@/components/landing/AlfaLogo'
```

## Исходники токенов / темы

| Файл | Роль |
|------|------|
| [`src/theme/tokens.ts`](../src/theme/tokens.ts) | color, font, space, radius, shadow, layout, iconSize |
| [`src/theme/index.ts`](../src/theme/index.ts) | MUI `createTheme` (сниппет на `/design-system` = 1:1) |
| [`src/pages/DesignSystemPage.tsx`](../src/pages/DesignSystemPage.tsx) | Витрина + карта файлов репо |
| [`src/components/design-system/CopyCode.tsx`](../src/components/design-system/CopyCode.tsx) | Копирование сниппетов |

## Компоненты (реальные пути)

| Import | Файл |
|--------|------|
| `PageHeader` | `src/components/common/PageHeader.tsx` |
| `StatBlock` | `src/components/common/StatBlock.tsx` |
| `EmptyState` | `src/components/common/EmptyState.tsx` |
| `Disclaimer` | `src/components/common/Disclaimer.tsx` |
| `AuthShell`, `AuthFooterLink` | `src/components/auth/AuthShell.tsx` |
| `PasswordField` | `src/components/auth/PasswordField.tsx` |
| `LegalFormToggle` | `src/components/onboarding/LegalFormToggle.tsx` |
| `SelectionStepper` | `src/features/selection/SelectionStepper.tsx` |
| `CreditRecommendationCard` | `src/features/credit/CreditRecommendationCard.tsx` |
| `PaymentScheduleTable` | `src/features/credit/PaymentScheduleTable.tsx` |

Полный список с копируемыми путями — секция **«Файлы репо»** на `/design-system`.

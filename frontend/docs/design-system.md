# Design System — Линия решения

**Живой UI-kit:** [/design-system](/design-system)  
Футер лендинга → **Разработчикам**.

## Что внутри UI-kit

| Группа | Компоненты / токены |
|--------|---------------------|
| Токены | цвета, типографика, space, grid, radius, shadows |
| Базовые | Button, TextField, PasswordField, Chip, Alert, Icons |
| Кабинет | PageHeader, StatBlock, EmptyState, Disclaimer, Nav, SelectionStepper |
| Продукт | CreditRecommendationCard, PaymentScheduleTable, LegalFormToggle, AuthFooterLink, LinkExpiryTimer, AlfaLogo |
| MUI-паттерны | Tabs, Accordion, Avatar, Badge, Checkbox, Radio, Switch, Skeleton, CTA rows |
| Статусы | palette + `statusLabels` / `statusColors` |

## Assets

| Файл | URL |
|------|-----|
| [`public/logo.png`](../public/logo.png) | `/logo.png` → `BRAND_LOGO_SRC` |
| [`public/favicon.png`](../public/favicon.png) | `/favicon.png` |

```ts
import { AlfaLogo, AlfaMark, BRAND_LOGO_SRC } from '@/components/landing/AlfaLogo'
import { color, font, radius, shadow } from '@/theme/tokens'
```

## Исходники

| Файл | Роль |
|------|------|
| [`src/theme/tokens.ts`](../src/theme/tokens.ts) | Токены |
| [`src/theme/index.ts`](../src/theme/index.ts) | MUI theme |
| [`src/pages/DesignSystemPage.tsx`](../src/pages/DesignSystemPage.tsx) | Витрина |
| [`src/components/design-system/ProductKitDemos.tsx`](../src/components/design-system/ProductKitDemos.tsx) | Продуктовые демо |

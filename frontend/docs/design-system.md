# Design System - Alfa Credit

Источник правды по токенам: [`src/theme/index.ts`](../src/theme/index.ts).  
Стек UI: **MUI 6** + кастомные оболочки. Шрифты: **Manrope** (display) + **IBM Plex Sans** (UI).

---

## 1. Принципы

| Принцип | Как проявляется |
|---------|-----------------|
| **Brand-first red** | `#EF3124` — CTA, активный nav, match-score, акцент в логотипе |
| **Cool slate surfaces** | Фон `#F3F5F8` + white paper; текст `#0B1F35` / `#5A6B7D` |
| **No purple / no cream kitsch** | Светлая тема, банковская плотность, без glow и pill-кластеров |
| **Cards = interaction** | Paper/Card для форм, списков, выбора; hero лендинга — full-bleed, не «карточка в карточке» |
| **Демо-дисклеймер** | Любые расчёты/рекомендации сопровождаются `Disclaimer` |

Атмосфера фона (CssBaseline): два радиальных градиента — лёгкий красный справа сверху, slate слева.

```
┌──────────────────────────────────────────────────────────┐
│  ░░ soft red glow ░░                         ░ slate ░░ │
│                                                          │
│              content / paper surfaces                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Токены

### 2.1. Цвет

| Токен | Hex | Роль |
|-------|-----|------|
| `primary.main` | `#EF3124` | Бренд, primary CTA |
| `primary.dark` | `#C41E14` | Hover / error-adjacent |
| `primary.light` | `#FF5A4F` | Soft accent |
| `secondary.main` | `#0B1F35` | Ink / dark UI |
| `background.default` | `#F3F5F8` | Кабинет / auth chrome |
| `background.paper` | `#FFFFFF` | Карточки, панели |
| `text.primary` | `#0B1F35` | Заголовки, body |
| `text.secondary` | `#5A6B7D` | Подписи, хинты |
| `success.main` | `#1B8A5A` | Done-step, positive KPI |
| `warning.main` | `#D97706` | Warnings в карточках |
| `error.main` | `#C41E14` | Ошибки форм |
| `divider` | `rgba(11,31,53,0.08)` | Разделители |

Частые ad-hoc заливки (не в palette, но по кодовой базе):

| Заливка | Где |
|---------|-----|
| `rgba(239,49,36,0.04…0.06)` | Selected chip / accent `StatBlock` / toggle |
| `rgba(11,31,53,0.03)` | Нейтральный `StatBlock` |
| `#ECEFF3` | Фон auth shell |
| `#1A1A1A` | Hero лендинга |
| `#E8EBEE` / `#9AA5B1` | Inactive stepper |

### 2.2. Типографика

| Роль | Шрифт | Вес | Notes |
|------|-------|-----|-------|
| H1–H6 | Manrope | 650–800 | `letterSpacing: -0.02…-0.03em` |
| Body / UI | IBM Plex Sans | 400–600 | Базовый `fontFamily` темы |
| Button | inherit | 600 | `textTransform: none` |

Display-заголовки в auth/landing часто override’ят `fontSize` до ~2.35rem / 48px с `fontWeight: 800`.

### 2.3. Форма и тень

| Токен | Значение |
|-------|----------|
| `shape.borderRadius` | `10` (MUI units → ~10px) |
| Button radius | `8px` |
| Paper elevation1 | `0 1px 2px rgba(11,31,53,0.04), 0 8px 24px rgba(11,31,53,0.06)` |
| Auth card shadow | `0 16px 48px rgba(11,31,53,0.14)` |

### 2.4. Кнопки (MuiButton)

- `disableElevation: true`
- Contained primary = **gradient** `135deg #EF3124 → #D4251A` (hover темнее)
- Padding: `9px 18px`
- Без ALL CAPS

```
┌─────────────────────┐
│  Оформить заявку    │   ← gradient red, white text, radius 8
└─────────────────────┘

┌─────────────────────┐
│  Как это работает   │   ← outlined / ghost на тёмном hero
└─────────────────────┘
```

### 2.5. AppBar

Glass: `rgba(255,255,255,0.88)` + `backdrop-filter: blur(12px)`, нижний hairline-divider, без box-shadow.

---

## 3. Каркас приложения (shells)

Три визуальных режима — не смешивать токены между ними без нужды.

```
┌─ Landing (#1A1A1A hero → light sections) ─┐
│  LandingHeader · Hero · Features · … · Footer │
└───────────────────────────────────────────────┘

┌─ Auth (#ECEFF3 page · white split card) ──────┐
│  AuthShell: form | buildings photo            │
└───────────────────────────────────────────────┘

┌─ Cabinet (theme bg + soft gradients) ─────────┐
│  AppLayout: sidebar 260/72 · top bar · Outlet │
└───────────────────────────────────────────────┘
```

| Shell | Файл | Назначение |
|-------|------|------------|
| `AppLayout` | `layouts/AppLayout.tsx` | Кабинет: drawer/rail, title, company switcher, avatar |
| `AuthShell` | `components/auth/AuthShell.tsx` | Login / forgot / reset / verify |
| `OnboardingShell` / `OnboardingWizardLayout` | `components/onboarding/*` | Онбординг компании / финансов |
| Landing sections | `components/landing/*` | Маркетинговая витрина |

### 3.1. AppLayout — навигация

| Состояние | Ширина | Визуал |
|-----------|--------|--------|
| Expanded | `260px` | Группы («Бизнес», «Подбор…»), иконка + label |
| Rail | `72px` | Только иконки + tooltip |
| Mobile | temporary Drawer | Бургер в top bar |

Активный пункт: красный акцент / filled icon row.  
Марка в сайдбаре: красный квадрат **A** с белой подчёркнутой буквой (`AlfaMark` / `AlfaLogo`).

### 3.2. AuthShell — композиция

```
┌──────────────────────┬──────────────────────┐
│  Альфа Банк ──       │                      │
│  Title (Manrope 800) │   buildings photo    │
│  Subtitle muted      │   (cover, right)     │
│  [ form children ]   │                      │
│  footer link         │                      │
└──────────────────────┴──────────────────────┘
         maxWidth 980 · radius 3 · white
```

`AuthFooterLink` — серый prompt + жирная primary-ссылка (без стрелки).

---

## 4. Общие компоненты (`components/common`)

### `PageHeader`

Шапка экрана кабинета.

| Prop | Тип | |
|------|-----|---|
| `title` | string | `h4` → `h1` |
| `subtitle?` | string | secondary, maxWidth 720 |
| `crumbs?` | `{ label, to? }[]` | Breadcrumbs |
| `actions?` | ReactNode | Кнопки справа |

```
Кабинет / Компания
Компания
Реквизиты и контакты активного юрлица          [ Действие ]
```

### `StatBlock`

KPI-плитка (не «продуктовая карта»).

| Prop | |
|------|---|
| `label` | caption secondary |
| `value` | Manrope h5 bold |
| `hint?` | caption |
| `accent?` | красная заливка/бордер vs нейтральная slate |

```
┌─────────────────┐  ┌─────────────────┐
│ Выручка         │  │ Match           │  accent=true → pink wash
│ 12,4 млн ₽      │  │ 87              │
│ за 12 мес.      │  │                 │
└─────────────────┘  └─────────────────┘
```

### `EmptyState`

Dashed border, полупрозрачный white, centered. Опциональный `contained` CTA через `actionTo`.

### `Disclaimer`

`Alert` `severity="info"` `variant="outlined"` — юридический текст про демо-расчёты. Prop `dense` уменьшает padding.

---

## 5. Auth / onboarding виджеты

| Компонент | Файл | Визуал / поведение |
|-----------|------|--------------------|
| `PasswordField` | `auth/PasswordField.tsx` | TextField + show/hide; trim по `PASSWORD_MAX`; optional strength hint |
| `AuthFooterLink` | `auth/AuthShell.tsx` | «Уже есть аккаунт? **Войти**» |
| `LinkExpiryTimer` | `auth/LinkExpiryTimer.tsx` | Таймер жизни magic-link |
| `LegalFormToggle` | `onboarding/LegalFormToggle.tsx` | 2-колоночный radio-card: ИП / ООО, primary border + soft red fill |
| `OnboardingWizardLayout` | `onboarding/OnboardingWizardLayout.tsx` | Шаги онбординга, back, help |
| `OnboardingShell` | `onboarding/OnboardingShell.tsx` | Боковая подсказка + контент |

**LegalFormToggle** (паттерн выбора без MUI RadioGroup):

```
┌──────────────┐  ┌──────────────┐
│ ◉  ИП        │  │ ○  ООО       │
│  red border  │  │  gray border │
└──────────────┘  └──────────────┘
```

---

## 6. Landing (`components/landing`)

| Компонент | Роль |
|-----------|------|
| `AlfaLogo` | Красный квадрат **A** + «Альфа‑Банк»; `ink` для светлых поверхностей, `compact` |
| `LandingHeader` | Sticky/top nav, CTA «Войти» |
| `HeroSection` | Full-bleed `#1A1A1A`, headline + dual CTA + stats strip + product visual |
| `FeaturesSection` / `BenefitsSection` / `CreditTypesSection` | Секции «одна мысль — один блок» |
| `ApplicationSection` | CTA в кабинет |
| `FaqSection` | Accordion +/- |
| `CabinetPreview` | Превью UI кабинета |
| `LandingFooter` | Юридическое / ссылки |
| `SvgPlaceholder` | Заглушка под иллюстрации |

Hero stats (внутри тёмного hero, не отдельные «карточки-промо»):

```
От 14%*   |  До 10 лет  |  До 150 млн ₽  |  0 ₽
ставка    |  срок       |  сумма         |  комиссия
```

---

## 7. Feature-компоненты кредита

### `SelectionStepper` — `features/selection/SelectionStepper.tsx`

5 шагов: Цель → Бюджет → Подбор → Сравнение → Заявка.

| Состояние | Круг | Подпись | Линия |
|-----------|------|---------|-------|
| done | green `#1B8A5A` + ✓ | green | green |
| current | red `#EF3124` + номер | ink bold | gray |
| upcoming | `#E8EBEE` + номер | muted | gray |

```
(✓) Цель ──── (2) Бюджет ──── (3) Подбор ──── (4) Сравнение ──── (5) Заявка
 green         red current
```

### `CreditRecommendationCard` — `features/credit/CreditRecommendationCard.tsx`

Карточка продукта (здесь Card оправдан — выбор / compare).

```
┌────────────────────────────────────┐
│ [Тип продукта]              87/100 │
│ Название продукта                  │
│ ████████████░░░░  match bar        │
│ Сумма / срок / ставка / платёж     │
│ Почему подходит · warnings         │
│ [Сравнить] [Калькулятор] [Выбрать] │
└────────────────────────────────────┘
  selected → outline 2px primary
```

### `PaymentScheduleTable` — `features/credit/PaymentScheduleTable.tsx`

Таблица графика платежей (Recharts/таблица в страницах калькулятора/сравнения).

---

## 8. Паттерны страниц (не отдельные пакеты, но «собранные» UI)

Повторяющиеся сборки на `pages/*`:

| Паттерн | Где | Из чего |
|---------|-----|---------|
| Form page | Login, CompanyCreate, … | `AuthShell` / Paper + TextField + gradient Button |
| Wizard step | Selection*, Onboarding* | Stepper + form + sticky CTA |
| List + filters | Applications, Team, Statements | PageHeader + chips/search + rows |
| Detail | ApplicationDetail, Company | Header + StatBlock grid + sections |
| Chat | AiChatPage | Thread list + bubbles + composer; brand red accents |
| Upload | StatementUpload | Dropzone + file chip + status icons |
| Compare matrix | ComparePage | Multi-product columns + check/warn icons |

Иконки: **MUI Icons Rounded/Outlined**, размер в nav ≈ `22px`, в списках часто `18–20px`, цвет акцента `#EF3124` или semantic (success/warning).

---

## 9. Состояния и feedback

| Состояние | Компонент / приём |
|-----------|-------------------|
| Loading | Button label «Входим…», Query skeletons / disabled |
| Empty | `EmptyState` |
| Error | `Alert` / field `error` + helperText |
| Success / done | green check circles, stepper done |
| Warning | `WarningAmberRounded`, `warning.main` text |
| Demo caveat | `Disclaimer` |
| Selected | primary outline / soft red fill / contained toggle |

---

## 10. Spacing & breakpoints (практика)

| Контекст | Практика |
|----------|----------|
| Page vertical rhythm | `PageHeader` `mb: 3`, секции `spacing={2…3}` |
| Card padding | MUI default / `p: 2` на StatBlock |
| Auth form | `p: { xs: 3.25, sm: 5 }` |
| Grid | часто `gridTemplateColumns` 1fr / 1fr на `md+` |
| Breakpoints | `xs` / `sm` / `md` — mobile drawer ниже `md` |

---

## 11. Что править, когда

| Хочешь изменить | Куда идти |
|-----------------|-----------|
| Глобальный цвет/шрифт/кнопка | `src/theme/index.ts` |
| Шапка любой страницы кабинета | `PageHeader` |
| KPI-плитки | `StatBlock` |
| Auth-экраны | `AuthShell` + pages |
| Логотип | `AlfaLogo` / `AlfaMark` в AppLayout |
| Мастер подбора | `SelectionStepper` + pages Selection* |
| Карточка продукта | `CreditRecommendationCard` |
| Лендинг-секции | `components/landing/*` |

---

## 12. Быстрый visual cheat-sheet

```
Brand red     ████  #EF3124
Ink           ████  #0B1F35
Muted text    ████  #5A6B7D
Page bg       ████  #F3F5F8
Paper         ████  #FFFFFF
Success       ████  #1B8A5A
Warning       ████  #D97706

Fonts:  Manrope 800  ← titles
        IBM Plex     ← UI / forms

Radius: 10 (surfaces) · 8 (buttons) · pill only for stepper dots
Shadow: soft slate, never neon glow
```

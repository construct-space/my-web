# @construct-space/ui

Vue 3 component library for Construct services. Shared components, layouts, composables, and design tokens for apps, infra surfaces, and spaces.

## Install

```bash
npm install @construct-space/ui
# or
bun add @construct-space/ui
```

### Peer Dependencies

```bash
npm install vue reka-ui @iconify/vue
```

## Usage

```ts
// Always import shared styles once in your app entry.
// No extra Tailwind setup is required in the consumer.
import '@construct-space/ui/style.css'

// Import components individually
import { Button, Input, Modal, Notification, SplitPane } from '@construct-space/ui'

// Or register all components globally with a C prefix:
// CButton, CInput, CModal, CNotification, ...
import { createApp } from 'vue'
import ConstructUI from '@construct-space/ui'

const app = createApp(App)
app.use(ConstructUI)
```

## Tabs And Groups

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Tabs, Tab, Group, Button } from '@construct-space/ui'

const activeTab = ref('developer')
</script>

<template>
  <Tabs v-model="activeTab" variant="segmented">
    <Tab label="Developer" value="developer">
      <Group gap="sm">
        <Button label="Install CLI" />
        <Button label="Run Dev" variant="soft" />
      </Group>
    </Tab>

    <Tab label="Environment" value="environment">
      Runtime checks go here.
    </Tab>
  </Tabs>
</template>
```

`Tabs` supports both patterns:
- `:items="[{ label, value }]"` plus named slots
- Declarative `<Tab label="..." value="...">...</Tab>` children

## Components

| Category | Components |
|----------|-----------|
| **Form** | `Button`, `Input`, `Textarea`, `Select`, `SelectMenu`, `Autocomplete`, `DatePicker`, `FileInput`, `MultiSelect`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `ColorPicker`, `FormField`, `ToggleGroup` |
| **Layout** | `Card`, `Modal`, `ConfirmationModal`, `Drawer`, `Slideover`, `Popover`, `DashboardPanel`, `PanelSection`, `PropRow`, `Separator`, `ScrollArea`, `SplitPane`, `Group` |
| **Data** | `Table`, `Calendar`, `Tree`, `Timeline`, `Pagination` |
| **Feedback** | `Alert`, `Badge`, `Chip`, `Progress`, `Skeleton`, `Empty`, `Notification` |
| **Menu** | `Dropdown`, `DropdownMenu`, `DropdownMenuItem`, `ContextMenu`, `Tabs`, `Tab` |
| **Display** | `Icon`, `Avatar`, `Accordion`, `Tooltip`, `Kbd`, `Breadcrumbs` |
| **Shell** | `Sidebar3D`, `Toolbar3D`, `SidebarLayout`, `HeaderLayout` |

## Layouts

```vue
<!-- 60px icon sidebar (billing, delivery pattern) -->
<SidebarLayout
  :nav-items="[{ icon: 'home', label: 'Dashboard', to: '/', active: true }]"
  user-name="John"
  @navigate="router.push($event)"
  @logout="auth.logout()"
>
  <router-view />
</SidebarLayout>

<!-- Top header bar -->
<HeaderLayout
  service-name="domains"
  :nav-items="[{ label: 'Dashboard', to: '/' }]"
>
  <router-view />
</HeaderLayout>
```

## Composables

```ts
import { useNotification, useAuth } from '@construct-space/ui'

// Notification state
const { add, remove, clear } = useNotification()
add({ title: 'Saved', color: 'success' })

// Auth session management
const { user, login, logout, checkSession } = useAuth({
  mePath: '/api/auth/me',
  loginPath: '/api/auth/login',
})
```

## Notes

- Prefer `Notification` and `useNotification()`. They are the primary feedback API.
- Import [`@construct-space/ui/style.css`](./dist/style.css) once per app. Components rely on that stylesheet for tokens and generated utility CSS.

## Theming

Override CSS variables to customize colors per service:

```css
:root {
  --app-accent: #d4a843;      /* billing: gold */
  --app-accent: #ec4899;      /* domains: pink */
  --app-accent: #FF2D55;      /* delivery: red */
  --app-background: #18181b;
  --app-foreground: #fafafa;
  --app-border: #27272a;
}
```

## License

MIT

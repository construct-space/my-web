import type { Plugin } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export interface UIOptions {
  /** Prefix for auto-imported components (default: none) */
  prefix?: string
}

/** All component names exported from @construct-space/ui-web */
const components = [
  'Accordion', 'Alert', 'Avatar', 'Badge', 'Button', 'Calendar',
  'Card', 'Checkbox', 'Chip', 'ColorPicker', 'ConfirmationModal',
  'ContextMenu', 'DashboardPanel', 'Drawer', 'Dropdown',
  'DropdownMenu', 'DropdownMenuItem', 'Empty', 'FormField',
  'Group', 'Icon', 'Input', 'InputPassword', 'Kbd', 'Modal', 'Pagination',
  'PanelSection', 'Popover', 'Progress', 'PropRow', 'RadioGroup',
  'ScrollArea', 'Select', 'SelectMenu', 'Separator', 'Skeleton',
  'Slideover', 'Slider', 'SplitPane', 'Switch', 'Tab', 'Table',
  'Tabs', 'Textarea', 'Timeline', 'Notification', 'Tooltip',
  'Tree', 'Autocomplete', 'Breadcrumbs', 'DatePicker', 'FileInput',
  'MultiSelect', 'Sidebar3D', 'ToggleGroup', 'Toolbar3D',
  'SidebarLayout', 'HeaderLayout',
]

/** All composable/utility names exported from @construct-space/ui-web */
const composables: string[] = [
  'useTheme', 'useNotification', 'notify', 'useAuth',
  'useClipboard', 'useMediaQuery', 'useBreakpoints',
  'useFormValidation', 'required', 'minLength', 'maxLength', 'email', 'pattern',
  'useKeyboard', 'useHotkey', 'useClickOutside', 'useLocalStorage',
  'useAsync', 'useDebounce', 'useThrottle', 'debounce',
  'useToggle', 'useCounter', 'useSearch', 'useIntersectionObserver',
  'useEscapeKey',
]

/**
 * Construct UI Vite plugin.
 *
 * Registers unplugin-auto-import and unplugin-vue-components so that
 * all Construct UI components and composables auto-import in consuming apps.
 *
 * Usage:
 * ```ts
 * // vite.config.ts
 * import ui from '@construct-space/ui-web/vite'
 * export default defineConfig({ plugins: [ui()] })
 * ```
 */
export default function ui(options: UIOptions = {}): any[] {
  const prefix = options.prefix || ''

  return [
    AutoImport({
      // Include 'vue' here so consuming apps that don't register their own
      // AutoImport still get ref/computed/onMounted/etc. hooked up — this
      // matters because ui-web's .vue sources rely on these being globals
      // (they are in ui-web's own build). If the consumer already runs its
      // own AutoImport for 'vue', unplugin safely de-dupes.
      imports: [
        'vue',
        {
          '@construct-space/ui-web': composables,
        },
      ],
    }),
    Components({
      resolvers: [
        (componentName: string) => {
          const name = prefix && componentName.startsWith(prefix)
            ? componentName.slice(prefix.length)
            : componentName

          if (components.includes(name)) {
            return { name, from: '@construct-space/ui-web' }
          }
        },
      ],
    }),
  ]
}

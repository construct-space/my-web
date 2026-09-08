<script setup lang="ts">
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  type OrgProject,
  type CreateProjectInput,
} from '../api'

const projects = ref<OrgProject[]>([])
const loading  = ref(false)
const error    = ref<string | null>(null)

// Form state. Kept inline (not a modal) to mirror Members.vue — the
// form expands above the grid so focus order is natural. `editingId`
// doubles as "form is open in edit mode" vs null = create mode.
const showForm  = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)

const form = ref<CreateProjectInput>({
  name: '',
  description: '',
  repo_url: '',
  default_branch: '',
  framework: '',
})

// Row-level state: which card's kebab menu is open. Only one at a time
// so the menu feels like a popover even though it's plain DOM.
const openMenu = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    projects.value = await listProjects()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.value = { name: '', description: '', repo_url: '', default_branch: '', framework: '' }
  editingId.value = null
  formError.value = null
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(p: OrgProject) {
  editingId.value = p.id
  form.value = {
    name: p.name,
    description: p.description || '',
    repo_url: p.repo_url || '',
    default_branch: p.default_branch || '',
    framework: p.framework || '',
  }
  formError.value = null
  showForm.value = true
  openMenu.value = null
}

function closeForm() {
  showForm.value = false
  resetForm()
}

async function submit() {
  formError.value = null
  const name = form.value.name.trim()
  if (!name) { formError.value = 'Name is required.'; return }

  // Only send non-empty optional fields — source expects omitted keys
  // rather than empty strings for "no change / no value".
  const patch: CreateProjectInput = { name }
  if (form.value.description?.trim())    patch.description    = form.value.description.trim()
  if (form.value.repo_url?.trim())       patch.repo_url       = form.value.repo_url.trim()
  if (form.value.default_branch?.trim()) patch.default_branch = form.value.default_branch.trim()
  if (form.value.framework?.trim())      patch.framework      = form.value.framework.trim()

  submitting.value = true
  try {
    if (editingId.value) {
      const updated = await updateProject(editingId.value, patch)
      const idx = projects.value.findIndex((x) => x.id === updated.id)
      if (idx >= 0) projects.value[idx] = updated
    } else {
      const created = await createProject(patch)
      projects.value = [created, ...projects.value]
    }
    closeForm()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

async function doDelete(p: OrgProject) {
  if (!confirm(`Delete project "${p.name}"? This cannot be undone.`)) return
  openMenu.value = null
  try {
    await deleteProject(p.id)
    projects.value = projects.value.filter((x) => x.id !== p.id)
    // If the form was editing this project, close it.
    if (editingId.value === p.id) closeForm()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function toggleMenu(id: string, ev: Event) {
  ev.preventDefault()
  ev.stopPropagation()
  openMenu.value = openMenu.value === id ? null : id
}

// Framework → lucide icon. Covers the five common values we ship; any
// other string falls back to the generic folder icon.
const frameworkIcon: Record<string, string> = {
  next:   'lucide:wand-2',
  vue:    'lucide:triangle',
  svelte: 'lucide:flame',
  react:  'lucide:atom',
  other:  'lucide:folder-kanban',
}
function iconFor(fw?: string): string {
  if (!fw) return 'lucide:folder-kanban'
  return frameworkIcon[fw.toLowerCase()] || 'lucide:folder-kanban'
}

function relTime(iso?: string): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  const s = Math.floor(diff / 1000)
  if (s < 60)        return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)        return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)        return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)        return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12)       return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

onMounted(load)
</script>

<template>
  <section class="max-w-5xl flex flex-col gap-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Projects</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Org-level projects bundle a repo, framework, and the teammates working on it.
        </p>
      </div>
      <Button
        v-if="!showForm"
        icon="lucide:plus"
        @click="openCreate"
      >
        New project
      </Button>
      <Button
        v-else
        variant="ghost"
        icon="lucide:x"
        @click="closeForm"
      >
        Cancel
      </Button>
    </div>

    <!-- Create / edit form. Same component covers both; `editingId`
         flips the submit label and endpoint. -->
    <form
      v-if="showForm"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3"
      @submit.prevent="submit"
    >
      <div class="text-sm font-medium">
        {{ editingId ? 'Edit project' : 'New project' }}
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 flex flex-col gap-1">
          <label for="project-name" class="text-xs text-[var(--app-muted)]">Name</label>
          <Input
            id="project-name"
            v-model="form.name"
            placeholder="My new project"
            icon="lucide:folder-kanban"
            :disabled="submitting"
            required
          />
        </div>
        <div class="sm:w-48 flex flex-col gap-1">
          <label for="project-framework" class="text-xs text-[var(--app-muted)]">Framework</label>
          <Input
            id="project-framework"
            v-model="form.framework"
            placeholder="next, vue, svelte, react…"
            :disabled="submitting"
          />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label for="project-description" class="text-xs text-[var(--app-muted)]">Description</label>
        <Input
          id="project-description"
          v-model="form.description"
          placeholder="What's this project about?"
          :disabled="submitting"
        />
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <div class="flex-1 flex flex-col gap-1">
          <label for="project-repo" class="text-xs text-[var(--app-muted)]">Repo URL</label>
          <Input
            id="project-repo"
            v-model="form.repo_url"
            type="url"
            placeholder="https://github.com/org/repo"
            icon="lucide:github"
            :disabled="submitting"
          />
        </div>
        <div class="sm:w-48 flex flex-col gap-1">
          <label for="project-branch" class="text-xs text-[var(--app-muted)]">Default branch</label>
          <Input
            id="project-branch"
            v-model="form.default_branch"
            placeholder="main"
            icon="lucide:git-branch"
            :disabled="submitting"
          />
        </div>
      </div>

      <div v-if="formError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ formError }}</span>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" :disabled="submitting" @click="closeForm">Cancel</Button>
        <Button type="submit" :loading="submitting" :disabled="submitting || !form.name.trim()">
          {{ editingId ? (submitting ? 'Saving…' : 'Save changes') : (submitting ? 'Creating…' : 'Create project') }}
        </Button>
      </div>
    </form>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !projects.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="projects.length"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-live="polite"
    >
      <div
        v-for="p in projects"
        :key="p.id"
        class="relative group"
      >
        <RouterLink
          :to="`/org/projects/${p.id}`"
          class="block rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 h-full transition hover:border-[var(--app-accent)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]"
        >
          <div class="flex items-start gap-3">
            <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
              <Icon :icon="iconFor(p.framework)" class="size-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold truncate">{{ p.name }}</div>
              <div v-if="p.framework" class="text-xs text-[var(--app-muted)] capitalize mt-0.5">{{ p.framework }}</div>
            </div>
            <!-- Spacer so the absolute kebab doesn't overlap the name. -->
            <div class="size-8 shrink-0" aria-hidden="true"></div>
          </div>

          <p
            v-if="p.description"
            class="mt-3 text-sm text-[var(--app-muted)] line-clamp-2"
          >{{ p.description }}</p>

          <a
            v-if="p.repo_url"
            :href="p.repo_url"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--app-muted)] hover:text-[var(--app-accent)] max-w-full"
            @click.stop
          >
            <Icon icon="lucide:github" class="size-3.5 shrink-0" />
            <span class="truncate">{{ p.repo_url.replace(/^https?:\/\//, '') }}</span>
          </a>

          <div class="mt-4 pt-3 border-t border-[var(--app-border)] text-xs text-[var(--app-muted)]">
            Created {{ relTime(p.created_at) }}
          </div>
        </RouterLink>

        <!-- Kebab menu sits above the RouterLink; all handlers stop
             propagation so the card click-through doesn't fire. -->
        <div class="absolute top-4 right-4">
          <button
            type="button"
            class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:bg-[var(--app-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]"
            :aria-label="`Actions for ${p.name}`"
            :aria-expanded="openMenu === p.id"
            @click="toggleMenu(p.id, $event)"
          >
            <Icon icon="lucide:more-horizontal" class="size-4" />
          </button>
          <div
            v-if="openMenu === p.id"
            class="absolute right-0 mt-1 w-36 rounded-md border border-[var(--app-border)] bg-[var(--app-card-bg)] shadow-lg z-10 overflow-hidden"
            role="menu"
            @click.stop
          >
            <button
              type="button"
              role="menuitem"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[var(--app-surface)]"
              @click.prevent.stop="openEdit(p)"
            >
              <Icon icon="lucide:pencil" class="size-4" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-500 hover:bg-[color-mix(in_srgb,red_8%,transparent)]"
              @click.prevent.stop="doDelete(p)"
            >
              <Icon icon="lucide:trash-2" class="size-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="!loading"
      class="rounded-xl border border-dashed border-[var(--app-border)] p-10 text-center"
    >
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:folder-kanban" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No projects yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Organization projects bundle a repo, framework, and the teammates working on it.
      </p>
      <div class="mt-4">
        <Button icon="lucide:plus" @click="openCreate">Create your first project</Button>
      </div>
    </div>
  </section>
</template>

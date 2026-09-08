<script setup lang="ts">
import {
  getProject,
  updateProject,
  deleteProject,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  listProjectRepos,
  addProjectRepo,
  removeProjectRepo,
  listMembers,
  type OrgProject,
  type CreateProjectInput,
  type ProjectMember,
  type ProjectRepo,
  type Member,
} from '../api'

const props = defineProps<{ projectId: string }>()

// Org space is loaded by the core shell, which owns the router. Following
// account-space convention, we navigate via window.location rather than
// pulling vue-router into every space package. RouterLink is a globally
// registered component, so template links still work fine.
function navigateTo(path: string) {
  window.location.assign(path)
}

const project = ref<OrgProject | null>(null)
const members = ref<ProjectMember[]>([])
const repos   = ref<ProjectRepo[]>([])
const orgMembers = ref<Member[]>([])

const loading = ref(true)
const error   = ref<string | null>(null)

// Edit form state.
const editing    = ref(false)
const savingEdit = ref(false)
const editError  = ref<string | null>(null)
const editForm = ref<CreateProjectInput>({
  name: '',
  description: '',
  repo_url: '',
  default_branch: '',
  framework: '',
})

// Add-member state.
const showAddMember = ref(false)
const newMemberId   = ref<string>('')
const addingMember  = ref(false)
const memberError   = ref<string | null>(null)
const busyMemberRow = ref<string | null>(null)

// Add-repo state.
const showAddRepo = ref(false)
const addingRepo  = ref(false)
const repoError   = ref<string | null>(null)
const busyRepoRow = ref<string | null>(null)
const repoForm = ref<{ provider: string; name: string; url: string; default_branch: string }>({
  provider: 'github',
  name: '',
  url: '',
  default_branch: '',
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const [p, m, r, om] = await Promise.allSettled([
      getProject(props.projectId),
      listProjectMembers(props.projectId),
      listProjectRepos(props.projectId),
      listMembers(),
    ])
    if (p.status === 'fulfilled') project.value = p.value
    else throw p.reason
    if (m.status === 'fulfilled') members.value = m.value
    if (r.status === 'fulfilled') repos.value = r.value
    if (om.status === 'fulfilled') orgMembers.value = om.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startEdit() {
  if (!project.value) return
  editForm.value = {
    name: project.value.name,
    description: project.value.description || '',
    repo_url: project.value.repo_url || '',
    default_branch: project.value.default_branch || '',
    framework: project.value.framework || '',
  }
  editError.value = null
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editError.value = null
}

async function saveEdit() {
  if (!project.value) return
  editError.value = null
  const name = editForm.value.name.trim()
  if (!name) { editError.value = 'Name is required.'; return }

  // Mirror Projects.vue — only send non-empty optional fields.
  const patch: CreateProjectInput = { name }
  if (editForm.value.description?.trim())    patch.description    = editForm.value.description.trim()
  if (editForm.value.repo_url?.trim())       patch.repo_url       = editForm.value.repo_url.trim()
  if (editForm.value.default_branch?.trim()) patch.default_branch = editForm.value.default_branch.trim()
  if (editForm.value.framework?.trim())      patch.framework      = editForm.value.framework.trim()

  savingEdit.value = true
  try {
    project.value = await updateProject(project.value.id, patch)
    editing.value = false
  } catch (e) {
    editError.value = e instanceof Error ? e.message : String(e)
  } finally {
    savingEdit.value = false
  }
}

async function doDelete() {
  if (!project.value) return
  if (!confirm(`Delete project "${project.value.name}"? This cannot be undone.`)) return
  try {
    await deleteProject(project.value.id)
    navigateTo('/org/projects')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// Org members not yet on the project — drives the add-member picker so the
// user never tries to add someone who's already a member.
const addableOrgMembers = computed(() => {
  const taken = new Set(members.value.map((pm) => pm.member_id))
  return orgMembers.value.filter((m) => !taken.has(m.id))
})

const memberPickerOptions = computed(() =>
  addableOrgMembers.value.map((m) => ({
    label: m.name ? `${m.name} (${m.email})` : m.email,
    value: m.id,
  })),
)

function resolveMember(pm: ProjectMember): { name: string; email: string } {
  if (pm.member) return { name: pm.member.name, email: pm.member.email }
  const hit = orgMembers.value.find((m) => m.id === pm.member_id)
  if (hit) return { name: hit.name, email: hit.email }
  return { name: pm.member_id, email: '' }
}

function initials(name: string | undefined, email: string): string {
  const base = (name || email || '?').trim()
  const parts = base.split(/\s+|@/).filter(Boolean)
  return parts.slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?'
}

async function submitAddMember() {
  memberError.value = null
  if (!newMemberId.value) { memberError.value = 'Pick a member to add.'; return }
  addingMember.value = true
  try {
    const created = await addProjectMember(props.projectId, { member_id: newMemberId.value })
    members.value = [...members.value, created]
    newMemberId.value = ''
    showAddMember.value = false
  } catch (e) {
    memberError.value = e instanceof Error ? e.message : String(e)
  } finally {
    addingMember.value = false
  }
}

async function doRemoveMember(pm: ProjectMember) {
  const who = resolveMember(pm)
  const label = who.name || who.email || 'this member'
  if (!confirm(`Remove ${label} from the project?`)) return
  busyMemberRow.value = pm.id
  try {
    await removeProjectMember(props.projectId, pm.member_id)
    members.value = members.value.filter((x) => x.id !== pm.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busyMemberRow.value = null
  }
}

const providerOptions = [
  { label: 'GitHub',    value: 'github' },
  { label: 'GitLab',    value: 'gitlab' },
  { label: 'Bitbucket', value: 'bitbucket' },
  { label: 'Other',     value: 'other' },
]

function providerIcon(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'github':    return 'lucide:github'
    case 'gitlab':    return 'lucide:gitlab'
    case 'bitbucket': return 'lucide:git-branch'
    default:          return 'lucide:git-branch'
  }
}

function resetRepoForm() {
  repoForm.value = { provider: 'github', name: '', url: '', default_branch: '' }
  repoError.value = null
}

async function submitAddRepo() {
  repoError.value = null
  const name = repoForm.value.name.trim()
  const url  = repoForm.value.url.trim()
  if (!url) { repoError.value = 'Repo URL is required.'; return }

  const body: { provider: string; name: string; url: string; default_branch?: string } = {
    provider: repoForm.value.provider,
    // Fall back to the URL's tail so the server always gets a non-empty
    // name — keeps list rendering predictable.
    name: name || url.replace(/\/+$/, '').split('/').slice(-1)[0] || url,
    url,
  }
  if (repoForm.value.default_branch.trim()) body.default_branch = repoForm.value.default_branch.trim()

  addingRepo.value = true
  try {
    const created = await addProjectRepo(props.projectId, body)
    repos.value = [...repos.value, created]
    resetRepoForm()
    showAddRepo.value = false
  } catch (e) {
    repoError.value = e instanceof Error ? e.message : String(e)
  } finally {
    addingRepo.value = false
  }
}

async function doRemoveRepo(r: ProjectRepo) {
  if (!confirm(`Remove repo "${r.name}" from the project?`)) return
  busyRepoRow.value = r.id
  try {
    await removeProjectRepo(props.projectId, r.id)
    repos.value = repos.value.filter((x) => x.id !== r.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busyRepoRow.value = null
  }
}

// Framework → lucide icon — mirrors Projects.vue so the list card and
// detail header feel continuous.
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
    <nav class="text-sm text-[var(--app-muted)] flex items-center gap-1.5" aria-label="Breadcrumb">
      <RouterLink
        to="/org/projects"
        class="inline-flex items-center gap-1 hover:text-[var(--app-foreground)]"
      >
        <Icon icon="lucide:arrow-left" class="size-3.5" />
        <span>Projects</span>
      </RouterLink>
      <Icon icon="lucide:chevron-right" class="size-3.5" />
      <span class="text-[var(--app-foreground)] truncate">{{ project?.name || '…' }}</span>
    </nav>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500" role="alert">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <div v-if="loading && !project" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <template v-else-if="project">
      <!-- Header card. -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5">
        <div class="flex items-start gap-4">
          <div class="size-11 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
            <Icon :icon="iconFor(project.framework)" class="size-6" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-xl font-semibold truncate">{{ project.name }}</h1>
              <span
                v-if="project.framework"
                class="text-xs px-1.5 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] capitalize"
              >{{ project.framework }}</span>
            </div>
            <p
              v-if="project.description"
              class="text-sm text-[var(--app-muted)] mt-1"
            >{{ project.description }}</p>
            <div class="text-xs text-[var(--app-muted)] mt-2">
              Created {{ relTime(project.created_at) }} by {{ project.created_by }}
            </div>
            <a
              v-if="project.repo_url"
              :href="project.repo_url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--app-muted)] hover:text-[var(--app-accent)] max-w-full"
            >
              <Icon icon="lucide:github" class="size-3.5 shrink-0" />
              <span class="truncate">{{ project.repo_url.replace(/^https?:\/\//, '') }}</span>
              <span v-if="project.default_branch" class="shrink-0">· {{ project.default_branch }}</span>
            </a>
          </div>
          <div v-if="!editing" class="flex items-center gap-2 shrink-0">
            <Button variant="ghost" icon="lucide:pencil" @click="startEdit">Edit</Button>
            <Button variant="ghost" icon="lucide:trash-2" @click="doDelete">Delete</Button>
          </div>
        </div>

        <!-- Edit form. Lives inside the header card so the layout doesn't
             jump when it opens. -->
        <form
          v-if="editing"
          class="mt-5 pt-5 border-t border-[var(--app-border)] flex flex-col gap-3"
          @submit.prevent="saveEdit"
        >
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1 flex flex-col gap-1">
              <label for="edit-name" class="text-xs text-[var(--app-muted)]">Name</label>
              <Input
                id="edit-name"
                v-model="editForm.name"
                placeholder="My new project"
                icon="lucide:folder-kanban"
                :disabled="savingEdit"
                required
              />
            </div>
            <div class="sm:w-48 flex flex-col gap-1">
              <label for="edit-framework" class="text-xs text-[var(--app-muted)]">Framework</label>
              <Input
                id="edit-framework"
                v-model="editForm.framework"
                placeholder="next, vue, svelte, react…"
                :disabled="savingEdit"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label for="edit-description" class="text-xs text-[var(--app-muted)]">Description</label>
            <Input
              id="edit-description"
              v-model="editForm.description"
              placeholder="What's this project about?"
              :disabled="savingEdit"
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1 flex flex-col gap-1">
              <label for="edit-repo" class="text-xs text-[var(--app-muted)]">Repo URL</label>
              <Input
                id="edit-repo"
                v-model="editForm.repo_url"
                type="url"
                placeholder="https://github.com/org/repo"
                icon="lucide:github"
                :disabled="savingEdit"
              />
            </div>
            <div class="sm:w-48 flex flex-col gap-1">
              <label for="edit-branch" class="text-xs text-[var(--app-muted)]">Default branch</label>
              <Input
                id="edit-branch"
                v-model="editForm.default_branch"
                placeholder="main"
                icon="lucide:git-branch"
                :disabled="savingEdit"
              />
            </div>
          </div>

          <div v-if="editError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
            <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
            <span>{{ editError }}</span>
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" :disabled="savingEdit" @click="cancelEdit">Cancel</Button>
            <Button type="submit" :loading="savingEdit" :disabled="savingEdit || !editForm.name.trim()">
              {{ savingEdit ? 'Saving…' : 'Save changes' }}
            </Button>
          </div>
        </form>
      </div>

      <!-- Members section. -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">Members</h2>
            <p class="text-xs text-[var(--app-muted)] mt-0.5">
              Teammates working on this project.
            </p>
          </div>
          <Button
            v-if="!showAddMember"
            icon="lucide:user-plus"
            variant="ghost"
            :disabled="!addableOrgMembers.length"
            @click="showAddMember = true"
          >
            Add member
          </Button>
          <Button
            v-else
            variant="ghost"
            icon="lucide:x"
            @click="showAddMember = false; memberError = null"
          >
            Cancel
          </Button>
        </div>

        <form
          v-if="showAddMember"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-3"
          @submit.prevent="submitAddMember"
        >
          <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div class="flex-1 flex flex-col gap-1">
              <label class="text-xs text-[var(--app-muted)]">Org member</label>
              <SelectMenu
                v-model="newMemberId"
                :options="memberPickerOptions"
                searchable
                placeholder="Pick a teammate…"
                :disabled="addingMember || !memberPickerOptions.length"
              />
            </div>
            <Button type="submit" :loading="addingMember" :disabled="addingMember || !newMemberId">
              {{ addingMember ? 'Adding…' : 'Add member' }}
            </Button>
          </div>
          <div v-if="memberError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
            <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
            <span>{{ memberError }}</span>
          </div>
          <div v-if="!memberPickerOptions.length" class="text-xs text-[var(--app-muted)]">
            All org members are already on this project.
          </div>
        </form>

        <div
          v-if="members.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]"
        >
          <div
            v-for="pm in members"
            :key="pm.id"
            class="flex items-center gap-4 px-5 py-3.5"
          >
            <div class="size-9 rounded-full grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] text-sm font-semibold shrink-0">
              {{ initials(resolveMember(pm).name, resolveMember(pm).email) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {{ resolveMember(pm).name || resolveMember(pm).email || pm.member_id }}
              </div>
              <div v-if="resolveMember(pm).email" class="text-xs text-[var(--app-muted)] truncate">
                {{ resolveMember(pm).email }}
              </div>
            </div>
            <span
              v-if="pm.role"
              class="text-xs font-medium px-2 py-1 rounded capitalize bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0"
            >{{ pm.role }}</span>
            <button
              type="button"
              class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-red-500 hover:bg-[color-mix(in_srgb,red_8%,transparent)] disabled:opacity-40"
              :disabled="busyMemberRow === pm.id"
              :aria-label="`Remove ${resolveMember(pm).name || resolveMember(pm).email}`"
              @click="doRemoveMember(pm)"
            >
              <Icon icon="lucide:trash-2" class="size-4" />
            </button>
          </div>
        </div>
        <div
          v-else
          class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center"
        >
          <div class="size-10 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon icon="lucide:users" class="size-5" />
          </div>
          <div class="text-sm font-medium mt-3">No members yet</div>
          <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
            Add teammates so they show up on this project's dashboard.
          </p>
        </div>
      </div>

      <!-- Repos section. -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">Repositories</h2>
            <p class="text-xs text-[var(--app-muted)] mt-0.5">
              Source repos connected to this project.
            </p>
          </div>
          <Button
            v-if="!showAddRepo"
            icon="lucide:plus"
            variant="ghost"
            @click="resetRepoForm(); showAddRepo = true"
          >
            Add repo
          </Button>
          <Button
            v-else
            variant="ghost"
            icon="lucide:x"
            @click="showAddRepo = false; repoError = null"
          >
            Cancel
          </Button>
        </div>

        <form
          v-if="showAddRepo"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex flex-col gap-3"
          @submit.prevent="submitAddRepo"
        >
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="sm:w-40 flex flex-col gap-1">
              <label class="text-xs text-[var(--app-muted)]">Provider</label>
              <SelectMenu
                v-model="repoForm.provider"
                :options="providerOptions"
                :disabled="addingRepo"
              />
            </div>
            <div class="flex-1 flex flex-col gap-1">
              <label for="repo-name" class="text-xs text-[var(--app-muted)]">Name</label>
              <Input
                id="repo-name"
                v-model="repoForm.name"
                placeholder="org/repo"
                :disabled="addingRepo"
              />
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex-1 flex flex-col gap-1">
              <label for="repo-url" class="text-xs text-[var(--app-muted)]">URL</label>
              <Input
                id="repo-url"
                v-model="repoForm.url"
                type="url"
                placeholder="https://github.com/org/repo"
                icon="lucide:link"
                :disabled="addingRepo"
                required
              />
            </div>
            <div class="sm:w-48 flex flex-col gap-1">
              <label for="repo-branch" class="text-xs text-[var(--app-muted)]">Default branch</label>
              <Input
                id="repo-branch"
                v-model="repoForm.default_branch"
                placeholder="main"
                icon="lucide:git-branch"
                :disabled="addingRepo"
              />
            </div>
          </div>
          <div v-if="repoError" class="flex items-start gap-2 text-sm text-red-500" role="alert">
            <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
            <span>{{ repoError }}</span>
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              :disabled="addingRepo"
              @click="showAddRepo = false; repoError = null"
            >Cancel</Button>
            <Button type="submit" :loading="addingRepo" :disabled="addingRepo || !repoForm.url.trim()">
              {{ addingRepo ? 'Adding…' : 'Add repo' }}
            </Button>
          </div>
        </form>

        <div
          v-if="repos.length"
          class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]"
        >
          <div
            v-for="r in repos"
            :key="r.id"
            class="flex items-center gap-4 px-5 py-3.5"
          >
            <div class="size-9 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)] shrink-0">
              <Icon :icon="providerIcon(r.provider)" class="size-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ r.name }}</div>
              <a
                :href="r.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-[var(--app-muted)] hover:text-[var(--app-accent)] truncate inline-flex items-center gap-1"
              >
                <span class="truncate">{{ r.url.replace(/^https?:\/\//, '') }}</span>
                <Icon icon="lucide:external-link" class="size-3 shrink-0" />
              </a>
            </div>
            <span
              v-if="r.default_branch"
              class="text-xs text-[var(--app-muted)] shrink-0 hidden sm:inline"
            >{{ r.default_branch }}</span>
            <button
              type="button"
              class="size-8 rounded-md grid place-items-center text-[var(--app-muted)] hover:text-red-500 hover:bg-[color-mix(in_srgb,red_8%,transparent)] disabled:opacity-40"
              :disabled="busyRepoRow === r.id"
              :aria-label="`Remove repo ${r.name}`"
              @click="doRemoveRepo(r)"
            >
              <Icon icon="lucide:trash-2" class="size-4" />
            </button>
          </div>
        </div>
        <div
          v-else
          class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center"
        >
          <div class="size-10 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon icon="lucide:git-branch" class="size-5" />
          </div>
          <div class="text-sm font-medium mt-3">No repos linked</div>
          <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
            Connect a GitHub, GitLab, or Bitbucket repo to track this project's code.
          </p>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * Publish — directs users to the real publish surfaces (desktop app +
 * CLI). The portal doesn't accept bundle uploads from a web form; the
 * build happens where the source code is (IDE, CI), and the CLI + app
 * handle packaging + submission.
 *
 * This page is a governance landing: links, a cli cheatsheet, and a
 * "what happens next" pointer to Spaces where they can track review.
 */
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'

const session = useSessionStore()
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Publish a space</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Spaces are built and pushed from the Construct desktop app or the
        <code class="font-mono bg-[var(--app-surface)] px-1.5 py-0.5 rounded text-xs">construct</code> CLI —
        not from a web form. Review, ownership, and analytics all live in this portal.
      </p>
    </div>

    <div class="grid md:grid-cols-2 gap-3">
      <!-- Desktop path -->
      <a
        href="construct://author/publish"
        class="group rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:border-[var(--app-accent)] transition-colors flex flex-col gap-3"
      >
        <div class="flex items-start gap-3">
          <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]">
            <Icon icon="lucide:laptop" class="size-5" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-semibold">Construct Desktop</div>
            <div class="text-xs text-[var(--app-muted)] mt-0.5">
              Recommended — one click from Space Developer
            </div>
          </div>
          <Icon icon="lucide:arrow-up-right" class="size-4 text-[var(--app-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
        </div>
        <p class="text-xs text-[var(--app-muted)]">
          Opens the app → Space Developer → <span class="font-medium text-[var(--app-foreground)]">Publish</span>.
          It packages the IIFE bundle and submits it for review.
        </p>
      </a>

      <!-- CLI path -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
        <div class="flex items-start gap-3">
          <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-foreground)]">
            <Icon icon="lucide:terminal" class="size-5" />
          </div>
          <div class="flex-1">
            <div class="text-sm font-semibold">Command line</div>
            <div class="text-xs text-[var(--app-muted)] mt-0.5">
              Scriptable — works in CI
            </div>
          </div>
        </div>
        <pre class="bg-[var(--app-surface)] border border-[var(--app-border)] rounded px-3 py-2 text-xs font-mono overflow-x-auto leading-relaxed m-0"># First time (reuses your app session)
construct login

# Scaffold, build, submit
construct scaffold my-space
cd my-space
construct publish</pre>
      </div>
    </div>

    <!-- What happens next -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <div class="size-8 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:workflow" class="size-4" />
        </div>
        <h2 class="text-sm font-semibold">What happens after you publish</h2>
      </div>
      <ol class="text-sm text-[var(--app-muted)] flex flex-col gap-2 pl-4 list-decimal">
        <li>The bundle uploads to the registry and your space enters <span class="text-[var(--app-foreground)] font-medium">Pending review</span>.</li>
        <li>
          Track status on
          <RouterLink to="/developer/spaces" class="text-[var(--app-accent)] hover:underline">My spaces</RouterLink>
          — each state (approved, changes requested, rejected) shows there.
        </li>
        <li>Approved spaces go live on the marketplace under your publisher slug.</li>
      </ol>
    </div>

    <!-- Prereqs -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 text-sm text-[var(--app-muted)]">
      <p class="font-medium text-[var(--app-foreground)] mb-1">Before you can publish</p>
      <ul class="flex flex-col gap-1 pl-5 list-disc">
        <li>
          <RouterLink to="/developer/keys" class="text-[var(--app-accent)] hover:underline">Enroll as a publisher</RouterLink>
          to get an API key (the CLI picks it up automatically).
        </li>
        <li>
          Set your
          <RouterLink to="/developer/profile" class="text-[var(--app-accent)] hover:underline">publisher profile</RouterLink>
          — it's shown next to every space you ship.
        </li>
        <li v-if="!session.isAuthenticated">
          <RouterLink to="/login" class="text-[var(--app-accent)] hover:underline">Sign in</RouterLink>
          first so the submission is attached to your account.
        </li>
      </ul>
    </div>
  </section>
</template>

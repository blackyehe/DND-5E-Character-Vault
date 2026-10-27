<script setup lang="ts">
import { dismissNavigationRecovery, navigationRecoveryTarget, reloadNavigationTarget } from '../../lib/navigation-recovery'
</script>

<template>
  <aside v-if="navigationRecoveryTarget" class="navigation-recovery" aria-label="Page loading recovery">
    <p role="alert">This page could not load. The site may have been updated, or the connection was interrupted. Save your work, then reload to continue.</p>
    <div class="navigation-recovery-actions">
      <button type="button" class="btn-primary" @click="reloadNavigationTarget">Reload and continue</button>
      <button type="button" class="btn-ghost" @click="dismissNavigationRecovery">Keep working</button>
    </div>
  </aside>
</template>

<style scoped>
.navigation-recovery { padding: 16px 24px; border-bottom: 1px solid var(--cb-line); background: var(--cb-paper); color: var(--cb-ink); }
.navigation-recovery p { margin: 0 0 12px; }
.navigation-recovery-actions { display: flex; gap: 12px; flex-wrap: wrap; }
</style>

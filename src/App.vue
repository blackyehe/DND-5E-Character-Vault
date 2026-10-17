<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppNav from './components/ui/AppNav.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppNav />
    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>

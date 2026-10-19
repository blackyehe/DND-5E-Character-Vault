<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import type { RoomSummary } from '../../shared/rooms'
import '../components/sheet/sheet.css'
import '../rooms.css'
const router = useRouter(), rooms = ref<RoomSummary[]>([]), name = ref(''), error = ref(''), busy = ref(false), loading = ref(true)
async function load() { try { rooms.value = await api.get<RoomSummary[]>('/api/rooms') } catch (e) { error.value = e instanceof Error ? e.message : 'Could not open your rooms.' } finally { loading.value = false } }
async function create() { if (busy.value || !name.value.trim()) return; busy.value = true; error.value = ''; try { const result = await api.post<{id:string}>('/api/rooms', {name:name.value.trim()}); await router.push(`/rooms/${result.id}`) } catch (e) { error.value = e instanceof Error ? e.message : 'Could not create the room.' } finally { busy.value = false } }
onMounted(load)
</script>
<template>
  <div class="hero-sheet rooms-page"><header class="sheet-section-title"><p class="sheet-eyebrow">YOUR PRIVATE TABLES</p><h1>Game rooms</h1><p>Create a room, share its joining link, and assign your existing characters to your players.</p></header>
    <p v-if="error" class="sheet-alert" role="alert">{{error}}</p>
    <section class="sheet-panel rooms-create"><h2>Create a room</h2><form class="sheet-inline" @submit.prevent="create"><label>Room name<input v-model="name" maxlength="100" required placeholder="The Revalon table" /></label><button class="sheet-button sheet-button-primary" :disabled="busy || !name.trim()">{{busy?'Creating…':'Create room'}}</button></form></section>
    <p v-if="loading" role="status">Opening your rooms…</p><p v-else-if="!rooms.length" class="sheet-empty">No rooms yet. Create one above, or join using your DM’s link.</p>
    <div class="rooms-list"><RouterLink v-for="room in rooms" :key="room.id" :to="`/rooms/${room.id}`" class="sheet-panel rooms-list-item"><div><h2>{{room.name}}</h2><p class="sheet-small">{{room.role==='dm'?'Dungeon Master':'Player'}} · {{room.memberCount}} {{room.memberCount===1?'player':'players'}}</p></div><span>Open room →</span></RouterLink></div>
  </div>
</template>

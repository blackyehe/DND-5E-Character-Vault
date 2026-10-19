<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import '../components/sheet/sheet.css'
const route = useRoute(), router = useRouter(), error = ref(''), busy = ref(false)
const token = computed(() => route.hash.slice(1))
async function join() { busy.value = true; error.value = ''; try { const room = await api.post<{id:string}>('/api/rooms/join', {token:token.value}); await router.replace(`/rooms/${room.id}`) } catch (e) { error.value = e instanceof Error ? e.message : 'Could not join this room.' } finally { busy.value = false } }
</script>
<template><div class="hero-sheet" style="max-width:620px"><section class="sheet-panel"><p class="sheet-eyebrow">PRIVATE GAME ROOM</p><h1>Join your DM’s table</h1><p class="sheet-prose">Join with your website account. Once your DM assigns a character, you can open the full sheet and track your play resources.</p><p v-if="error" class="sheet-alert" role="alert">{{error}}</p><button class="sheet-button sheet-button-primary" :disabled="busy || !/^[A-Za-z0-9_-]{43}$/.test(token)" @click="join">{{busy?'Joining…':'Join room'}}</button><p v-if="!/^[A-Za-z0-9_-]{43}$/.test(token)" class="sheet-small">This link is incomplete. Ask your DM for the full joining link.</p></section></div></template>

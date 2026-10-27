import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { installNavigationRecovery } from '../lib/navigation-recovery'

import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
const CharacterSheetView=()=>import('../views/CharacterSheetView.vue')
const CompendiumView=()=>import('../views/CompendiumView.vue')
const CharacterCreationView=()=>import('../views/CharacterCreationView.vue')
const HomebrewWorkshopView=()=>import('../views/HomebrewWorkshopView.vue')
const RoomsView=()=>import('../views/RoomsView.vue')
const RoomView=()=>import('../views/RoomView.vue')
const RoomJoinView=()=>import('../views/RoomJoinView.vue')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/characters/new', name: 'character-new', component: CharacterCreationView },
    { path: '/characters/:id', name: 'character', component: CharacterSheetView, props: true },
    {path:'/builder-preview',name:'builder-preview',component:()=>import('../views/CompendiumBuildersPreview.vue')},
    { path: '/compendium', name: 'compendium', component: CompendiumView },
    { path: '/homebrew', name: 'homebrew-workshop', component: HomebrewWorkshopView },
    { path: '/rooms', name: 'rooms', component: RoomsView },
    { path: '/rooms/:roomId', name: 'room', component: RoomView },
    { path:'/rooms/:roomId/characters/:sourceCharacterId/champions/:id',name:'room-champion',component:CharacterSheetView,props:route=>({characterId:String(route.params.id),roomId:String(route.params.roomId),championFor:String(route.params.sourceCharacterId),role:'player',playerPreview:true}) },
    { path: '/join', name: 'room-join', component: RoomJoinView },
  ],
})

installNavigationRecovery(router)

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) {
    await auth.fetchMe()
  }
  if (to.name !== 'login' && to.name!=='builder-preview' && !auth.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.name === 'login' && auth.user) {
    return { name: 'dashboard' }
  }
})

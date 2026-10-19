import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './components/creation/builder.css'
import './components/creation/builder-theme.css'
import './site-theme.css'
import './compact-layout.css'
import App from './App.vue'
import { router } from './router'

createApp(App).use(createPinia()).use(router).mount('#app')

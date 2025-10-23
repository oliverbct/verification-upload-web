import { createApp } from 'vue' 
import App from './App.vue' 
import vue3GoogleLogin from 'vue3-google-login'
import router from './router'

const app = createApp(App)

app.use(vue3GoogleLogin, {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID
})

app.use(router)

app.mount('#app')

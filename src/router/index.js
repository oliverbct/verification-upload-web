import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Verification from '../views/Verification.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/verification',
    name: 'Verification',
    component: Verification
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Simple global guard: if backend explicitly marked access as denied, prevent navigation
router.beforeEach((to, from, next) => {
  try {
    const accessAllowed = localStorage.getItem('access_allowed')
    if (accessAllowed === 'false') {
      // redirect back to root where App.vue will show the access denied modal
      return next({ path: '/' })
    }
  } catch (e) {
    // ignore storage errors and allow navigation; App.vue will do server-side checks on mount
  }
  next()
})

export default router

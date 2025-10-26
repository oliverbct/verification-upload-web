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

// Note: We rely on App.vue's checkAccess() to enforce authorization.
// The router guard has been removed to avoid race conditions with async access checks.
// App.vue will block rendering via isAuthorized state and show the access-denied modal.

export default router

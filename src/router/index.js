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

export default router

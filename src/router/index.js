import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Verification from '../views/Verification.vue'
import BulkUpload from '../views/BulkUpload.vue'
import BatchDetails from '../views/BatchDetails.vue'

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
  },
  {
    path: '/bulk-upload',
    name: 'BulkUpload',
    component: BulkUpload
  },
  {
    path: '/bulk-upload/:batchId',
    name: 'BatchDetails',
    component: BatchDetails
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

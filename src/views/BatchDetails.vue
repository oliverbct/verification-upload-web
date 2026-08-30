<template>
  <div class="batch-details-page">
    <div class="details-container">
      <div class="page-heading">
        <div>
          <button class="back-button" @click="goBack">Back to batches</button>
          <p class="eyebrow">Batch details</p>
          <h1>Batch #{{ batchId }}</h1>
          <p v-if="batch" class="file-name">{{ batch.fileName || 'Unnamed CSV' }}</p>
        </div>
        <button class="refresh-button" :disabled="loading" @click="loadDetails">
          {{ loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <div v-if="notFound" class="state-panel">
        <h2>Batch not found</h2>
        <p>No batch exists with ID {{ batchId }}.</p>
        <button class="primary-button" @click="goBack">Back to batches</button>
      </div>
      <div v-else-if="errorMessage" class="state-panel error-panel">
        <h2>Unable to load batch</h2>
        <p>{{ errorMessage }}</p>
        <button class="primary-button" @click="loadDetails">Try again</button>
      </div>
      <div v-else-if="loading && !jobs.length" class="state-panel">Loading jobs...</div>
      <template v-else>
        <section class="summary-panel">
          <div class="summary-status">
            <span class="status-pill" :class="batchStatusClass">{{ batchStatusLabel }}</span>
            <span v-if="batch" class="raw-status">{{ batch.status }}</span>
          </div>
          <div class="summary-metrics">
            <div><strong>{{ jobs.length }}</strong><span>Jobs</span></div>
            <div><strong>{{ completedCount }}</strong><span>Completed</span></div>
            <div><strong>{{ successfulCount }}</strong><span>Successful</span></div>
            <div><strong>{{ failedCount }}</strong><span>Failed</span></div>
          </div>
          <p v-if="batch?.createdAt" class="created-date">Created {{ formatDate(batch.createdAt) }}</p>
          <p v-if="batch?.zipError" class="zip-error">ZIP error: {{ batch.zipError }}</p>
          <div v-if="batch?.status === 'COMPLETED'" class="summary-actions">
            <button class="primary-button" :disabled="downloading" @click="downloadBatch">
              {{ downloading ? 'Preparing...' : 'Download ZIP' }}
            </button>
            <span v-if="downloadMessage" class="download-message">{{ downloadMessage }}</span>
          </div>
        </section>

        <section class="jobs-panel" aria-labelledby="jobs-heading">
          <div class="section-heading">
            <div><p class="eyebrow">Domain processing</p><h2 id="jobs-heading">Jobs</h2></div>
            <span class="job-count">{{ filteredJobs.length }} shown</span>
          </div>

          <div class="job-filters" role="tablist" aria-label="Filter jobs by status">
            <button v-for="filter in jobFilters" :key="filter.value" class="job-filter"
              :class="{ active: jobFilter === filter.value }" role="tab"
              :aria-selected="jobFilter === filter.value" @click="jobFilter = filter.value">
              {{ filter.label }}
            </button>
          </div>
          <div class="search-row">
            <label for="job-search">Search domain</label>
            <input id="job-search" v-model="jobSearch" type="search" placeholder="Contains..." />
          </div>

          <div v-if="!filteredJobs.length" class="state-panel compact">No jobs match this filter.</div>
          <div v-else class="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Domain</th><th>Status</th><th>Started</th><th>Error</th></tr></thead>
              <tbody>
                <tr v-for="job in filteredJobs" :key="job.jobId">
                  <td class="job-id">#{{ job.jobId }}</td>
                  <td class="domain-name">{{ job.domain || '-' }}</td>
                  <td><span class="status-pill" :class="jobStatusClass(job)">{{ jobStatusLabel(job) }}</span></td>
                  <td>{{ formatDate(job.startedAt) }}</td>
                  <td class="error-cell">
                    <template v-if="job.error">
                      <span>{{ jobErrorSummary(job.error) }}</span>
                      <a href="#" class="more-details-link" @click.prevent="openJobError(job)">Show details</a>
                    </template>
                    <template v-else>-</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>

    <div v-if="selectedJobError" class="modal-overlay" @click="selectedJobError = null">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Job #{{ selectedJobError.jobId }} error details</h3>
          <button class="modal-close" @click="selectedJobError = null">&times;</button>
        </div>
        <div class="modal-body">
          <p v-if="selectedJobError.domain"><strong>Domain:</strong> {{ selectedJobError.domain }}</p>
          <pre>{{ selectedJobError.error }}</pre>
        </div>
        <div class="modal-footer">
          <button class="close-btn" @click="selectedJobError = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ensureValidToken } from '../utils/auth.js'

const POLL_INTERVAL = 5000
const ACTIVE_BATCH_STATUSES = new Set(['QUEUED', 'PROCESSING', 'ZIPPENDING', 'ZIPBUILDING'])

export default {
  name: 'BatchDetails',
  data() {
    return {
      batch: null,
      jobs: [],
      jobFilter: 'all',
      jobSearch: '',
      loading: false,
      errorMessage: '',
      notFound: false,
      downloading: false,
      downloadMessage: '',
      selectedJobError: null,
      pollingTimer: null
    }
  },
  computed: {
    batchId() { return this.$route.params.batchId },
    jobFilters() {
      return [
        { value: 'all', label: 'All' },
        { value: 'QUEUED', label: 'Queued' },
        { value: 'PROCESSING', label: 'Processing' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'FAILED', label: 'Failed' }
      ]
    },
    filteredJobs() {
      const search = this.normalizeSearch(this.jobSearch)
      return this.jobs.filter(job => {
        const matchesStatus = this.jobFilter === 'all' || this.jobStatus(job) === this.jobFilter
        const matchesSearch = !search || this.normalizeSearch(job.domain).includes(search)
        return matchesStatus && matchesSearch
      })
    },
    completedCount() { return this.jobs.filter(job => job.success !== null).length },
    successfulCount() { return this.jobs.filter(job => job.success === true).length },
    failedCount() { return this.jobs.filter(job => job.success === false).length },
    batchStatusLabel() { return this.displayBatchStatus(this.batch?.status) },
    batchStatusClass() { return this.batchStatusClassFor(this.batch?.status) }
  },
  mounted() {
    this.loadDetails()
  },
  beforeUnmount() {
    this.stopPolling()
  },
  methods: {
    async loadDetails() {
      if (this.loading) return
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        this.errorMessage = 'Authentication required. Please sign in again.'
        this.stopPolling()
        return
      }

      this.loading = true
      this.errorMessage = ''
      this.notFound = false
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL
        const [batch, jobsResponse] = await Promise.all([
          this.findBatch(apiBase, accessToken),
          fetch(`${apiBase}/api/domain-verification/pdf/upload/batches/${encodeURIComponent(this.batchId)}/jobs`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
        ])

        if (jobsResponse.status === 404 || !batch) {
          this.notFound = true
          this.jobs = []
          this.batch = null
          this.stopPolling()
          return
        }
        if (jobsResponse.status === 401) {
          window.dispatchEvent(new CustomEvent('session-expired'))
          throw new Error('Session expired. Please sign in again.')
        }
        if (!jobsResponse.ok) throw new Error(await jobsResponse.text().catch(() => `HTTP ${jobsResponse.status}`))

        const jobs = await jobsResponse.json()
        this.batch = batch
        this.jobs = Array.isArray(jobs) ? jobs : []
        if (ACTIVE_BATCH_STATUSES.has(batch.status)) this.startPolling()
        else this.stopPolling()
      } catch (error) {
        this.errorMessage = error.message || 'Unable to load batch details.'
        this.stopPolling()
      } finally {
        this.loading = false
      }
    },

    async findBatch(apiBase, accessToken) {
      let page = 0
      let totalPages = 1
      while (page < totalPages) {
        const response = await fetch(`${apiBase}/api/domain-verification/pdf/upload/batches?page=${page}&size=100`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent('session-expired'))
          throw new Error('Session expired. Please sign in again.')
        }
        if (!response.ok) throw new Error(await response.text().catch(() => `HTTP ${response.status}`))
        const result = await response.json()
        const batch = (Array.isArray(result?.content) ? result.content : []).find(item => String(item.batchId) === String(this.batchId))
        if (batch) return batch
        totalPages = Number(result?.totalPages) || 1
        page += 1
      }
      return null
    },

    startPolling() {
      if (!this.pollingTimer) this.pollingTimer = window.setInterval(() => this.loadDetails(), POLL_INTERVAL)
    },

    stopPolling() {
      if (this.pollingTimer) window.clearInterval(this.pollingTimer)
      this.pollingTimer = null
    },

    goBack() {
      this.$router.push('/bulk-upload')
    },

    async downloadBatch() {
      if (this.batch?.status !== 'COMPLETED' || this.downloading) return
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        this.downloadMessage = 'Authentication required. Please sign in again.'
        return
      }

      this.downloading = true
      this.downloadMessage = ''
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL
        const response = await fetch(`${apiBase}/api/domain-verification/pdf/upload/batches/${encodeURIComponent(this.batchId)}/download-url`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent('session-expired'))
          throw new Error('Session expired. Please sign in again.')
        }
        if (response.status === 404) throw new Error('This batch no longer exists.')
        if (response.status === 409) throw new Error('ZIP is not ready yet. Please try again shortly.')
        if (!response.ok) throw new Error(await response.text().catch(() => `HTTP ${response.status}`))
        const result = await response.json()
        window.location.assign(result.downloadUrl)
      } catch (error) {
        this.downloadMessage = error.message || 'Unable to download batch.'
      } finally {
        this.downloading = false
      }
    },

    jobStatus(job) {
      if (job.success === true) return 'COMPLETED'
      if (job.success === false) return 'FAILED'
      return job.startedAt ? 'PROCESSING' : 'QUEUED'
    },

    jobStatusLabel(job) {
      return { QUEUED: 'Queued', PROCESSING: 'Processing', COMPLETED: 'Completed', FAILED: 'Failed' }[this.jobStatus(job)]
    },

    jobStatusClass(job) {
      return this.jobStatus(job).toLowerCase()
    },

    normalizeSearch(value) {
      return String(value || '').trim().toLowerCase()
    },

    jobErrorSummary(error) {
      if (!error) return ''
      const stackStart = error.indexOf(' at ')
      const summary = stackStart > -1 ? error.slice(0, stackStart) : error
      return summary.replace(/^[\w$.]+(?:Exception|Error):\s*/, '').trim()
    },

    openJobError(job) {
      this.selectedJobError = { jobId: job.jobId, domain: job.domain, error: job.error }
    },

    displayBatchStatus(status) {
      if (status === 'QUEUED') return 'Queued'
      if (['PROCESSING', 'ZIPPENDING', 'ZIPBUILDING'].includes(status)) return 'In Progress'
      if (status === 'COMPLETED') return 'Completed'
      if (status === 'CANCELED') return 'Cancelled'
      if (status === 'FAILED') return 'Failed'
      return status || 'Unknown'
    },

    batchStatusClassFor(status) {
      if (status === 'QUEUED') return 'queued'
      if (['PROCESSING', 'ZIPPENDING', 'ZIPBUILDING'].includes(status)) return 'processing'
      if (status === 'COMPLETED') return 'completed'
      if (status === 'CANCELED') return 'canceled'
      if (status === 'FAILED') return 'failed'
      return 'unknown'
    },

    formatDate(value) {
      if (!value) return '-'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
    }
  }
}
</script>

<style scoped>
.batch-details-page { min-height: 100%; padding: 32px 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); }
.details-container { max-width: 1280px; margin: 0 auto; }
.page-heading, .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-heading { margin-bottom: 24px; }
.eyebrow { margin: 0 0 6px; color: #dc3545; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
h1, h2 { margin: 0; color: #212529; }
h1 { font-size: 2rem; }
h2 { font-size: 1.25rem; }
.back-button { display: block; margin-bottom: 22px; padding: 0; border: 0; background: transparent; color: #b02a37; font-weight: 700; cursor: pointer; }
.file-name { margin: 8px 0 0; color: #495057; font-weight: 600; }
.refresh-button, .primary-button { border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
.refresh-button { background: #e9ecef; color: #212529; }
.primary-button { background: #2c2c2c; color: #fff; }
.summary-panel, .jobs-panel { padding: 22px; margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 12px; background: #fff; }
.summary-status { display: flex; align-items: center; gap: 10px; }
.raw-status { color: #6c757d; font-size: .78rem; }
.summary-metrics { display: flex; flex-wrap: wrap; gap: 32px; margin-top: 22px; }
.summary-metrics div { display: flex; flex-direction: column; gap: 4px; }
.summary-metrics strong { color: #212529; font-size: 1.45rem; }
.summary-metrics span, .created-date, .job-count { color: #6c757d; font-size: .9rem; }
.created-date { margin: 20px 0 0; }
.zip-error { margin: 12px 0 0; color: #b02a37; }
.summary-actions { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
.download-message { color: #6c757d; font-size: .9rem; }
.job-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
.job-filter { padding: 8px 14px; border: 1px solid #ced4da; border-radius: 999px; background: #fff; color: #495057; font-weight: 700; cursor: pointer; }
.job-filter.active { border-color: #dc3545; background: #dc3545; color: #fff; }
.state-panel { padding: 42px 20px; border: 1px solid #dee2e6; border-radius: 12px; background: #fff; text-align: center; color: #6c757d; }
.state-panel h2 { margin-bottom: 8px; }
.state-panel p { margin-bottom: 18px; }
.error-panel { color: #b02a37; }
.state-panel.compact { border: 0; padding: 28px 8px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; min-width: 760px; border-collapse: collapse; }
th, td { padding: 13px 12px; border-bottom: 1px solid #e9ecef; text-align: left; vertical-align: middle; }
th { background: #f8f9fa; color: #495057; font-size: .78rem; letter-spacing: .04em; text-transform: uppercase; }
.job-id, .domain-name { font-weight: 700; }
.status-pill { display: inline-block; padding: 5px 9px; border-radius: 999px; font-size: .78rem; font-weight: 700; white-space: nowrap; }
.status-pill.queued { background: #fff3cd; color: #997404; }
.status-pill.processing { background: #cfe2ff; color: #0a58ca; }
.status-pill.completed { background: #d1e7dd; color: #146c43; }
.status-pill.failed { background: #f8d7da; color: #b02a37; }
.status-pill.canceled, .status-pill.unknown { background: #e2e3e5; color: #41464b; }
.error-cell { max-width: 420px; color: #b02a37; overflow-wrap: anywhere; }
.more-details-link { margin-left: 8px; color: #0a58ca; font-weight: 700; text-decoration: underline; white-space: nowrap; }
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 640px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
}
.modal-header h3 { margin: 0; color: #495057; font-size: 1.2rem; }
.modal-close {
  background: none; border: none; font-size: 24px; cursor: pointer; color: #6c757d;
  padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
}
.modal-close:hover { background: #e9ecef; color: #495057; }
.modal-body { padding: 24px; overflow-y: auto; flex: 1; }
.modal-body pre {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  color: #212529;
  max-height: 320px;
  overflow-y: auto;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #dee2e6;
  background: #f8f9fa;
}
.close-btn {
  background: #e9ecef;
  color: #212529;
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font-weight: 700;
  cursor: pointer;
}
@media (max-width: 700px) {
  .batch-details-page { padding: 20px 10px; }
  .page-heading { flex-direction: column; }
  .refresh-button { width: 100%; }
  .summary-metrics { gap: 20px; }
}
</style>

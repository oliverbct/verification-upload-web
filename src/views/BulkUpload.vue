<template>
  <div class="bulk-upload-page">
    <div class="container">
      <div class="page-heading">
        <div>
          <p class="eyebrow">Verification operations</p>
          <h1>Bulk upload</h1>
          <p class="intro">Schedule a CSV for background processing and track its progress here.</p>
        </div>
        <button class="refresh-btn" :disabled="batchesLoading" @click="loadBatches">
          {{ batchesLoading ? 'Refreshing...' : 'Refresh batches' }}
        </button>
      </div>

      <section class="upload-card" aria-labelledby="schedule-heading">
        <div class="section-heading">
          <div><p class="eyebrow">New job</p><h2 id="schedule-heading">Schedule a CSV</h2></div>
          <span class="schedule-note">Processing continues in the background</span>
        </div>
        <div class="file-controls">
          <div class="file-input-group">
            <label class="upload-label" for="csv-file">Choose CSV file</label>
            <input id="csv-file" type="file" accept=".csv,text/csv" @change="handleFileChange" />
          </div>
          <div class="start-domain-group">
            <label class="upload-label" for="start-domain">Start domain (optional)</label>
            <input id="start-domain" v-model="startDomain" placeholder="e.g. example.com.vn" />
          </div>
        </div>
        <div v-if="selectedFile" class="file-summary">Selected file: <strong>{{ selectedFile.name }}</strong></div>
        <div class="schedule-actions">
          <button class="submit-btn" :disabled="!selectedFile || scheduling" @click="submitUpload">
            {{ scheduling ? 'Scheduling...' : 'Schedule batch' }}
          </button>
          <span v-if="scheduleMessage" class="success-message">{{ scheduleMessage }}</span>
          <span v-if="scheduleError" class="error-message">
            {{ scheduleError }}
            <a v-if="scheduleErrorDetails" href="#" class="more-details-link" @click.prevent="showErrorDetailsModal = true">More Details</a>
          </span>
        </div>
      </section>

      <section class="batches-panel" aria-labelledby="batches-heading">
        <div class="section-heading batches-heading">
          <div><p class="eyebrow">Batch history</p><h2 id="batches-heading">All batches</h2></div>
          <span v-if="filteredBatches.length" class="batch-count">{{ filteredBatches.length }} matching batches</span>
        </div>
        <div class="status-filters" role="tablist" aria-label="Filter batches by status">
          <button v-for="filter in statusFilters" :key="filter.value" class="status-filter"
            :class="{ active: batchFilter === filter.value }" role="tab"
            :aria-selected="batchFilter === filter.value" @click="batchFilter = filter.value">
            {{ filter.label }}
          </button>
        </div>
        <div class="search-row">
          <label for="batch-search">Search filename</label>
          <input id="batch-search" v-model="batchSearch" type="search" placeholder="Contains..." />
        </div>
        <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>
        <div v-if="batchesError" class="state-message error-state">
          <span>{{ batchesError }}</span><button class="inline-action" @click="loadBatches">Try again</button>
        </div>
        <div v-else-if="batchesLoading && !batches.length" class="state-message">Loading batches...</div>
        <div v-else-if="!filteredBatches.length" class="state-message">No batches match this filter.</div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>File</th><th>Status</th><th>Created</th><th>Jobs</th><th>Successful</th><th>Failed</th><th>Actions</th></tr></thead>
            <tbody>
              <tr v-for="batch in paginatedBatches" :key="batch.batchId" class="batch-row" tabindex="0" @click="openBatch(batch.batchId)" @keydown.enter="openBatch(batch.batchId)">
                <td class="file-name">{{ batch.fileName || 'Unnamed CSV' }}</td>
                <td><span class="status-pill" :class="statusClass(batch.status)">{{ displayStatus(batch.status) }}</span><span class="raw-status">{{ batch.status }}</span></td>
                <td>{{ formatDate(batch.createdAt) }}</td>
                <td>{{ batch.completedJobCount ?? 0 }} / {{ batch.jobCount ?? 0 }}</td>
                <td class="success-number">{{ batch.successfulJobCount ?? 0 }}</td>
                <td class="failure-number">{{ batch.failedJobCount ?? 0 }}</td>
                <td class="actions-cell" @click.stop>
                  <button v-if="canCancel(batch)" class="action-button cancel-button" :disabled="cancellingBatchId === batch.batchId" @click="cancelBatch(batch)">
                    {{ cancellingBatchId === batch.batchId ? 'Cancelling...' : 'Cancel' }}
                  </button>
                  <button v-else-if="batch.status === 'COMPLETED'" class="action-button download-button" title="Download is not available yet" @click.stop="downloadBatch">Download</button>
                  <button v-else-if="batch.status === 'FAILED'" class="action-button error-button" :title="batch.zipError || 'Batch failed'" @click.stop>View error</button>
                  <span v-else>-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="filteredBatches.length" class="pagination-bar">
          <label for="page-size">Rows per page</label>
          <select id="page-size" v-model.number="batchPageSize"><option :value="10">10</option><option :value="25">25</option><option :value="50">50</option></select>
          <span>Page {{ batchPage }} of {{ totalBatchPages }}</span>
          <button class="page-btn" :disabled="batchPage === 1" @click="batchPage--">Previous</button>
          <button class="page-btn" :disabled="batchPage === totalBatchPages" @click="batchPage++">Next</button>
        </div>
      </section>
    </div>

    <div v-if="showErrorDetailsModal" class="modal-overlay" @click="showErrorDetailsModal = false">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Batch scheduling error details</h3>
          <button class="modal-close" @click="showErrorDetailsModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <p v-if="scheduleErrorDetails.status"><strong>Status:</strong> {{ scheduleErrorDetails.status }} {{ scheduleErrorDetails.statusText }}</p>
          <div class="error-detail-block">
            <h4>Response / exception</h4>
            <pre>{{ scheduleErrorDetails.response }}</pre>
          </div>
          <div class="error-detail-block">
            <h4>Request payload</h4>
            <pre>{{ scheduleErrorDetails.payload }}</pre>
          </div>
        </div>
        <div class="modal-footer">
          <button class="close-btn" @click="showErrorDetailsModal = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ensureValidToken } from '../utils/auth.js'

const SERVER_PAGE_SIZE = 100
const POLL_INTERVAL = 5000
const ACTIVE_STATUSES = new Set(['QUEUED', 'PROCESSING', 'ZIPPENDING', 'ZIPBUILDING'])

export default {
  name: 'BulkUpload',
  data() {
    return {
      selectedFile: null,
      startDomain: '',
      scheduling: false,
      scheduleMessage: '',
      scheduleError: '',
      scheduleErrorDetails: null,
      showErrorDetailsModal: false,
      batches: [],
      batchFilter: 'all',
      batchSearch: '',
      batchPage: 1,
      batchPageSize: 25,
      batchesLoading: false,
      batchesError: '',
      cancellingBatchId: null,
      actionMessage: '',
      pollingTimer: null
    }
  },
  computed: {
    statusFilters() {
      return [
        { value: 'all', label: 'All' },
        { value: 'QUEUED', label: 'Queued' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'CANCELED', label: 'Cancelled' },
        { value: 'FAILED', label: 'Failed' }
      ]
    },
    filteredBatches() {
      const search = this.normalizeSearch(this.batchSearch)
      return this.batches.filter(batch => {
        const matchesStatus = this.batchFilter === 'all' || this.matchesFilter(batch.status)
        const matchesSearch = !search || this.normalizeSearch(batch.fileName).includes(search)
        return matchesStatus && matchesSearch
      })
    },
    totalBatchPages() {
      return Math.max(1, Math.ceil(this.filteredBatches.length / this.batchPageSize))
    },
    paginatedBatches() {
      const start = (this.batchPage - 1) * this.batchPageSize
      return this.filteredBatches.slice(start, start + this.batchPageSize)
    }
  },
  watch: {
    batchFilter() { this.batchPage = 1 },
    batchPageSize() { this.batchPage = 1 },
    batchSearch() { this.batchPage = 1 },
    totalBatchPages(totalPages) {
      if (this.batchPage > totalPages) this.batchPage = totalPages
    }
  },
  mounted() {
    this.loadBatches()
  },
  beforeUnmount() {
    this.stopPolling()
  },
  methods: {

    openBatch(batchId) {
      this.$router.push({ name: 'BatchDetails', params: { batchId } })
    },

    canCancel(batch) {
      return ['QUEUED', 'PROCESSING', 'ZIPPENDING'].includes(batch.status)
    },

    downloadBatch() {},

    async cancelBatch(batch) {
      if (!this.canCancel(batch) || this.cancellingBatchId !== null) return
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        this.actionMessage = 'Authentication required. Please sign in again.'
        return
      }

      this.cancellingBatchId = batch.batchId
      this.actionMessage = ''
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL
        const response = await fetch(`${apiBase}/api/domain-verification/pdf/upload/batches/${encodeURIComponent(batch.batchId)}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent('session-expired'))
          throw new Error('Session expired. Please sign in again.')
        }
        if (response.status === 403) throw new Error('You are not authorized to cancel this batch.')
        if (response.status === 404) throw new Error('This batch no longer exists.')
        if (response.status === 409) throw new Error('This batch can no longer be cancelled.')
        if (!response.ok) throw new Error(await response.text().catch(() => `HTTP ${response.status}`))
        const result = await response.json().catch(() => ({}))
        this.actionMessage = result.message || `Batch #${batch.batchId} cancelled.`
        await this.loadBatches()
      } catch (error) {
        this.actionMessage = error.message || 'Unable to cancel batch.'
        if (error.message === 'This batch can no longer be cancelled.') await this.loadBatches()
      } finally {
        this.cancellingBatchId = null
      }
    },

    async loadBatches() {
      if (this.batchesLoading) return
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        this.batchesError = 'Authentication required. Please sign in again.'
        this.stopPolling()
        return
      }

      this.batchesLoading = true
      this.batchesError = ''
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL
        const allBatches = []
        let page = 0
        let totalPages = 1
        while (page < totalPages) {
          const response = await fetch(`${apiBase}/api/domain-verification/pdf/upload/batches?page=${page}&size=${SERVER_PAGE_SIZE}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          if (response.status === 401) {
            window.dispatchEvent(new CustomEvent('session-expired'))
            throw new Error('Session expired. Please sign in again.')
          }
          if (!response.ok) throw new Error(await response.text().catch(() => `HTTP ${response.status}`))
          const result = await response.json()
          allBatches.push(...(Array.isArray(result?.content) ? result.content : []))
          totalPages = Number(result?.totalPages) || 1
          page += 1
        }
        this.batches = allBatches
        if (this.batches.some(batch => ACTIVE_STATUSES.has(batch.status))) this.startPolling()
        else this.stopPolling()
      } catch (error) {
        this.batchesError = error.message || 'Unable to load batches.'
        this.stopPolling()
      } finally {
        this.batchesLoading = false
      }
    },

    startPolling() {
      if (!this.pollingTimer) this.pollingTimer = window.setInterval(() => this.loadBatches(), POLL_INTERVAL)
    },

    stopPolling() {
      if (this.pollingTimer) window.clearInterval(this.pollingTimer)
      this.pollingTimer = null
    },

    handleFileChange(event) {
      const file = event.target.files?.[0] || null
      this.selectedFile = file
    },

    async submitUpload() {
      if (!this.selectedFile || this.scheduling) return
      this.scheduleMessage = ''
      this.scheduleError = ''
      this.scheduleErrorDetails = null
      this.showErrorDetailsModal = false
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        this.scheduleError = 'Authentication required. Please sign in again.'
        return
      }

      this.scheduling = true
      try {
        const requests = this.parseCsv(await this.selectedFile.text())
        if (!requests.length) throw new Error('No valid rows found in the CSV file.')

        const trimmedStartDomain = (this.startDomain || '').trim()
        let filteredRequests = requests
        if (trimmedStartDomain) {
          const normalizedStart = this.normalizeDomainValue(trimmedStartDomain)
          const startIndex = requests.findIndex(request => this.normalizeDomainValue(`${request.domainName}${request.extension}`) === normalizedStart)
          if (startIndex === -1) throw new Error(`Start domain not found in CSV: ${trimmedStartDomain}`)
          filteredRequests = requests.slice(startIndex)
        }
        if (!filteredRequests.length) throw new Error('No requests remaining after the selected start domain.')

        const apiBase = import.meta.env.VITE_API_BASE_URL
        const requestBody = JSON.stringify({ requests: filteredRequests })
        const response = await fetch(`${apiBase}/api/domain-verification/pdf/upload/bulk`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: requestBody
        })
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent('session-expired'))
          throw new Error('Session expired. Please sign in again.')
        }
        if (!response.ok) {
          const responseText = await response.text().catch(() => `HTTP ${response.status}`)
          this.scheduleErrorDetails = {
            status: response.status,
            statusText: response.statusText,
            response: responseText || `HTTP ${response.status}`,
            payload: requestBody
          }
          throw new Error(responseText || `HTTP ${response.status}`)
        }

        const result = await response.json().catch(() => ({}))
        const batch = result?.batch || result?.data || result
        this.scheduleMessage = batch?.batchId
          ? `Batch #${batch.batchId} scheduled successfully.`
          : 'Batch scheduled successfully.'
        await this.loadBatches()
        this.selectedFile = null
      } catch (error) {
        this.scheduleError = this.scheduleErrorDetails ? 'Batch creation failed.' : (error.message || 'Unable to schedule batch.')
      } finally {
        this.scheduling = false
      }
    },

    normalizeDomainValue(value) {
      return (value || '')
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/$/, '')
        .replace(/^www\./i, '')
    },

    normalizeSearch(value) {
      return String(value || '').trim().toLowerCase()
    },

    parseCsv(text) {
      const rows = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      if (!rows.length) return []

      const requests = []

      rows.forEach((row) => {
        const columns = row.split(',').map(column => column.trim())
        const rawValue = columns[0] || ''
        if (!rawValue) return

        const cleanedValue = rawValue.replace(/^https?:\/\//i, '').replace(/\/$/, '')
        const trimmedValue = cleanedValue.trim()

        const firstDotIndex = trimmedValue.indexOf('.')
        let domainName = trimmedValue
        let extension = '.com'

        if (firstDotIndex > 0 && firstDotIndex < trimmedValue.length - 1) {
          extension = trimmedValue.slice(firstDotIndex)
          domainName = trimmedValue.slice(0, firstDotIndex)
        }

        requests.push({
          domainName: domainName.replace(/^\./, '').replace(/^www\./i, ''),
          extension: extension.startsWith('.') ? extension : `.${extension}`
        })
      })

      return requests
    },
    matchesFilter(status) {
      if (this.batchFilter === 'IN_PROGRESS') return ['PROCESSING', 'ZIPPENDING', 'ZIPBUILDING'].includes(status)
      return status === this.batchFilter
    },

    displayStatus(status) {
      if (status === 'QUEUED') return 'Queued'
      if (['PROCESSING', 'ZIPPENDING', 'ZIPBUILDING'].includes(status)) return 'In Progress'
      if (status === 'COMPLETED') return 'Completed'
      if (status === 'CANCELED') return 'Cancelled'
      if (status === 'FAILED') return 'Failed'
      return status || 'Unknown'
    },

    statusClass(status) {
      if (status === 'QUEUED') return 'queued'
      if (['PROCESSING', 'ZIPPENDING', 'ZIPBUILDING'].includes(status)) return 'progress'
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
.bulk-upload-page {
  min-height: 100%;
  padding: 32px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

h1 {
  margin-top: 0;
  margin-bottom: 8px;
}

.intro {
  color: #495057;
  margin-bottom: 24px;
}

.upload-card,
.log-panel {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  background: #f8f9fa;
}

.upload-label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}

input[type="file"] {
  margin-bottom: 16px;
}

.file-controls {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: end;
}

.file-input-group,
.start-domain-group {
  display: flex;
  flex-direction: column;
  min-width: 240px;
}

.start-domain-group input {
  padding: 10px 12px;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.submit-btn,
.secondary-btn,
.stop-btn {
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 600;
  cursor: pointer;
}

.submit-btn {
  background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
  color: white;
}

.secondary-btn {
  background: #e9ecef;
  color: #212529;
}

.stop-btn {
  background: linear-gradient(135deg, #dc3545 0%, #b02a37 100%);
  color: white;
}

.counters {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.counter {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}

.counter.success {
  background: #d1e7dd;
  color: #146c43;
}

.counter.failure {
  background: #f8d7da;
  color: #b02a37;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.file-summary {
  margin-top: 12px;
  color: #495057;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.log-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.run-state {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.state-processing {
  background: #cfe2ff;
  color: #0a58ca;
}

.state-stopping {
  background: #fff3cd;
  color: #997404;
}

.state-stopped {
  background: #e2e3e5;
  color: #41464b;
}

.state-completed {
  background: #d1e7dd;
  color: #146c43;
}

.log-count {
  color: #6c757d;
  font-size: 0.95rem;
}

.empty-state {
  color: #6c757d;
  padding: 12px 0;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
  padding-right: 4px;
}

.log-row {
  display: grid;
  grid-template-columns: 2fr 100px 2fr;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: white;
  border: 1px solid #e9ecef;
  align-items: center;
}

.log-row-header {
  font-weight: 700;
  background: #f8f9fa;
}

.log-domain-column,
.log-status-column,
.log-message-column {
  min-width: 0;
}

.log-domain-column {
  font-weight: 600;
}

.log-status-column {
  text-transform: capitalize;
  font-weight: 700;
}

.log-status-column.success {
  color: #198754;
}

.log-status-column.error {
  color: #dc3545;
}

.log-status-column.info {
  color: #0d6efd;
}

.log-message-column {
  color: #495057;
  font-size: 0.95rem;
}

@media (max-width: 700px) {
  .log-row {
    grid-template-columns: 1fr;
  }
}

.page-heading, .section-heading, .pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-heading { margin-bottom: 28px; }
.eyebrow { margin: 0 0 6px; color: #dc3545; font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.page-heading h1, .section-heading h2 { margin: 0; color: #212529; }
.page-heading h1 { font-size: 2rem; }
.section-heading h2 { font-size: 1.25rem; }
.schedule-note, .batch-count { color: #6c757d; font-size: .9rem; }
.refresh-btn, .page-btn, .inline-action { border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
.refresh-btn, .page-btn { background: #e9ecef; color: #212529; }
.schedule-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 20px; }
.success-message { color: #146c43; font-weight: 700; }
.error-message, .error-state { color: #b02a37; }
.more-details-link { margin-left: 8px; color: #0a58ca; font-weight: 700; text-decoration: underline; }

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
.error-detail-block { margin-bottom: 20px; }
.error-detail-block h4 { margin: 0 0 8px; color: #495057; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; }
.error-detail-block pre {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  color: #212529;
  max-height: 240px;
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
.status-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
.search-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.search-row label { color: #495057; font-weight: 700; }
.search-row input { width: min(360px, 100%); padding: 10px 12px; border: 1px solid #ced4da; border-radius: 8px; }
.action-message { margin: -4px 0 16px; color: #b02a37; font-weight: 700; }
.status-filter { padding: 8px 14px; border: 1px solid #ced4da; border-radius: 999px; background: #fff; color: #495057; font-weight: 700; cursor: pointer; }
.status-filter.active { border-color: #dc3545; background: #dc3545; color: #fff; }
.state-message { padding: 28px 8px; color: #6c757d; text-align: center; }
.inline-action { margin-left: 8px; background: #f8d7da; color: #842029; }
.table-wrap { overflow-x: auto; }
.table-wrap table { width: 100%; min-width: 980px; border-collapse: collapse; }
.table-wrap th, .table-wrap td { padding: 13px 12px; border-bottom: 1px solid #e9ecef; text-align: left; vertical-align: middle; }
.table-wrap th { background: #f8f9fa; color: #495057; font-size: .78rem; letter-spacing: .04em; text-transform: uppercase; }
.batch-id, .file-name { font-weight: 700; }
.file-name { max-width: 220px; overflow-wrap: anywhere; }
.batch-row { cursor: pointer; }
.batch-row:hover, .batch-row:focus { background: #fff8f8; outline: none; }
.batch-row:focus { box-shadow: inset 3px 0 #dc3545; }
.status-pill { display: inline-block; padding: 5px 9px; border-radius: 999px; font-size: .78rem; font-weight: 700; white-space: nowrap; }
.status-pill.queued { background: #fff3cd; color: #997404; }
.status-pill.progress { background: #cfe2ff; color: #0a58ca; }
.status-pill.completed { background: #d1e7dd; color: #146c43; }
.status-pill.canceled, .status-pill.unknown { background: #e2e3e5; color: #41464b; }
.status-pill.failed { background: #f8d7da; color: #b02a37; }
.raw-status { display: block; margin-top: 4px; color: #6c757d; font-size: .7rem; }
.success-number { color: #146c43; font-weight: 700; }
.failure-number { color: #b02a37; font-weight: 700; }
.actions-cell { white-space: nowrap; }
.action-button { padding: 7px 10px; border: 0; border-radius: 6px; font-weight: 700; cursor: pointer; }
.cancel-button { background: #f8d7da; color: #842029; }
.download-button { background: #d1e7dd; color: #146c43; }
.error-button { background: #f8d7da; color: #b02a37; }
.pagination-bar { justify-content: flex-end; margin-top: 18px; color: #6c757d; font-size: .9rem; }
.pagination-bar label { margin-left: auto; }
@media (max-width: 700px) {
  .bulk-upload-page { padding: 16px 10px; }
  .container { padding: 20px 14px; }
  .page-heading, .pagination-bar { align-items: flex-start; flex-direction: column; }
  .pagination-bar label { margin-left: 0; }
  .refresh-btn { width: 100%; }
  .search-row { align-items: flex-start; flex-direction: column; }
  .search-row input { width: 100%; }
}
</style>

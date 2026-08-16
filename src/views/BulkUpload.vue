<template>
  <div class="bulk-upload-page">
    <div class="container">
      <h1>Bulk PDF Upload</h1>
      <p class="intro">
        Upload a CSV file containing one domain per row. The app will parse the file and send each domain to the bulk upload endpoint.
      </p>

      <div class="upload-card">
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

        <div class="controls">
          <button class="submit-btn" :disabled="!selectedFile || submitting" @click="submitUpload">
            {{ submitting ? 'Submitting...' : 'Submit' }}
          </button>
          <button class="stop-btn" :disabled="!submitting || runState !== 'Processing'" @click="requestStop">
            Stop
          </button>
          <div class="counters">
            <span class="counter success">Success: {{ successCount }}</span>
            <span class="counter failure">Failure: {{ failureCount }}</span>
          </div>
          <button class="secondary-btn" :disabled="!logEntries.length" @click="downloadLogCsv">
            Download Log CSV
          </button>
        </div>

        <div v-if="selectedFile" class="file-summary">
          Selected file: <strong>{{ selectedFile.name }}</strong>
        </div>
      </div>

      <div class="log-panel">
        <div class="log-header">
          <div class="log-header-left">
            <h2>Upload log</h2>
            <span class="run-state" :class="`state-${runState.toLowerCase()}`">{{ runState }}</span>
          </div>
          <span v-if="logEntries.length" class="log-count">{{ logEntries.length }} rows</span>
        </div>

        <div v-if="!logEntries.length" class="empty-state">
          No upload activity yet.
        </div>

        <div v-else ref="logScroll" class="log-list">
          <div class="log-row log-row-header">
            <div class="log-domain-column">Domain</div>
            <div class="log-status-column">Status</div>
            <div class="log-message-column">Message</div>
          </div>
          <div v-for="(entry, index) in logEntries" :key="`${entry.domainName}-${index}`" class="log-row">
            <div class="log-domain-column">{{ entry.fullDomain || `${entry.domainName}${entry.extension}` }}</div>
            <div class="log-status-column" :class="entry.status">{{ entry.status }}</div>
            <div class="log-message-column">{{ entry.message }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ensureValidToken } from '../utils/auth.js'

export default {
  name: 'BulkUpload',
  data() {
    return {
      selectedFile: null,
      startDomain: '',
      submitting: false,
      logEntries: [],
      runState: 'Stopped',
      stopRequested: false,
      successCount: 0,
      failureCount: 0
    }
  },
  watch: {
    logEntries() {
      this.scrollLogToBottom()
    }
  },
  methods: {
    scrollLogToBottom() {
      this.$nextTick(() => {
        const logScroll = this.$refs.logScroll
        if (!logScroll) return
        logScroll.scrollTop = logScroll.scrollHeight
      })
    },

    appendLogEntries(entries) {
      this.logEntries = [...this.logEntries, ...entries]
    },

    appendLogEntry(entry) {
      this.logEntries = [...this.logEntries, entry]
    },

    requestStop() {
      if (!this.submitting || this.runState !== 'Processing') return
      this.stopRequested = true
      this.runState = 'Stopping'
      this.appendLogEntry({
        domainName: 'System',
        extension: '',
        fullDomain: 'System',
        status: 'info',
        message: 'Stop requested. Waiting for current batch to finish.'
      })
    },

    getOutcomeDomainFields(outcome, fallbackRequest = null) {
      const fromRequestObject = outcome?.request && typeof outcome.request === 'object'
        ? outcome.request
        : null

      const domainName =
        outcome?.domainName ||
        outcome?.name ||
        outcome?.domain ||
        fromRequestObject?.domainName ||
        fallbackRequest?.domainName ||
        ''

      const extension =
        outcome?.extension ||
        outcome?.tld ||
        fromRequestObject?.extension ||
        fallbackRequest?.extension ||
        ''

      const fullDomain =
        outcome?.fullDomain ||
        outcome?.domainFullName ||
        outcome?.fqdn ||
        fromRequestObject?.fullDomain ||
        (domainName || extension ? `${domainName}${extension}` : '')

      return {
        domainName,
        extension,
        fullDomain
      }
    },

    handleFileChange(event) {
      const file = event.target.files?.[0] || null
      this.selectedFile = file
    },

    async submitUpload() {
      if (!this.selectedFile) return

      let accessToken = await ensureValidToken()
      if (!accessToken) {
        this.logEntries = [{ domainName: '-', extension: '', status: 'error', message: 'Authentication required. Please sign in again.' }]
        return
      }

      this.submitting = true
      this.logEntries = []
      this.successCount = 0
      this.failureCount = 0
      this.stopRequested = false
      this.runState = 'Processing'

      try {
        const text = await this.selectedFile.text()
        const requests = this.parseCsv(text)

        if (!requests.length) {
          this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: 'No valid rows found in the CSV file.' })
          this.runState = 'Stopped'
          return
        }

        const trimmedStartDomain = (this.startDomain || '').trim()
        let startIndex = 0
        if (trimmedStartDomain) {
          const normalizedStart = this.normalizeDomainValue(trimmedStartDomain)
          const startMatchIndex = requests.findIndex(request => this.normalizeDomainValue(`${request.domainName}${request.extension}`) === normalizedStart)
          if (startMatchIndex === -1) {
            this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: `Start domain not found in CSV: ${trimmedStartDomain}` })
            this.runState = 'Stopped'
            return
          }
          startIndex = startMatchIndex
        }

        const filteredRequests = requests.slice(startIndex)

        if (!filteredRequests.length) {
          this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: 'No requests remaining after the selected start domain.' })
          this.runState = 'Stopped'
          return
        }

        const apiBase = import.meta.env.VITE_API_BASE_URL
        const batchSize = 5
        const allResults = []
        const total = filteredRequests.length

        const postBatch = async (batchToSend, tokenToUse) => {
          return fetch(`${apiBase}/api/domain-verification/pdf/upload/bulk`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenToUse}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests: batchToSend, concurrency: 5 })
          })
        }

        for (let index = 0; index < filteredRequests.length; index += batchSize) {
          if (this.stopRequested) {
            this.runState = 'Stopped'
            this.appendLogEntry({
              domainName: 'System',
              extension: '',
              fullDomain: 'System',
              status: 'info',
              message: `Stopped after ${index}/${total} processed.`
            })
            break
          }

          const batch = filteredRequests.slice(index, index + batchSize)

          accessToken = await ensureValidToken()
          if (!accessToken) {
            this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: 'Session expired. Please sign in again.' })
            this.runState = 'Stopped'
            return
          }

          let response = await postBatch(batch, accessToken)

          if (response.status === 401) {
            this.appendLogEntry({ domainName: 'System', extension: '', fullDomain: 'System', status: 'info', message: 'Session refresh detected. Retrying the current batch once.' })

            try {
              const refreshedToken = await ensureValidToken()
              if (!refreshedToken || refreshedToken === accessToken) {
                this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: 'Session expired. Please sign in again.' })
                this.runState = 'Stopped'
                return
              }

              accessToken = refreshedToken
              response = await postBatch(batch, accessToken)
            } catch (retryErr) {
              this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: retryErr.message || 'Session expired. Please sign in again.' })
              this.runState = 'Stopped'
              return
            }

            if (response.status === 401) {
              this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: 'Session expired. Please sign in again.' })
              this.runState = 'Stopped'
              return
            }
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error')
            throw new Error(errorText)
          }

          const result = await response.json()
          const outcomes = Array.isArray(result?.results)
            ? result.results
            : Array.isArray(result?.outcomes)
              ? result.outcomes
              : Array.isArray(result?.items)
                ? result.items
                : []
          allResults.push(...outcomes)

          const batchEntries = outcomes.map((item, itemIndex) => {
            const fallbackRequest = batch[itemIndex] || null
            const { domainName, extension, fullDomain } = this.getOutcomeDomainFields(item, fallbackRequest)
            const success = item?.success === true
            return {
              domainName,
              extension,
              fullDomain,
              status: success ? 'success' : 'error',
              message: success ? (item?.message || 'Uploaded') : (item?.errorMessage || item?.message || 'Failed')
            }
          })

          this.successCount += batchEntries.filter(entry => entry.status === 'success').length
          this.failureCount += batchEntries.filter(entry => entry.status === 'error').length

          this.appendLogEntries(batchEntries)
          this.appendLogEntry({
            domainName: 'Batch',
            extension: '',
            fullDomain: 'Batch',
            status: 'info',
            message: `${Math.min(index + batch.length, total)}/${total} processed`
          })

          await new Promise(resolve => setTimeout(resolve, 200))
        }

        const summary = {
          totalCount: total,
          successCount: allResults.filter(item => item?.success === true).length,
          failureCount: allResults.filter(item => item?.success !== true).length
        }

        if (!allResults.length && !this.stopRequested) {
          this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: 'No outcomes returned by the server.' })
          this.runState = 'Stopped'
          return
        }

        this.appendLogEntry({
          domainName: 'Summary',
          extension: '',
          fullDomain: 'Summary',
          status: 'info',
          message: `${summary.successCount} success, ${summary.failureCount} failed, ${summary.totalCount} total`
        })

        if (this.stopRequested) {
          this.runState = 'Stopped'
        } else if (this.runState !== 'Stopped') {
          this.runState = 'Completed'
        }
      } catch (err) {
        this.appendLogEntry({ domainName: '-', extension: '', fullDomain: '-', status: 'error', message: err.message || 'Upload failed.' })
        this.runState = 'Stopped'
      } finally {
        this.submitting = false
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

    downloadLogCsv() {
      if (!this.logEntries.length) return

      const header = ['domainName', 'extension', 'status', 'message']
      const rows = this.logEntries.map(entry => [
        entry.fullDomain || `${entry.domainName || ''}${entry.extension || ''}`,
        entry.extension || '',
        entry.status || '',
        entry.message || ''
      ])

      const csvContent = [header, ...rows]
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bulk-upload-log-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
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
</style>

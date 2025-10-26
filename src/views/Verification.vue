<template>
  <div class="verification-page">
    <div class="container">
      <h1>Verification</h1>

      <div class="form-row">
        <label for="handle">Handle</label>
        <input id="handle" v-model="handle" placeholder="Enter handle" />
        <button :disabled="loading" @click="verifyHandle">Search</button>
      </div>

      <div class="status">
        <div v-if="loading" class="loading">Loading...</div>
        <div v-if="error" class="error">{{ error }}</div>
      </div>

      <div class="results">
        <div v-if="items.length === 0 && !loading && !error" class="empty">No results</div>

        <div v-else-if="items.length > 0" class="results-container">
          <div class="results-header">
            <h3>{{ items.length }} record{{ items.length !== 1 ? 's' : '' }} found</h3>
          </div>
          
          <div class="bulk-actions" v-if="items.length > 0">
            <div class="select-all">
              <label>
                <input 
                  type="checkbox" 
                  :checked="isAllSelected" 
                  @change="toggleSelectAll"
                > Select All
              </label>
            </div>
            <button 
              class="bulk-create-btn" 
              :disabled="selectedItems.length === 0 || bulkLoading"
              @click="bulkCreatePdfs"
            >
              {{ bulkLoading ? 'Creating PDFs...' : `Bulk Create (${selectedItems.length})` }}
            </button>
          </div>

          <div class="table-container">
            <table class="results-table">
              <thead>
                <tr>
                  <th class="checkbox-column">
                    <input 
                      type="checkbox" 
                      :checked="isAllSelected" 
                      @change="toggleSelectAll"
                    >
                  </th>
                  <th>Domain</th>
                  <th>Registrant</th>
                  <th>Date To</th>
                  <th>Date Verified</th>
                  <th>Verified</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in items" :key="idx" :class="getRowClass(item)">
                  <td class="checkbox-column">
                    <input 
                      type="checkbox" 
                      :value="idx"
                      v-model="selectedItems"
                      :disabled="!item.domainName || !item.extension"
                    >
                  </td>
                  <td>{{ getItemField(item, 'domain') }}</td>
                  <td>{{ getItemField(item, 'registrant') }}</td>
                  <td>{{ getItemField(item, 'dateTo') }}</td>
                  <td>{{ getItemField(item, 'dateVerified') }}</td>
                  <td class="verified-cell">
                    <span v-html="getVerifiedDisplay(item)"></span>
                  </td>
                  <td class="pdf-cell">
                    <button 
                      @click="downloadPdf(item)" 
                      :disabled="loading || !item.domainName || !item.extension"
                      class="pdf-btn"
                      title="Download PDF">
                      📄
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk Result Modal -->
    <div v-if="showBulkModal" class="modal-overlay" @click="closeBulkModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>Bulk PDF Generation Results</h3>
          <button class="modal-close" @click="closeBulkModal">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="summary-stats">
            <div class="stat-item success">
              <span class="stat-number">{{ bulkResult.successCount || 0 }}</span>
              <span class="stat-label">Successful</span>
            </div>
            <div class="stat-item failure">
              <span class="stat-number">{{ bulkResult.failureCount || 0 }}</span>
              <span class="stat-label">Failed</span>
            </div>
          </div>

          <div v-if="bulkResult.failureCount > 0" class="failures-section">
            <h4>Failed Domains:</h4>
            <div class="failure-list">
              <div 
                v-for="result in failedResults" 
                :key="`${result.domainName}${result.extension}`"
                class="failure-item"
              >
                <strong>{{ result.domainName }}{{ result.extension }}</strong>
                <span class="error-message">{{ result.errorMessage }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button 
            v-if="bulkResult.zipFileBase64" 
            @click="downloadBulkZip" 
            class="download-btn"
          >
            Download ZIP
          </button>
          <button @click="closeBulkModal" class="close-btn">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ensureValidToken } from '../utils/auth.js'
export default {
  name: 'Verification',
  data() {
    return {
      handle: '',
      loading: false,
      error: null,
      items: [],
      selectedItems: [],
      bulkLoading: false,
      showBulkModal: false,
      bulkResult: {}
    }
  },
  computed: {
    isAllSelected() {
      const validItems = this.items.filter(item => item.domainName && item.extension)
      return validItems.length > 0 && this.selectedItems.length === validItems.length
    },
    failedResults() {
      return this.bulkResult.results ? this.bulkResult.results.filter(result => !result.success) : []
    }
  },
  methods: {
    async verifyHandle() {
      this.error = null
      this.items = []
      this.selectedItems = []

      const h = (this.handle || '').trim()
      if (!h) {
        this.error = 'Please enter a handle.'
        return
      }

      // Ensure token is valid (will attempt silent refresh if available)
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        this.error = 'Authentication required. Please sign in again.'
        return
      }

      this.loading = true
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL
        // Call domain-verification endpoint, using query param 'handle'
        const res = await fetch(`${apiBase}/api/domain-verification?handle=${encodeURIComponent(h)}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (res.status === 401) {
          // Token expired or invalid, redirect to login
          this.error = 'Session expired. Please sign in again.'
          // Could also emit event to parent or use router to go to login
          return
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `HTTP ${res.status}`)
        }

        const ctype = res.headers.get('content-type') || ''
        let data
        if (ctype.includes('application/json')) {
          data = await res.json()
        } else {
          // try to parse text as JSON
          const txt = await res.text()
          try { data = JSON.parse(txt) } catch (e) { data = txt }
        }

        // Expecting an array; fall back to object -> wrap, or empty array
        if (Array.isArray(data)) {
          this.items = data
        } else if (data && typeof data === 'object') {
          // If object contains array under 'items' or 'results', use that
          if (Array.isArray(data.items)) this.items = data.items
          else if (Array.isArray(data.results)) this.items = data.results
          else this.items = [data]
        } else if (typeof data === 'string') {
          // simple text response
          this.items = [data]
        } else {
          this.items = []
        }
      } catch (err) {
        this.error = err.message || String(err)
      } finally {
        this.loading = false
      }
    },
    getItemField(item, fieldName) {
      if (typeof item === 'string') return item

      // Try different possible field name variations
      const fieldMappings = {
        domain: ['fullDomain', 'domain', 'Domain', 'domainName', 'name'],
        registrant: ['registrant', 'Registrant', 'registrantName', 'owner'],
        dateTo: ['dateTo', 'DateTo', 'expiryDate', 'expiry', 'expires', 'expiration'],
        dateVerified: ['dateVerified', 'DateVerified', 'verifiedDate', 'verified', 'verificationDate'],
        autoRenew: ['autoRenew', 'AutoRenew', 'autoRenewal', 'renewal', 'renew']
      }

      const possibleKeys = fieldMappings[fieldName] || [fieldName]
      
      for (const key of possibleKeys) {
        if (item && typeof item === 'object' && key in item) {
          const value = item[key]
          
          // Format boolean values
          if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No'
          }
          
          // Format dates if they look like dates
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            try {
              return new Date(value).toLocaleDateString()
            } catch (e) {
              return value
            }
          }
          
          return value != null ? String(value) : '-'
        }
      }
      
      return '-'
    },
    decodeHtmlEntities(text) {
      if (typeof text !== 'string') return text
      
      // Create a temporary element to decode HTML entities
      const textarea = document.createElement('textarea')
      textarea.innerHTML = text
      return textarea.value
    },
    getItemField(item, fieldName) {
      if (typeof item === 'string') return this.decodeHtmlEntities(item)

      // Handle domain field specially - combine domainName + extension
      if (fieldName === 'domain' && item.domainName && item.extension) {
        return `${item.domainName}${item.extension}`
      }

      // Try different possible field name variations
      const fieldMappings = {
        domain: ['fullDomain', 'domain', 'Domain', 'domainName', 'name'],
        registrant: ['registrant', 'Registrant', 'registrantName', 'owner'],
        dateTo: ['dateTo', 'DateTo', 'expiryDate', 'expiry', 'expires', 'expiration'],
        dateVerified: ['dateVerified', 'DateVerified', 'verifiedDate', 'verified', 'verificationDate'],
        autoRenew: ['autoRenew', 'AutoRenew', 'autoRenewal', 'renewal', 'renew']
      }

      const possibleKeys = fieldMappings[fieldName] || [fieldName]
      
      for (const key of possibleKeys) {
        if (item && typeof item === 'object' && key in item) {
          const value = item[key]
          
          // Format boolean values
          if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No'
          }
          
          // Format dates if they look like dates
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            try {
              return new Date(value).toLocaleDateString()
            } catch (e) {
              return this.decodeHtmlEntities(value)
            }
          }
          
          return value != null ? this.decodeHtmlEntities(String(value)) : '-'
        }
      }
      
      return '-'
    },
    getVerifiedDisplay(item) {
      const verifiedValue = this.getItemField(item, 'autoRenew')
      
      // Handle string boolean values
      if (verifiedValue === 'true' || verifiedValue === true) {
        return '<span class="verified-yes">✓</span>'
      } else if (verifiedValue === 'false' || verifiedValue === false) {
        return '<span class="verified-no">✗</span>'
      } else {
        // Fallback to numeric comparison for backwards compatibility
        const numValue = parseInt(verifiedValue)
        if (numValue === 0) {
          return '<span class="verified-yes">✓</span>'
        } else if (numValue === 1) {
          return '<span class="verified-no">✗</span>'
        }
        return verifiedValue || '-'
      }
    },
    getRowClass(item) {
      const verifiedValue = this.getItemField(item, 'autoRenew')
      
      // Handle string boolean values
      if (verifiedValue === 'true' || verifiedValue === true) {
        return 'row-verified'
      } else if (verifiedValue === 'false' || verifiedValue === false) {
        return 'row-unverified'
      } else {
        // Fallback to numeric comparison for backwards compatibility
        const numValue = parseInt(verifiedValue)
        if (numValue === 0) {
          return 'row-verified'
        } else if (numValue === 1) {
          return 'row-unverified'
        }
        return 'row-unknown'
      }
    },
    async downloadPdf(item) {
      if (!item.domainName || !item.extension) {
        alert('Missing domain name or extension for PDF generation')
        return
      }

      // Ensure token is valid (will attempt silent refresh if available)
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        // session-expired event will be dispatched from ensureValidToken()
        return
      }

      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL
        const url = `${apiBase}/api/domain-verification/pdf?domainName=${encodeURIComponent(item.domainName)}&extension=${encodeURIComponent(item.extension)}`
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        })

        if (response.status === 401) {
          alert('Session expired. Please sign in again.')
          return
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        // Get the PDF blob
        const blob = await response.blob()
        
        // Create a blob URL and open in new tab
        const blobUrl = URL.createObjectURL(blob)
        const newWindow = window.open(blobUrl, '_blank')
        
        if (!newWindow) {
          // Fallback if popup blocked - download directly
          const link = document.createElement('a')
          link.href = blobUrl
          link.download = `${item.domainName}${item.extension}_verification.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
        
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
        
      } catch (err) {
        console.error('PDF download error:', err)
        alert(`Failed to download PDF: ${err.message}`)
      }
    },
    toggleSelectAll() {
      const validItems = this.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.domainName && item.extension)
        .map(({ index }) => index)

      if (this.isAllSelected) {
        this.selectedItems = []
      } else {
        this.selectedItems = [...validItems]
      }
    },
    async bulkCreatePdfs() {
      if (this.selectedItems.length === 0) {
        alert('Please select at least one domain.')
        return
      }

      // Ensure token is valid (will attempt silent refresh if available)
      const accessToken = await ensureValidToken()
      if (!accessToken) {
        // session-expired event will be dispatched from ensureValidToken()
        return
      }

      this.bulkLoading = true
      try {
        // Build the domains array from selected items
        const domains = this.selectedItems.map(index => {
          const item = this.items[index]
          return {
            domainName: item.domainName,
            extension: item.extension
          }
        })

        const apiBase = import.meta.env.VITE_API_BASE_URL
        const response = await fetch(`${apiBase}/api/domain-verification/pdf/bulk`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ domains })
        })

        if (response.status === 401) {
          alert('Session expired. Please sign in again.')
          return
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const result = await response.json()
        this.bulkResult = result
        this.showBulkModal = true
        
        // Clear selections after successful request
        this.selectedItems = []

      } catch (err) {
        console.error('Bulk PDF creation error:', err)
        alert(`Failed to create bulk PDFs: ${err.message}`)
      } finally {
        this.bulkLoading = false
      }
    },
    downloadBulkZip() {
      if (!this.bulkResult.zipFileBase64) {
        alert('No ZIP file available for download.')
        return
      }

      try {
        // Decode base64 to blob
        const binaryString = atob(this.bulkResult.zipFileBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        const blob = new Blob([bytes], { type: 'application/zip' })
        const blobUrl = URL.createObjectURL(blob)
        
        // Create download link
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = `verification_pdfs_${new Date().toISOString().split('T')[0]}.zip`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
        
      } catch (err) {
        console.error('ZIP download error:', err)
        alert(`Failed to download ZIP: ${err.message}`)
      }
    },
    closeBulkModal() {
      this.showBulkModal = false
      this.bulkResult = {}
    },
    formatItem(item) {
      if (typeof item === 'string') return item
      try { return JSON.stringify(item, null, 2) } catch (e) { return String(item) }
    }
  }
}
</script>

<style scoped>
.verification-page {
  min-height: 100%;
  padding: 32px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  position: relative;
}

.verification-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2c2c2c 0%, #dc3545 100%);
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(44, 44, 44, 0.1);
  border: 1px solid rgba(44, 44, 44, 0.1);
}

.container h1 {
  color: #2c2c2c;
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 8px;
  text-align: center;
}

.container h1::after {
  content: '';
  display: block;
  width: 60px;
  height: 4px;
  background: linear-gradient(90deg, #2c2c2c 0%, #dc3545 100%);
  margin: 12px auto 24px auto;
  border-radius: 2px;
}

.form-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.form-row label {
  min-width: 60px;
  font-weight: 600;
}

.form-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
}

.form-row button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(44, 44, 44, 0.3);
}

.form-row button:hover:not(:disabled) {
  background: linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(44, 44, 44, 0.4);
}

.form-row button:disabled { 
  opacity: 0.6; 
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 6px rgba(44, 44, 44, 0.2);
}

.status { margin-bottom: 16px }
.loading { 
  color: #2c2c2c;
  font-weight: 600;
}
.error { 
  color: #dc3545;
  font-weight: 600;
  padding: 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
}

.results .empty { color: #666; padding: 24px; text-align: center }

.results-container {
  margin-top: 16px;
}

.results-header {
  margin-bottom: 16px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border-left: 4px solid #dc3545;
  border: 1px solid rgba(44, 44, 44, 0.1);
}

.results-header h3 {
  margin: 0;
  color: #2c2c2c;
  font-size: 1.2rem;
  font-weight: 700;
}

.table-container {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.results-table th {
  background: #f8f9fa;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.results-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #dee2e6;
  color: #495057;
}

.results-table tbody tr:hover {
  background: #f8f9fa;
}

.results-table tbody tr.row-verified {
  background: #f8fff8;
  border-left: 4px solid #28a745;
}

.results-table tbody tr.row-verified:hover {
  background: #f0fff0;
}

.results-table tbody tr.row-unverified {
  background: #fff8f8;
  border-left: 4px solid #dc3545;
}

.results-table tbody tr.row-unverified:hover {
  background: #fff0f0;
}

.results-table tbody tr.row-unknown {
  background: #fffef8;
  border-left: 4px solid #ffc107;
}

.results-table tbody tr.row-unknown:hover {
  background: #fffdf0;
}

.results-table tbody tr:last-child td {
  border-bottom: none;
}

.verified-cell {
  text-align: center;
  font-size: 18px;
}

.verified-yes {
  color: #28a745;
  font-weight: bold;
}

.verified-no {
  color: #dc3545;
  font-weight: bold;
}

.pdf-cell {
  text-align: center;
}

.pdf-btn {
  background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(44, 44, 44, 0.3);
}

.pdf-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(44, 44, 44, 0.4);
}

.pdf-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: 0 1px 4px rgba(108, 117, 125, 0.3);
}

/* Responsive table */
@media (max-width: 768px) {
  .results-table {
    font-size: 14px;
  }
  
  .results-table th,
  .results-table td {
    padding: 8px 12px;
  }
}

/* Bulk Actions */
.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.select-all label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
}

.bulk-create-btn {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bulk-create-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #c82333 0%, #dc3545 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
}

.bulk-create-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: 0 2px 6px rgba(108, 117, 125, 0.3);
}

.checkbox-column {
  width: 40px;
  text-align: center;
}

.checkbox-column input[type="checkbox"] {
  transform: scale(1.2);
  cursor: pointer;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  max-width: 600px;
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

.modal-header h3 {
  margin: 0;
  color: #495057;
  font-size: 1.3rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.modal-close:hover {
  background: #e9ecef;
  color: #495057;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.summary-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  justify-content: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 24px;
  border-radius: 8px;
  min-width: 120px;
}

.stat-item.success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.stat-item.failure {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.failures-section {
  margin-top: 24px;
}

.failures-section h4 {
  margin: 0 0 16px 0;
  color: #721c24;
  font-size: 1.1rem;
}

.failure-list {
  max-height: 200px;
  overflow-y: auto;
}

.failure-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  margin-bottom: 8px;
}

.failure-item strong {
  color: #721c24;
  font-size: 1rem;
}

.error-message {
  color: #856404;
  font-size: 0.9rem;
  font-style: italic;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #dee2e6;
  background: #f8f9fa;
}

.download-btn {
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
  font-weight: 700;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.download-btn:hover {
  background: linear-gradient(135deg, #c82333 0%, #dc3545 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(220, 53, 69, 0.4);
}

.close-btn {
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: #545b62;
  transform: translateY(-1px);
}

@media (max-width: 600px) {
  .form-row { flex-direction: column; align-items: stretch }
  .form-row label { min-width: unset }
  
  .bulk-actions {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .summary-stats {
    flex-direction: column;
    gap: 12px;
  }
  
  .modal-content {
    width: 95%;
    margin: 10px;
  }
  
  .modal-footer {
    flex-direction: column;
  }
}
</style>

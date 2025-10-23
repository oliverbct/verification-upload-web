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
          
          <div class="table-container">
            <table class="results-table">
              <thead>
                <tr>
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
  </div>
</template>

<script>
export default {
  name: 'Verification',
  data() {
    return {
      handle: '',
      loading: false,
      error: null,
      items: []
    }
  },
  methods: {
    async verifyHandle() {
      this.error = null
      this.items = []

      const h = (this.handle || '').trim()
      if (!h) {
        this.error = 'Please enter a handle.'
        return
      }

      // Get the Google auth token
      const accessToken = localStorage.getItem('google_access_token')
      if (!accessToken) {
        this.error = 'Authentication required. Please sign in first.'
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

      // Get the Google auth token
      const accessToken = localStorage.getItem('google_access_token')
      if (!accessToken) {
        alert('Authentication required. Please sign in first.')
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
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
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
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.form-row button:disabled { opacity: 0.6; cursor: not-allowed }

.status { margin-bottom: 16px }
.loading { color: #0d6efd }
.error { color: #d9534f }

.results .empty { color: #666; padding: 24px; text-align: center }

.results-container {
  margin-top: 16px;
}

.results-header {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.results-header h3 {
  margin: 0;
  color: #495057;
  font-size: 1.1rem;
  font-weight: 600;
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
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.pdf-btn:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

.pdf-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
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

@media (max-width: 600px) {
  .form-row { flex-direction: column; align-items: stretch }
  .form-row label { min-width: unset }
}
</style>

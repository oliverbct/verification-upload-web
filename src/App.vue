<template> 
  <div id="app"> 
    <!-- Header with Navigation (hidden when backend denies access) -->
    <header v-if="isAuthorized !== false" class="app-header">
      <div class="header-container">
        <div class="brand">
          <img src="https://vnregistrar-static.s3.us-west-1.amazonaws.com/hi-tek_logo.jpg" alt="Hi-Tek Logo" class="brand-logo">
          <div class="brand-text">
            <h2>VN Registrar</h2>
            <span class="brand-subtitle">Domain Verification</span>
          </div>
        </div>
        
        <!-- Navigation Menu (always visible when authenticated) -->
        <nav v-if="isAuthenticated" class="main-nav">
          <router-link to="/verification" class="nav-link">Verification</router-link>
        </nav>
        
        <!-- User Info (when authenticated) -->
        <div v-if="isAuthenticated" class="user-section">
          <span class="welcome-text">Welcome, {{ getDisplayName() }}</span>
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </div>
      </div>
    </header>

    <!-- Session Expired Modal -->
    <div v-if="sessionExpiredModal" class="session-modal-overlay" @click="closeSessionModal">
      <div class="session-modal" @click.stop>
        <h3>Session expired</h3>
        <p>Your session has expired. Please sign in again to continue.</p>
        <div class="session-actions">
          <!-- Reuse the GoogleLogin button for re-authentication -->
          <GoogleLogin :callback="handleGoogleLogin" />
          <button class="session-close" @click="closeSessionModal">Close</button>
        </div>
      </div>
    </div>

    <!-- Access Denied Modal (only Logout button) -->
    <div v-if="accessDeniedModal" class="access-denied-overlay">
      <div class="access-denied" @click.stop>
        <h3>Access denied</h3>
        <p>Your account is not authorized to use this application. If you believe this is an error, please contact the administrator.</p>
        <div class="actions">
          <button class="logout" @click="handleLogout">Logout</button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <main class="main-content">
      <div v-if="!isAuthenticated" class="auth-container">
        <h2>Please sign in with Google</h2>
        <GoogleLogin :callback="handleGoogleLogin" prompt />
      </div>
      
      <div v-else class="content">
        <!-- Show loading indicator while checking access -->
        <div v-if="isCheckingAccess" class="access-checking">
          <div class="spinner"></div>
          <p>Verifying access...</p>
        </div>
        <!-- Only render app routes when the backend explicitly allows this user -->
        <router-view v-else-if="isAuthorized === true"></router-view>
        <!-- If not authorized we keep the UI blocked and show the access denied modal -->
        <div v-else class="access-block" style="min-height:60vh"></div>
      </div>
    </main>
  </div> 
</template> 
 
<script> 
import { decodeCredential, googleLogout } from 'vue3-google-login'
import { ensureValidToken } from './utils/auth.js'

export default { 
  name: 'App',
  data() {
    return {
      isAuthenticated: false,
      accessToken: null,
      userInfo: null,
      error: null,
      sessionExpiredModal: false,
      isAuthorized: null, // null = unknown/checking, true = allowed, false = denied
      accessDeniedModal: false,
      isCheckingAccess: false
    }
  },
  async mounted() {
    // Check if user is already authenticated (token stored in localStorage)
    const storedToken = localStorage.getItem('google_access_token')
    const storedUserInfo = localStorage.getItem('user_info')
    
    if (storedToken && storedUserInfo) {
      this.accessToken = storedToken
      this.userInfo = JSON.parse(storedUserInfo)
      this.isAuthenticated = true
      this.isCheckingAccess = true
      
      // Clear stale access_allowed flag immediately so router guard doesn't use old value
      try { localStorage.removeItem('access_allowed') } catch(e) {}
      
      // verify access rights with backend using ID token
      try {
        const token = await ensureValidToken()
        if (token) {
          await this.checkAccess(token)
        } else {
          // Token invalid, treat as not authorized
          this.isAuthorized = false
          this.accessDeniedModal = true
        }
      } catch (e) {
        console.warn('mounted: checkAccess failed', e)
        // On error, deny access conservatively
        this.isAuthorized = false
        this.accessDeniedModal = true
      } finally {
        this.isCheckingAccess = false
      }
    } else {
      // No stored auth, user needs to sign in (authorized state irrelevant)
      this.isAuthorized = null
    }

    // Listen for global session-expired events (dispatched by auth helpers)
    try {
      window.addEventListener('session-expired', () => {
        this.sessionExpiredModal = true
      })
    } catch (e) {
      console.warn('Failed to attach session-expired listener', e)
    }
  },
  methods: {
    async handleGoogleLogin(response) {
      try {
        // Decode the credential to get user info
        const userData = decodeCredential(response.credential)
        
        this.userInfo = {
          name: userData.name,
          email: userData.email,
          picture: userData.picture
        }
        
        // Store the token and user info
        this.accessToken = response.credential
        localStorage.setItem('google_access_token', response.credential)
        localStorage.setItem('user_info', JSON.stringify(this.userInfo))
        
        this.isAuthenticated = true
        this.isCheckingAccess = true
        // After authentication, confirm if this user is allowed to use the site
        try {
          await this.checkAccess(response.credential)
        } catch (e) {
          console.warn('handleGoogleLogin: access check failed', e)
          this.isAuthorized = false
          this.accessDeniedModal = true
        } finally {
          this.isCheckingAccess = false
        }
      } catch (err) {
        this.error = 'Authentication failed: ' + err.message
        console.error('Google login error:', err)
      }
    },
    
    handleLogout() {
      googleLogout()
      localStorage.removeItem('google_access_token')
      localStorage.removeItem('user_info')
      localStorage.removeItem('access_allowed')
      this.isAuthenticated = false
      this.accessToken = null
      this.userInfo = null
      this.error = null
      this.isAuthorized = false
      this.accessDeniedModal = false
      this.sessionExpiredModal = false

      // Ensure the router navigates back to the login view/root
      try {
        if (this.$router && typeof this.$router.push === 'function') {
          this.$router.push({ path: '/' })
          return
        }
      } catch (e) {
        console.warn('router push failed during logout, falling back to window.location', e)
      }

      // Fallback to full reload to guarantee UI resets
      try { window.location.href = '/' } catch (e) { /* best-effort */ }
    },
    
    getDisplayName() {
      if (!this.userInfo?.name) return ''
      
      let fullName = this.userInfo.name.trim()
      
      // Remove anything in parentheses (nicknames)
      fullName = fullName.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
      
      // Clean up any double spaces
      fullName = fullName.replace(/\s+/g, ' ')
      
      const nameParts = fullName.split(' ')
      
      if (nameParts.length === 1) {
        // Only one name part
        return nameParts[0]
      } else if (nameParts.length === 2) {
        // First and last name
        return `${nameParts[0]} ${nameParts[1]}`
      } else if (nameParts.length > 2) {
        // Multiple names - keep first and last
        return `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      }
      
      return fullName || this.userInfo.name
    }
    ,
    async checkAccess(idToken) {
      // idToken is the Google ID token (JWT)
      if (!idToken) {
        this.isAuthorized = false
        this.accessDeniedModal = true
        return
      }

      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL
        const res = await fetch(`${apiBase}/api/me`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (res.status === 401) {
          // Token invalid/expired - trigger session flow
          window.dispatchEvent(new CustomEvent('session-expired'))
          return
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(txt || `HTTP ${res.status}`)
        }

        const data = await res.json()
        // Expect { allowed: true|false }
        if (data && data.allowed === true) {
          this.isAuthorized = true
          this.accessDeniedModal = false
        } else {
          this.isAuthorized = false
          this.accessDeniedModal = true
          // Do NOT automatically logout the user here — keep the session present
          // so the access-denied modal can be displayed. The user may explicitly
          // choose to logout via the modal's Logout button.
        }
      } catch (e) {
        console.error('checkAccess error', e)
        // On error, be conservative: deny access
        this.isAuthorized = false
        this.accessDeniedModal = true
      }
    },
    closeAccessDenied() {
      // When programmatically called, treat as a request to log out.
      try { this.handleLogout() } catch (e) { this.accessDeniedModal = false }
    }
    ,
    closeSessionModal() {
      this.sessionExpiredModal = false
    }
  }
} 
</script>

<style>
/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f8f9fa;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header Styles */
.app-header {
  background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
  color: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  position: sticky;
  top: 0;
  z-index: 1000;
  border-bottom: 3px solid #dc3545;
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 72px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  height: 48px;
  width: auto;
  object-fit: contain;
  border-radius: 4px;
  background: white;
  padding: 4px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-text h2 {
  color: white;
  font-weight: 700;
  font-size: 1.4rem;
  margin: 0;
  line-height: 1.2;
}

.brand-subtitle {
  color: #dc3545;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Navigation Styles */
.main-nav {
  display: flex;
  gap: 24px;
  flex: 1;
  justify-content: center;
}

.nav-link {
  padding: 12px 24px;
  text-decoration: none;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  font-size: 1rem;
  border-radius: 8px;
  transition: all 0.3s ease;
  position: relative;
  border: 2px solid transparent;
}

.nav-link:hover {
  color: white;
  background-color: rgba(220, 53, 69, 0.2);
  border-color: rgba(220, 53, 69, 0.3);
  transform: translateY(-1px);
}

.nav-link.router-link-active {
  color: white;
  background-color: #dc3545;
  font-weight: 600;
  border-color: #dc3545;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 2px;
  background-color: #ffffff;
  border-radius: 1px;
}

/* User Section */
.user-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.welcome-text {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.logout-btn {
  padding: 10px 18px;
  background-color: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background-color: rgba(220, 53, 69, 0.2);
  border-color: #dc3545;
  color: #dc3545;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.2);
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.auth-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 72px);
  gap: 32px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  position: relative;
}

.auth-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2c2c2c 0%, #dc3545 100%);
}

.auth-container h2 {
  color: #2c2c2c;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
}

.content {
  flex: 1;
  background-color: #ffffff;
  min-height: calc(100vh - 64px);
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-container {
    padding: 0 16px;
    height: 64px;
  }
  
  .brand-logo {
    height: 40px;
  }
  
  .brand-text h2 {
    font-size: 1.2rem;
  }
  
  .brand-subtitle {
    font-size: 0.7rem;
  }
  
  .main-nav {
    gap: 12px;
  }
  
  .nav-link {
    padding: 8px 16px;
    font-size: 0.9rem;
  }
  
  .welcome-text {
    display: none;
  }
  
  .logout-btn {
    padding: 8px 14px;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .brand {
    gap: 8px;
  }
  
  .brand-logo {
    height: 36px;
  }
  
  .brand-text h2 {
    font-size: 1.1rem;
  }
  
  .main-nav {
    gap: 8px;
  }
  
  .nav-link {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
}

/* Session modal */
.session-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
}
.session-modal {
  background: #fff;
  padding: 24px;
  border-radius: 10px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  text-align: center;
}
.session-modal h3 { margin-bottom: 8px; color: #2c2c2c }
.session-modal p { margin-bottom: 16px; color: #666 }
.session-actions { display:flex; gap:12px; justify-content:center; align-items:center }
.session-close { padding:8px 12px; border-radius:6px; border:none; background:#6c757d; color:white; cursor:pointer }

/* Access denied modal */
.access-denied-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1600;
}
.access-denied {
  background: #fff;
  padding: 28px;
  border-radius: 10px;
  max-width: 520px;
  width: 92%;
  box-shadow: 0 12px 40px rgba(0,0,0,0.25);
  text-align: center;
}
.access-denied h3 { color: #2c2c2c; margin-bottom: 8px }
.access-denied p { color: #666; margin-bottom: 18px }
.access-denied .actions { display:flex; gap:12px; justify-content:center }
.access-denied .actions button { padding:10px 14px; border-radius:8px; border:none; cursor:pointer }
.access-denied .logout { background:#dc3545; color:white }
.access-denied .close { background:#6c757d; color:white }

/* Access checking (loading spinner) */
.access-checking {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
}
.access-checking p {
  color: #666;
  font-size: 1rem;
}
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(220, 53, 69, 0.2);
  border-top-color: #dc3545;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

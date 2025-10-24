<template> 
  <div id="app"> 
    <!-- Header with Navigation -->
    <header class="app-header">
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
          <router-link to="/" class="nav-link">Home</router-link>
          <router-link to="/verification" class="nav-link">Verification</router-link>
        </nav>
        
        <!-- User Info (when authenticated) -->
        <div v-if="isAuthenticated" class="user-section">
          <span class="welcome-text">Welcome, {{ getDisplayName() }}</span>
          <button @click="handleLogout" class="logout-btn">Logout</button>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="main-content">
      <div v-if="!isAuthenticated" class="auth-container">
        <h2>Please sign in with Google</h2>
        <GoogleLogin :callback="handleGoogleLogin" prompt />
      </div>
      
      <div v-else class="content">
        <router-view></router-view>
      </div>
    </main>
  </div> 
</template> 
 
<script> 
import { decodeCredential, googleLogout } from 'vue3-google-login'

export default { 
  name: 'App',
  data() {
    return {
      isAuthenticated: false,
      accessToken: null,
      userInfo: null,
      error: null
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
      } catch (err) {
        this.error = 'Authentication failed: ' + err.message
        console.error('Google login error:', err)
      }
    },
    
    handleLogout() {
      googleLogout()
      localStorage.removeItem('google_access_token')
      localStorage.removeItem('user_info')
      this.isAuthenticated = false
      this.accessToken = null
      this.userInfo = null
      this.error = null
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
</style>

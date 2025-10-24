<template>
  <div class="home-page">
    <div class="content-container">
      <div class="welcome-section">
        <div class="hero-content">
          <h1>Welcome to VN Registrar</h1>
          <p class="hero-subtitle">Professional Domain Verification & Management</p>
          <div class="hero-actions">
            <router-link to="/verification" class="cta-btn">
              Start Verification
            </router-link>
          </div>
        </div>
        
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">🔍</div>
            <h3>Domain Search</h3>
            <p>Search and verify domain registration details with comprehensive reporting.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📄</div>
            <h3>PDF Generation</h3>
            <p>Generate professional verification PDFs for individual domains or in bulk.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔐</div>
            <h3>Secure Access</h3>
            <p>Protected by Google OAuth authentication for secure domain management.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home'
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  position: relative;
}

.home-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2c2c2c 0%, #dc3545 100%);
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 60px 20px;
}

.welcome-section {
  text-align: center;
}

.hero-content {
  margin-bottom: 80px;
}

.hero-content h1 {
  font-size: 3.5rem;
  color: #2c2c2c;
  margin-bottom: 16px;
  font-weight: 800;
  line-height: 1.2;
}

.hero-content h1::after {
  content: '';
  display: block;
  width: 120px;
  height: 6px;
  background: linear-gradient(90deg, #2c2c2c 0%, #dc3545 100%);
  margin: 20px auto;
  border-radius: 3px;
}

.hero-subtitle {
  font-size: 1.3rem;
  color: #6c757d;
  margin-bottom: 40px;
  font-weight: 500;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-actions {
  margin-top: 32px;
}

.cta-btn {
  display: inline-block;
  padding: 16px 32px;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  color: white;
  text-decoration: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1.1rem;
  transition: all 0.3s ease;
  box-shadow: 0 6px 20px rgba(220, 53, 69, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cta-btn:hover {
  background: linear-gradient(135deg, #c82333 0%, #dc3545 100%);
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(220, 53, 69, 0.4);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 32px;
  margin-top: 60px;
}

.feature-card {
  background: white;
  padding: 32px 24px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(44, 44, 44, 0.1);
  border: 1px solid rgba(44, 44, 44, 0.1);
  transition: all 0.3s ease;
  text-align: center;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 40px rgba(44, 44, 44, 0.15);
  border-color: rgba(220, 53, 69, 0.3);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.feature-card h3 {
  color: #2c2c2c;
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.feature-card p {
  color: #6c757d;
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 500;
}

/* Responsive Design */
@media (max-width: 768px) {
  .content-container {
    padding: 40px 16px;
  }
  
  .hero-content h1 {
    font-size: 2.8rem;
  }
  
  .hero-subtitle {
    font-size: 1.1rem;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-top: 40px;
  }
  
  .feature-card {
    padding: 24px 20px;
  }
}

@media (max-width: 480px) {
  .hero-content h1 {
    font-size: 2.2rem;
  }
  
  .hero-subtitle {
    font-size: 1rem;
  }
  
  .cta-btn {
    padding: 14px 24px;
    font-size: 1rem;
  }
}
</style>

<template>
  <div class="home-page">
    <div class="content-container">
      <div class="welcome-section">
        <h1>Welcome to VN Registrar</h1>
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
  min-height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.welcome-section {
  text-align: center;
}

.welcome-section h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 12px;
  font-weight: 700;
}

/* Responsive Design */
@media (max-width: 768px) {
  .content-container {
    padding: 20px 16px;
  }
  
  .welcome-section h1 {
    font-size: 2rem;
  }
}
</style>

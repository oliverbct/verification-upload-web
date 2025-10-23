# VN Registrar - Verification Documents Upload (Frontend)

A Vue 3 application for domain verification document management with Google OAuth authentication.

## 🚀 Features

- **Google OAuth Authentication** - Secure login with Google accounts
- **Domain Verification Search** - Search domain records by handle
- **PDF Generation** - Download verification PDFs for domains
- **Responsive Design** - Mobile-friendly interface
- **Real-time Status** - Visual indicators for verification status

## 🛠️ Tech Stack

- **Vue 3** - Progressive JavaScript framework
- **Vue Router** - Client-side routing
- **Vite** - Fast build tool and dev server
- **Google OAuth** - Authentication via vue3-google-login

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Google OAuth Client ID
- Backend API running (Java/Spring Boot)

## ⚙️ Environment Setup

Create environment files with your configuration:

### `.env.development`
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### `.env.production`
```env
VITE_API_BASE_URL=https://your-production-domain.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vnregistrar-verification-docs-upload
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   - Update `.env.development` with your Google Client ID
   - Ensure backend API is running on the configured URL

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open application**
   - Default: http://localhost:5174
   - The port is configured in `vite.config.js`

## 🏗️ Build for Production

```bash
npm run build
npm run preview
```

## 📱 Application Structure

### **Authentication Flow**
1. User signs in with Google OAuth
2. Token is stored in localStorage
3. All API requests include Authorization header

### **Main Features**

#### **Home Page (`/`)**
- Simple welcome message
- Access after authentication

#### **Verification Page (`/verification`)**
- Search domains by handle
- View domain records in a table:
  - Domain (domainName + extension)
  - Registrant information
  - Expiry dates
  - Verification status
  - PDF download buttons

## 🔌 API Integration

The frontend communicates with these backend endpoints:

- `GET /api/hello` - Welcome message
- `GET /api/domain-verification?handle={handle}` - Search domains
- `GET /api/domain-verification/pdf?domainName={name}&extension={ext}` - Generate PDF

All endpoints require Google OAuth Bearer token authentication.

## 🎨 UI Features

- **Visual Status Indicators** - Green/red rows for verified/unverified domains
- **Responsive Table** - Mobile-friendly domain listings
- **PDF Download** - One-click PDF generation and download
- **Error Handling** - User-friendly error messages
- **Loading States** - Visual feedback during API calls

## 🔧 Configuration

### **Port Configuration**
Default port is 5174, configured in `vite.config.js`:
```javascript
export default defineConfig({
  server: {
    port: 5174
  }
})
```

### **Google OAuth Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized JavaScript origins:
   - `http://localhost:5174` (development)
   - Your production domain
4. Update `VITE_GOOGLE_CLIENT_ID` in environment files

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## 🔐 Security Notes

- Environment files with sensitive data are excluded from git
- Google OAuth tokens are stored in localStorage
- All API requests require authentication
- Session expiry is handled gracefully

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is private and proprietary.

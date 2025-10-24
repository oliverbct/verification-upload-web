# AWS Amplify Manual Deployment Guide

## Option 1: Using AWS Amplify Console (Recommended)

1. Go to AWS Amplify Console: https://console.aws.amazon.com/amplify/
2. Click "New app" > "Host web app"
3. Connect to GitHub and select your repository: `Hi-Tek-Enterprises/vnregistrar-verification-docs-upload`
4. Configure build settings:
   - Build command: `npm run build`
   - Base directory: `/`
   - Build output directory: `dist`
5. Add environment variables:
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `VITE_API_BASE_URL`: Your backend API URL (production)

## Option 2: Using AWS CLI (Alternative)

If you have AWS CLI configured, you can upload the built files directly to S3:

```bash
# Build the project
npm run build

# Create S3 bucket for static hosting
aws s3 mb s3://vnregistrar-frontend-unique-name

# Configure bucket for static website hosting
aws s3 website s3://vnregistrar-frontend-unique-name --index-document index.html --error-document index.html

# Upload built files
aws s3 sync dist/ s3://vnregistrar-frontend-unique-name --delete
```

## Build Configuration

The project is configured with:
- Build tool: Vite
- Output directory: dist/
- Build command: npm run build
- Development command: npm run dev

## Environment Variables Required

For production deployment, you'll need:
- VITE_GOOGLE_CLIENT_ID (your Google OAuth client ID)
- VITE_API_BASE_URL (your production backend URL)
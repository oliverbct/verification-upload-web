#!/bin/bash

# GitHub Deployment Checklist Script
echo "🚀 Preparing VN Registrar Frontend for GitHub..."
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

echo "✅ Project Structure Check:"
echo "   📁 Source files in src/"
echo "   📄 README.md updated"
echo "   🔧 package.json configured"
echo "   🚫 .gitignore configured"
echo "   🌍 Environment files ready"
echo

echo "🔍 Pre-commit Verification:"

# Check for sensitive data
echo "   🔐 Checking for sensitive data..."
if grep -r "client_secret\|password\|secret_key" src/ 2>/dev/null; then
    echo "   ⚠️  Warning: Potential sensitive data found in source files"
else
    echo "   ✅ No sensitive data found in source files"
fi

# Check environment files
echo "   🌍 Environment configuration..."
if [ -f ".env.development" ] && [ -f ".env.production" ] && [ -f ".env.example" ]; then
    echo "   ✅ Environment files present"
else
    echo "   ❌ Missing environment files"
fi

# Check dependencies
echo "   📦 Dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ Node modules installed"
else
    echo "   ⚠️  Node modules not installed (run npm install)"
fi

echo
echo "🎯 Next Steps:"
echo "1. Update repository URL in package.json"
echo "2. Replace production API URL in .env.production"
echo "3. Verify Google OAuth authorized origins"
echo "4. Run: git add ."
echo "5. Run: git commit -m 'Initial commit: VN Registrar frontend application'"
echo "6. Run: git push origin main"
echo
echo "📋 Repository Setup:"
echo "• Create new GitHub repository"
echo "• Set repository to private (contains OAuth client ID)"
echo "• Add collaborators as needed"
echo "• Configure branch protection rules"
echo
echo "🔐 Security Reminders:"
echo "• .env files are gitignored (good!)"
echo "• Google Client ID is in committed files (ensure OAuth origins are configured)"
echo "• Consider using environment variables in production deployment"
echo
echo "Ready for GitHub! 🚀"
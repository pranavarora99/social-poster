# Social Poster - Chrome Extension

Transform any webpage into engaging social media posts with AI-powered personalization.

## Quick Start

### Development Setup
```bash
# Install dependencies
npm install

# Start development mode
npm run dev

# Build for production
npm run build

# Create distribution zip
npm run zip
```

### Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" 
4. Select this project folder
5. The extension icon should appear in your toolbar

## 🏗️ Architecture

### File Structure
```
social-poster/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup UI
├── popup.js               # Main extension logic
├── popup.css              # Popup styling
├── content.js             # Page content extraction
├── icons/                 # Extension icons
├── website/               # Marketing website
└── dist/                  # Built extension files
```

### Key Components

1. **Content Script** (`content.js`)
   - Extracts webpage data (title, description, images, key points)
   - Analyzes page structure and content
   - Handles different website types

2. **Popup Interface** (`popup.html/js/css`)
   - Platform selection (LinkedIn, Twitter, Instagram, Facebook)
   - Template style selection (Professional, Modern, Minimal)
   - Generated post preview and export

3. **Post Generation Engine** (`popup.js`)
   - Platform-specific content optimization
   - Template-based text generation
   - Export functionality (copy/download)

## 🛠️ Development Workflow

### Testing
```bash
# Test extension functionality
npm run test

# Lint code
npm run lint

# Test on different websites
# 1. Load extension in Chrome
# 2. Visit test websites
# 3. Click extension icon
# 4. Verify content extraction and generation
```

### Debugging
1. **Extension Console**: Right-click extension icon → "Inspect popup"
2. **Content Script**: Open DevTools on any webpage → Console tab
3. **Background Scripts**: Go to `chrome://extensions/` → Click "background page"

## 🚀 Deployment

### Chrome Web Store
1. Create developer account at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Build extension: `npm run build`
3. Create zip: `npm run zip`
4. Upload to Chrome Web Store
5. Fill out store listing with screenshots and description

### Required Store Assets
- Extension icons (16x16, 48x48, 128x128)
- Screenshots (1280x800 recommended)
- Detailed description
- Privacy policy URL
- Support website URL

## 🔧 Configuration

### Permissions (manifest.json)
- `activeTab`: Access current webpage content
- `storage`: Save user preferences
- `scripting`: Inject content scripts

### Host Permissions
- `http://*/*` and `https://*/*`: Access all websites for content extraction

## 📊 Analytics & Monitoring

### Usage Tracking
- Extension installs/uninstalls
- Feature usage (platform selection, template usage)
- Error rates and performance metrics

### Error Handling
- CORS issues with certain websites
- Content extraction failures
- Permission denied scenarios

## 🧪 Testing Strategy

### Manual Testing
1. **Popular Websites**: Test on top 50 websites
2. **Different Content Types**: Blogs, news, e-commerce, SaaS
3. **Edge Cases**: Single-page apps, dynamic content, CORS restrictions

### Automated Testing
```bash
# Run unit tests
npm run test

# Test content extraction
npm run test:extraction

# Test post generation
npm run test:generation
```

## 🔒 Security & Privacy

### Data Handling
- All processing happens locally in browser
- No content sent to external servers
- No user data stored remotely
- No tracking or analytics without consent

### Permissions
- Minimal required permissions
- Clear explanations for each permission
- Optional permissions for advanced features

## 📈 Performance Optimization

### Bundle Size
- No external dependencies in content script
- Minimal popup bundle size
- Efficient DOM manipulation

### Memory Usage
- Clean up event listeners
- Efficient content extraction algorithms
- Prevent memory leaks in long-running tabs

## 🐛 Common Issues

### Content Extraction Fails
- **Cause**: Dynamic content loading, CORS restrictions
- **Solution**: Retry mechanism, fallback extraction methods

### Extension Not Loading
- **Cause**: Manifest errors, permission issues
- **Solution**: Check `chrome://extensions/` for error messages

### Slow Performance
- **Cause**: Large page content, inefficient selectors
- **Solution**: Optimize extraction algorithms, add timeouts

## 📝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add some feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: [socialposter.app/docs](https://socialposter.app/docs)
- **Issues**: [GitHub Issues](https://github.com/yourusername/social-poster/issues)
- **Email**: support@socialposter.app
- **Discord**: [Community Discord](https://discord.gg/socialposter)

---

Built for content creators and marketers worldwide.

class SocialPosterApp {
  constructor() {
    this.pageData = null;
    this.generatedPosts = [];
    this.currentTab = 'home';
    this.userSettings = {};
    this.recentUrls = [];
    this.aiService = null; // Will be initialized with HF token
    this.init();
  }

  async init() {
    await this.loadUserSettings();
    await this.loadRecentUrls();
    this.setupEventListeners();
    this.setupTabNavigation();
    this.renderRecentUrls();
    
    // Auto-fill current page URL
    this.autoFillCurrentPage();
  }

  async loadUserSettings() {
    try {
      const result = await chrome.storage.sync.get(['userSettings']);
      this.userSettings = result.userSettings || {
        brandColors: { primary: '#667eea', secondary: '#764ba2' },
        companyName: '',
        logo: null,
        template: 'professional',
        contentTone: 'professional',
        engagementFocus: 'viral',
        followPageTheme: false,
        autoSave: true,
        contentContext: 'found-interesting',
        customContext: ''
      };
      
      // AI is now backend-managed
      this.initializeAIService();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveUserSettings() {
    try {
      await chrome.storage.sync.set({ userSettings: this.userSettings });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async loadRecentUrls() {
    try {
      const result = await chrome.storage.local.get(['recentUrls']);
      this.recentUrls = result.recentUrls || [];
    } catch (error) {
      console.error('Error loading recent URLs:', error);
    }
  }

  async saveRecentUrl(url, title) {
    const urlData = { url, title, timestamp: Date.now() };
    this.recentUrls = [urlData, ...this.recentUrls.filter(item => item.url !== url)].slice(0, 5);
    
    try {
      await chrome.storage.local.set({ recentUrls: this.recentUrls });
      this.renderRecentUrls();
    } catch (error) {
      console.error('Error saving recent URL:', error);
    }
  }

  renderRecentUrls() {
    const container = document.getElementById('recent-urls');
    
    if (this.recentUrls.length === 0) {
      container.innerHTML = '<div class="text-sm text-gray-500 text-center py-2">No recent URLs</div>';
      return;
    }

    container.innerHTML = this.recentUrls.map(item => `
      <div class="recent-url-item flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer" data-url="${item.url}">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 truncate">${item.title || 'Untitled'}</div>
          <div class="text-xs text-gray-500 truncate">${new URL(item.url).hostname}</div>
        </div>
        <button class="use-url-btn text-xs text-primary-600 hover:text-primary-800 ml-2">Use</button>
      </div>
    `).join('');

    // Add event listeners for recent URLs
    container.querySelectorAll('.use-url-btn').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('url-input').value = this.recentUrls[index].url;
        this.analyzeUrl();
      });
    });
  }

  setupEventListeners() {
    // URL input and analysis
    document.getElementById('current-page-btn').addEventListener('click', () => this.useCurrentPage());
    document.getElementById('analyze-btn').addEventListener('click', () => this.analyzeUrl());
    document.getElementById('url-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.analyzeUrl();
    });

    // Generation and actions
    document.getElementById('generate-btn').addEventListener('click', () => this.generatePosts());
    document.getElementById('preview-btn').addEventListener('click', () => this.previewPosts());
    document.getElementById('retry-btn').addEventListener('click', () => this.analyzeUrl());

    // Platform selection
    document.querySelectorAll('input[name="platform"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updatePlatformUI());
    });

    // Template selection
    document.querySelectorAll('input[name="template"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.userSettings.template = e.target.value;
        this.saveUserSettings();
        this.updateTemplateUI();
      });
    });

    // Brand customization
    document.getElementById('primary-color').addEventListener('change', (e) => {
      this.userSettings.brandColors.primary = e.target.value;
      this.saveUserSettings();
    });

    document.getElementById('secondary-color').addEventListener('change', (e) => {
      this.userSettings.brandColors.secondary = e.target.value;
      this.saveUserSettings();
    });

    document.getElementById('company-name').addEventListener('input', (e) => {
      this.userSettings.companyName = e.target.value;
      this.saveUserSettings();
    });

    document.getElementById('auto-extract-colors').addEventListener('click', () => this.autoExtractColors());
    document.getElementById('save-brand-kit').addEventListener('click', () => this.saveBrandKit());

    // Content Quality Settings
    document.getElementById('content-tone').addEventListener('change', (e) => {
      this.userSettings.contentTone = e.target.value;
      this.saveUserSettings();
    });
    
    document.getElementById('engagement-focus').addEventListener('change', (e) => {
      this.userSettings.engagementFocus = e.target.value;
      this.saveUserSettings();
    });
    
    // Follow Page Theme
    document.getElementById('follow-page-theme').addEventListener('change', (e) => {
      this.userSettings.followPageTheme = e.target.checked;
      this.saveUserSettings();
      if (e.target.checked && this.pageData) {
        this.extractAndApplyPageTheme();
      }
    });
    
    // Auto-save
    document.getElementById('auto-save').addEventListener('change', (e) => {
      this.userSettings.autoSave = e.target.checked;
      this.saveUserSettings();
    });
    
    // Content Context
    document.querySelectorAll('input[name="content-context"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.userSettings.contentContext = e.target.value;
          this.saveUserSettings();
          this.toggleCustomContextSection(e.target.value === 'custom');
        }
      });
    });
    
    // Custom Context Textarea
    document.getElementById('custom-context-text').addEventListener('input', (e) => {
      this.userSettings.customContext = e.target.value;
      this.saveUserSettings();
      this.updateCustomContextCounter();
    });
    
    // Character counter for custom context
    this.updateCustomContextCounter();
    
    // Quick Actions
    document.getElementById('regenerate-all')?.addEventListener('click', () => this.regenerateAllPosts());
    document.getElementById('ai-refine')?.addEventListener('click', () => this.aiRefinePosts());
    document.getElementById('optimize-engagement')?.addEventListener('click', () => this.optimizeForEngagement());
    document.getElementById('schedule-posts')?.addEventListener('click', () => this.showScheduleModal());
    document.getElementById('share-link-btn')?.addEventListener('click', () => this.sharePostsLink());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        this.generatePosts();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.analyzeUrl();
      }
    });

    // Asset management
    document.getElementById('download-all-btn').addEventListener('click', () => this.downloadAll());
    document.getElementById('copy-all-btn').addEventListener('click', () => this.copyAllText());

    // Load saved settings into UI
    this.loadSettingsIntoUI();
  }

  loadSettingsIntoUI() {
    if (this.userSettings.brandColors) {
      document.getElementById('primary-color').value = this.userSettings.brandColors.primary;
      document.getElementById('secondary-color').value = this.userSettings.brandColors.secondary;
    }
    
    if (this.userSettings.companyName) {
      document.getElementById('company-name').value = this.userSettings.companyName;
    }

    if (this.userSettings.template) {
      document.querySelector(`input[name="template"][value="${this.userSettings.template}"]`).checked = true;
      this.updateTemplateUI();
    }

    // Load content quality settings
    if (this.userSettings.contentTone) {
      document.getElementById('content-tone').value = this.userSettings.contentTone;
    }
    
    if (this.userSettings.engagementFocus) {
      document.getElementById('engagement-focus').value = this.userSettings.engagementFocus;
    }
    
    if (this.userSettings.followPageTheme !== undefined) {
      document.getElementById('follow-page-theme').checked = this.userSettings.followPageTheme;
    }
    
    if (this.userSettings.autoSave !== undefined) {
      document.getElementById('auto-save').checked = this.userSettings.autoSave;
    }
    
    if (this.userSettings.contentContext) {
      const contextRadio = document.querySelector(`input[name="content-context"][value="${this.userSettings.contentContext}"]`);
      if (contextRadio) {
        contextRadio.checked = true;
        this.toggleCustomContextSection(this.userSettings.contentContext === 'custom');
      }
    }
    
    if (this.userSettings.customContext) {
      document.getElementById('custom-context-text').value = this.userSettings.customContext;
      this.updateCustomContextCounter();
    }
  }

  setupTabNavigation() {
    const tabs = ['home', 'style', 'assets'];
    
    tabs.forEach(tab => {
      document.getElementById(`tab-${tab}`).addEventListener('click', () => this.switchTab(tab));
    });
  }

  switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active', 'border-primary-500', 'text-primary-600');
      btn.classList.add('border-transparent', 'text-gray-500');
    });

    document.getElementById(`tab-${tab}`).classList.remove('border-transparent', 'text-gray-500');
    document.getElementById(`tab-${tab}`).classList.add('active', 'border-primary-500', 'text-primary-600');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    document.getElementById(`${tab}-content`).classList.remove('hidden');
    this.currentTab = tab;
  }

  async useCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      document.getElementById('url-input').value = tab.url;
      this.analyzeUrl();
    } catch (error) {
      console.error('Error getting current page:', error);
      this.showToast('Failed to get current page URL', 'error');
    }
  }

  async analyzeUrl() {
    const url = document.getElementById('url-input').value.trim();
    
    if (!url) {
      this.showToast('Please enter a URL', 'error');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.showToast('Please enter a valid URL', 'error');
      return;
    }

    this.showLoading();

    try {
      // Check if it's the current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url === url) {
        // Extract from current page
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPageData' });
        if (response.success) {
          this.handleExtractionSuccess(response.data, url);
        } else {
          throw new Error(response.error);
        }
      } else {
        // Analyze external URL using background script
        await this.analyzeExternalUrl(url);
      }
    } catch (error) {
      console.error('Error analyzing URL:', error);
      this.showError(error.message);
    }
  }

  handleExtractionSuccess(data, url) {
    this.pageData = data;
    this.displayPagePreview();
    this.showPageSections();
    this.saveRecentUrl(url, data.title);
    this.hideLoading();
    
    // Update the URL input if it was analyzed from elsewhere
    if (document.getElementById('url-input').value.trim() !== url) {
      document.getElementById('url-input').value = url;
    }
  }

  displayPagePreview() {
    if (!this.pageData) return;

    document.getElementById('page-title').textContent = this.pageData.title;
    document.getElementById('page-description').textContent = this.pageData.description;

    if (this.pageData.mainImage) {
      const imageElement = document.getElementById('main-image');
      const imageContainer = document.getElementById('page-image');
      imageElement.src = this.pageData.mainImage;
      imageContainer.classList.remove('hidden');
    }

    const pointsList = document.getElementById('points-list');
    pointsList.innerHTML = '';
    
    if (this.pageData.keyPoints && this.pageData.keyPoints.length > 0) {
      this.pageData.keyPoints.slice(0, 5).forEach(point => {
        const li = document.createElement('li');
        li.className = 'text-sm text-gray-600 pl-4 relative';
        li.innerHTML = `<span class="absolute left-0 text-primary-500">•</span>${point}`;
        pointsList.appendChild(li);
      });
    } else {
      pointsList.innerHTML = '<li class="text-sm text-gray-500">No key points extracted</li>';
    }
  }

  showPageSections() {
    document.getElementById('page-preview').classList.remove('hidden');
    document.getElementById('platform-selection').classList.remove('hidden');
    document.getElementById('home-actions').classList.remove('hidden');
    
    // Enable Assets tab
    document.getElementById('tab-assets').disabled = false;
    document.getElementById('tab-assets').classList.remove('text-gray-400');
  }

  updatePlatformUI() {
    document.querySelectorAll('input[name="platform"]').forEach(checkbox => {
      const label = checkbox.closest('label');
      if (checkbox.checked) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  updateTemplateUI() {
    document.querySelectorAll('input[name="template"]').forEach(radio => {
      const label = radio.closest('label');
      if (radio.checked) {
        label.classList.add('active');
      } else {
        label.classList.remove('active');
      }
    });
  }

  getSelectedPlatforms() {
    const checkboxes = document.querySelectorAll('input[name="platform"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  getSelectedTemplate() {
    const radio = document.querySelector('input[name="template"]:checked');
    return radio ? radio.value : this.userSettings.template || 'professional';
  }

  async generatePosts() {
    const selectedPlatforms = this.getSelectedPlatforms();
    const selectedTemplate = this.getSelectedTemplate();

    if (selectedPlatforms.length === 0) {
      this.showToast('Please select at least one platform', 'error');
      return;
    }

    if (!this.pageData) {
      this.showToast('Please analyze a webpage first', 'error');
      return;
    }

    this.showLoading();

    try {
      // Always try AI generation first (backend-managed)
      await this.generatePostsWithAI();
      
      this.switchTab('assets');
      this.hideLoading();
      this.showToast(`Generated ${this.generatedPosts.length} posts successfully!`);

    } catch (error) {
      console.error('Error generating posts:', error);
      this.showError('Failed to generate posts');
    }
  }

  createPostForPlatform(platform, template) {
    const generators = {
      linkedin: () => this.generateLinkedInPost(template),
      twitter: () => this.generateTwitterPost(template),
      instagram: () => this.generateInstagramPost(template),
      facebook: () => this.generateFacebookPost(template)
    };

    return {
      platform,
      type: this.getPlatformType(platform),
      content: generators[platform](),
      template,
      timestamp: Date.now()
    };
  }

  getPlatformType(platform) {
    const types = {
      linkedin: 'Carousel',
      twitter: 'Thread',
      instagram: 'Story',
      facebook: 'Post'
    };
    return types[platform] || 'Post';
  }

  generateLinkedInPost(template) {
    const { title, keyPoints, url, description } = this.pageData;
    const company = this.userSettings.companyName;
    
    // Smart hashtag generation based on content
    const hashtags = this.generateSmartHashtags(title + ' ' + description);
    
    const templates = {
      professional: () => {
        // Create a compelling hook
        const hook = this.createHook(title, description);
        const points = keyPoints.slice(0, 5).map((point, i) => `${i + 1}️⃣ ${point}`).join('\n\n');
        
        return `${hook}

Here's what you need to know:

${points}

${this.createEngagementCTA()}

${hashtags}${company ? `\n\nShared by ${company}` : ''}

Full insights → ${url}`;
      },
      modern: () => {
        const points = keyPoints.slice(0, 4).map(point => `✨ ${point}`).join('\n\n');
        return `⚡ ${title}

${points}

💭 Which point resonates most with you?

Drop a comment and let's discuss! 🔥

${url}${company ? `\n\n🏢 ${company}` : ''}`;
      },
      minimal: () => {
        return `${title}

${keyPoints.slice(0, 3).join('\n\n')}

${url}${company ? `\n\n— ${company}` : ''}`;
      }
    };

    return templates[template]();
  }

  generateTwitterPost(template) {
    const { title, keyPoints, url } = this.pageData;
    const company = this.userSettings.companyName;
    
    const templates = {
      professional: () => {
        const thread = [`🧵 ${title} - Key insights:\n\n1/`];
        keyPoints.slice(0, 4).forEach((point, i) => {
          thread.push(`${i + 2}/ ${point}`);
        });
        thread.push(`${keyPoints.length + 2}/ Read the full article: ${url}${company ? `\n\nvia @${company.replace(/\s/g, '')}` : ''}`);
        return thread.join('\n\n');
      },
      modern: () => {
        const thread = [`🔥 ${title}\n\nA thread 👇\n\n1/`];
        keyPoints.slice(0, 4).forEach((point, i) => {
          thread.push(`${i + 2}/ ⚡ ${point}`);
        });
        thread.push(`${keyPoints.length + 2}/ 🔗 ${url}\n\nRT if this was helpful! 🙏${company ? `\n\n— ${company}` : ''}`);
        return thread.join('\n\n');
      },
      minimal: () => {
        return `${title}\n\n${keyPoints.slice(0, 2).join('\n\n')}\n\n${url}${company ? `\n\n— ${company}` : ''}`;
      }
    };

    return templates[template]();
  }

  generateInstagramPost(template) {
    const { title, keyPoints } = this.pageData;
    const company = this.userSettings.companyName;
    
    const templates = {
      professional: () => {
        const points = keyPoints.slice(0, 4).map(point => `• ${point}`).join('\n');
        return `${title}

${points}

What do you think? 💭

#business #innovation #growth #entrepreneurship #success${company ? ` #${company.replace(/\s/g, '').toLowerCase()}` : ''}`;
      },
      modern: () => {
        const points = keyPoints.slice(0, 3).map(point => `✨ ${point}`).join('\n\n');
        return `🚀 ${title}

${points}

Double tap if you agree! ❤️

#trending #viral #business #success #motivation${company ? ` #${company.replace(/\s/g, '').toLowerCase()}` : ''}`;
      },
      minimal: () => {
        return `${title}

${keyPoints[0]}

#minimal #clean #business${company ? ` #${company.replace(/\s/g, '').toLowerCase()}` : ''}`;
      }
    };

    return templates[template]();
  }

  generateFacebookPost(template) {
    const { title, description, keyPoints, url } = this.pageData;
    const company = this.userSettings.companyName;
    
    const templates = {
      professional: () => {
        const points = keyPoints.slice(0, 3).map(point => `• ${point}`).join('\n');
        return `${title}

${description}

Key takeaways:
${points}

Read more: ${url}

What are your thoughts? Let me know in the comments! 👇${company ? `\n\nShared by ${company}` : ''}`;
      },
      modern: () => {
        return `🔥 ${title}

${description}

💡 ${keyPoints.slice(0, 2).join('\n💡 ')}

Check it out: ${url}

Tag someone who needs to see this! 👇${company ? `\n\n🏢 ${company}` : ''}`;
      },
      minimal: () => {
        return `${title}

${description}

${url}${company ? `\n\n— ${company}` : ''}`;
      }
    };

    return templates[template]();
  }

  displayGeneratedPosts() {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';

    this.generatedPosts.forEach((post, index) => {
      const postElement = this.createPostElement(post, index);
      container.appendChild(postElement);
    });
    
    // Update stats
    this.updatePostStats();
    
    // Auto-save if enabled
    if (this.userSettings.autoSave) {
      this.autoSavePosts();
    }
  }

  createPostElement(post, index) {
    const wordCount = this.getWordCount(post.content);
    const charCount = post.content.length;
    const characterLimit = this.getCharacterLimit(post.platform);
    const qualityScore = this.calculateQualityScore(post);
    const progressPercentage = Math.min((charCount / characterLimit) * 100, 100);
    const progressClass = progressPercentage < 70 ? 'safe' : progressPercentage < 90 ? 'warning' : 'danger';
    
    const div = document.createElement('div');
    div.className = 'post-preview bg-gray-50 border border-gray-200 rounded-lg p-4';
    div.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-lg">${this.getPlatformIcon(post.platform)}</span>
          <span class="font-medium text-gray-900">${this.capitalizeFirst(post.platform)}</span>
          <span class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">${post.type}</span>
          <span class="quality-score ${qualityScore.class}">${qualityScore.label}</span>
        </div>
        <div class="engagement-indicator ${this.getEngagementLevel(post)} pulse-dot"></div>
      </div>
      
      <div class="text-sm text-gray-700 whitespace-pre-wrap mb-3 max-h-32 overflow-y-auto">${post.content}</div>
      
      <div class="mb-3">
        <div class="flex justify-between items-center text-xs text-gray-500 mb-1">
          <span class="word-count ${charCount > characterLimit ? 'over-limit' : charCount > characterLimit * 0.9 ? 'near-limit' : ''}">
            ${wordCount} words • ${charCount}/${characterLimit} chars
          </span>
          <span class="${charCount > characterLimit ? 'text-red-600' : charCount > characterLimit * 0.9 ? 'text-yellow-600' : 'text-green-600'}">
            ${Math.round(progressPercentage)}%
          </span>
        </div>
        <div class="character-progress">
          <div class="character-progress-bar ${progressClass}" style="width: ${progressPercentage}%"></div>
        </div>
      </div>
      
      <div class="flex gap-2">
        <button class="copy-btn flex-1 px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm font-medium" data-index="${index}">
          📋 Copy
        </button>
        <button class="edit-btn px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm" data-index="${index}">
          ✏️ Edit
        </button>
        <button class="download-btn px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm" data-index="${index}">
          📥 Save
        </button>
      </div>
    `;

    div.querySelector('.copy-btn').addEventListener('click', () => this.copyPost(index));
    div.querySelector('.edit-btn').addEventListener('click', () => this.editPost(index));
    div.querySelector('.download-btn').addEventListener('click', () => this.downloadPost(index));

    return div;
  }

  getPlatformIcon(platform) {
    const icons = {
      linkedin: '💼',
      twitter: '🐦',
      instagram: '📸',
      facebook: '👥'
    };
    return icons[platform] || '📱';
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async copyPost(index) {
    const post = this.generatedPosts[index];
    try {
      await navigator.clipboard.writeText(post.content);
      this.showToast('Post copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showToast('Copy failed', 'error');
    }
  }

  downloadPost(index) {
    const post = this.generatedPosts[index];
    const filename = `${post.platform}_post_${Date.now()}.txt`;
    this.downloadText(post.content, filename);
  }

  async copyAllText() {
    const allText = this.generatedPosts
      .map(post => `${post.platform.toUpperCase()}:\n${post.content}`)
      .join('\n\n---\n\n');
    
    try {
      await navigator.clipboard.writeText(allText);
      this.showToast('All posts copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showToast('Copy failed', 'error');
    }
  }

  downloadAll() {
    const allText = this.generatedPosts
      .map(post => `${post.platform.toUpperCase()}:\n${post.content}`)
      .join('\n\n---\n\n');
    
    const filename = `social_posts_${Date.now()}.txt`;
    this.downloadText(allText, filename);
  }

  downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async autoExtractColors() {
    if (!this.pageData || !this.pageData.brandColors) {
      this.showToast('No brand colors found on this page', 'error');
      return;
    }

    const colors = this.pageData.brandColors.filter(color => color && color !== '#000000');
    if (colors.length >= 2) {
      document.getElementById('primary-color').value = colors[0];
      document.getElementById('secondary-color').value = colors[1];
      
      this.userSettings.brandColors.primary = colors[0];
      this.userSettings.brandColors.secondary = colors[1];
      await this.saveUserSettings();
      
      this.showToast('Brand colors extracted successfully!');
    } else {
      this.showToast('Could not extract enough brand colors', 'error');
    }
  }

  async saveBrandKit() {
    await this.saveUserSettings();
    this.showToast('Brand kit saved successfully!');
  }

  previewPosts() {
    this.generatePosts();
  }

  autoFillCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
        document.getElementById('url-input').value = tabs[0].url;
      }
    });
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    
    // Update analyze button
    const btnText = document.getElementById('analyze-btn-text');
    const btnSpinner = document.getElementById('analyze-spinner');
    if (btnText && btnSpinner) {
      btnText.classList.add('hidden');
      btnSpinner.classList.remove('hidden');
    }
  }

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
    
    // Reset analyze button
    const btnText = document.getElementById('analyze-btn-text');
    const btnSpinner = document.getElementById('analyze-spinner');
    if (btnText && btnSpinner) {
      btnText.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
    }
  }

  showError(message = 'An error occurred') {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.querySelector('#error p').textContent = `❌ ${message}`;
    
    // Reset analyze button
    const btnText = document.getElementById('analyze-btn-text');
    const btnSpinner = document.getElementById('analyze-spinner');
    if (btnText && btnSpinner) {
      btnText.classList.remove('hidden');
      btnSpinner.classList.add('hidden');
    }
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform translate-x-full`;
    if (type === 'error') {
      toast.className += ' bg-red-100 text-red-800 border border-red-200';
    } else if (type === 'info') {
      toast.className += ' bg-blue-100 text-blue-800 border border-blue-200';
    } else {
      toast.className += ' bg-green-100 text-green-800 border border-green-200';
    }
    
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Enhanced content generation methods
  createHook(title, description) {
    // Generate compelling hooks based on content patterns
    const patterns = [
      { match: /how to|guide|tutorial/i, template: (t) => `Here's exactly how to ${t.toLowerCase().replace(/how to|guide|tutorial/gi, '').trim()}:` },
      { match: /\d+|number|tips|ways/i, template: (t) => t },
      { match: /why|reason/i, template: (t) => `The real reason ${t.toLowerCase().replace(/why/gi, '').trim()}` },
      { match: /build|create|make/i, template: (t) => `I ${t.toLowerCase()} (and you can too)` },
      { match: /first|beginner/i, template: (t) => `From zero to ${t.toLowerCase().replace(/first|beginner/gi, 'expert').trim()}` }
    ];

    for (const pattern of patterns) {
      if (pattern.match.test(title)) {
        return pattern.template(title);
      }
    }

    // Default hook if no pattern matches
    return `💡 ${title}`;
  }

  generateSmartHashtags(content) {
    const commonWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'it', 'from', 'be', 'are', 'been', 'was', 'were', 'being']);
    
    // Extract tech/business keywords
    const techKeywords = content.match(/\b(AI|ML|API|CSS|HTML|JavaScript|Python|React|Node|Data|Analytics|Cloud|DevOps|Blockchain|Web3|SaaS|Startup|Tech|Digital|Innovation|Machine Learning|Neural Network|Deep Learning|Artificial Intelligence)\b/gi) || [];
    
    // Extract potential hashtags from content
    const words = content.toLowerCase().split(/\s+/)
      .filter(word => word.length > 4 && !commonWords.has(word))
      .map(word => word.replace(/[^a-z0-9]/g, ''));
    
    // Combine and create hashtags
    const hashtags = new Set();
    
    // Add tech keywords as hashtags
    techKeywords.forEach(keyword => {
      hashtags.add('#' + keyword.replace(/\s+/g, ''));
    });
    
    // Add topic-specific hashtags
    if (content.match(/tutorial|guide|how\s+to/i)) {
      hashtags.add('#Tutorial');
      hashtags.add('#Learning');
    }
    
    if (content.match(/beginner|first|start/i)) {
      hashtags.add('#BeginnerFriendly');
      hashtags.add('#TechEducation');
    }
    
    if (content.match(/build|create|develop/i)) {
      hashtags.add('#BuildInPublic');
      hashtags.add('#Development');
    }

    // Limit to 5-7 most relevant hashtags
    return Array.from(hashtags).slice(0, 7).join(' ');
  }

  createEngagementCTA() {
    const ctas = [
      "What's your experience with this? Share below 👇",
      "Have you tried this approach? Let me know!",
      "What would you add to this list?",
      "Drop a 💡 if this helped you!",
      "Tag someone who needs to see this 👥",
      "What's your biggest takeaway from this?",
      "Save this for later! Which point resonates most?",
      "Your thoughts? I read every comment 💬"
    ];
    
    return ctas[Math.floor(Math.random() * ctas.length)];
  }

  // Initialize AI Service (Backend-managed)
  initializeAIService() {
    this.aiService = {
      generateContent: async (prompt, platform, style) => {
        try {
          // Call backend API instead of direct HuggingFace
          const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt,
              platform,
              style,
              tone: this.userSettings.contentTone,
              focus: this.userSettings.engagementFocus,
              context: this.userSettings.contentContext,
              customContext: this.userSettings.customContext
            })
          });

          if (!response.ok) {
            throw new Error('AI generation failed');
          }

          const data = await response.json();
          return data.content;

        } catch (error) {
          console.error('AI Error:', error);
          // Fallback to enhanced template generation
          return null;
        }
      }
    };
  }

  getModelForPlatform(platform) {
    const models = {
      linkedin: 'moonshotai/Kimi-K2-Instruct',
      twitter: 'meta-llama/Llama-3.2-3B-Instruct',
      instagram: 'moonshotai/Kimi-K2-Instruct',
      facebook: 'meta-llama/Llama-3.2-3B-Instruct'
    };
    return models[platform] || 'meta-llama/Llama-3.2-3B-Instruct';
  }

  getAISystemPrompt(platform, style) {
    const prompts = {
      linkedin: {
        professional: `You are a viral LinkedIn content strategist. Create posts that get 1000+ likes. Rules:
- Start with a BOLD hook that creates curiosity or controversy
- Tell a story with specific numbers, timeframes, and results
- Use "Here's what I learned:" or "Here's how:" format
- Include 5-7 strategic hashtags mixing popular + niche
- End with a question that sparks debate
- Keep under 1300 characters
- Focus on business value and actionable insights`,
        
        modern: `You are a LinkedIn influencer with 100K+ followers. Create viral content that gets saved and shared:
- Hook with personal failure/success story
- Use "I used to think X, but then Y happened" format
- Include specific metrics and timeframes
- Short paragraphs with strategic line breaks
- End with "What's your experience with this?"
- Add trending hashtags`
      },
      
      twitter: {
        professional: `You are a Twitter growth expert. Create threads that get 1000+ retweets:
- Hook: "I analyzed X and found Y surprising insights"
- Use thread format: 1/10, 2/10, etc.
- Each tweet under 250 characters for easy reading
- Include actionable tips people can use immediately
- End with "RT if this was helpful + follow for more"
- Add relevant hashtags sparingly`,
        
        modern: `You are a viral Twitter personality. Create controversial threads:
- Start with contrarian take: "Everyone's wrong about X"
- Use conversational language with personality
- Include hot takes and bold statements
- Strategic emoji use for emphasis
- End with "Am I wrong? Tell me why in replies"
- Make it quotable and memeable`
      },
      
      instagram: {
        professional: `You are an Instagram growth expert. Create captions that get saved:
- Hook with benefit promise: "Save this if you want to X"
- Value-packed content with actionable tips
- Use line breaks for easy mobile reading
- Include story elements and personal touch
- Add 25-30 strategic hashtags (mix of popular/niche)
- End with "Follow @username for more tips like this"`
      },
      
      facebook: {
        professional: `You are a Facebook engagement specialist. Create posts that get shared:
- Start with relatable story or scenario
- Build emotional connection with audience
- Include practical value people can use
- Ask engaging questions to drive comments
- Use conversational, friendly tone
- End with clear call-to-action`
      }
    };
    
    return prompts[platform]?.[style] || prompts.linkedin.professional;
  }

  // Enhanced post generation with AI
  async generatePostsWithAI() {
    const selectedPlatforms = this.getSelectedPlatforms();
    const selectedTemplate = this.getSelectedTemplate();

    if (!this.pageData) return;

    this.generatedPosts = [];

    for (const platform of selectedPlatforms) {
      let content;
      
      // Try AI generation first (backend-managed)
      if (this.aiService) {
        const prompt = this.createAIPrompt(platform);
        content = await this.aiService.generateContent(prompt, platform, selectedTemplate);
      }
      
      // Fallback to enhanced template generation
      if (!content) {
        content = this.createPostForPlatform(platform, selectedTemplate).content;
      }

      this.generatedPosts.push({
        platform,
        type: this.getPlatformType(platform),
        content,
        template: selectedTemplate,
        timestamp: Date.now(),
        isAIGenerated: !!content,
        wordCount: this.getWordCount(content),
        characterCount: content.length,
        qualityScore: this.calculateQualityScore({ content, platform })
      });
    }

    this.displayGeneratedPosts();
  }

  createAIPrompt(platform) {
    const { title, description, keyPoints, url } = this.pageData;
    const context = this.userSettings.contentContext || 'found-interesting';
    
    // Extract specific details for better AI generation
    const numbers = (title + ' ' + description).match(/\d+[\d,.]*/g) || [];
    const actions = (title + ' ' + description).match(/\b(build|create|learn|implement|achieve|get|increase|improve|optimize)\w*\b/gi) || [];
    const topics = this.extractTopics(title, description);
    
    let contextInfo;
    if (context === 'custom' && this.userSettings.customContext) {
      contextInfo = {
        relationship: 'Personal story/context provided by user',
        approach: this.userSettings.customContext,
        angle: 'Highly personalized perspective',
        hookStyle: 'Create a hook based on the personal context provided',
        contentFocus: 'Focus on the personal story and unique perspective shared',
        urgencyStyle: 'Create urgency that aligns with the personal motivation',
        ctaStyle: 'Create a CTA that connects to the personal experience',
        toneInstruction: `Write authentically based on this personal context: "${this.userSettings.customContext}"`
      };
    } else {
      contextInfo = this.getDetailedContext(context);
    }
    
    const personalContext = context === 'custom' && this.userSettings.customContext 
      ? `\n\nPERSONAL CONTEXT (Use this to make the post highly personalized):\n"${this.userSettings.customContext}"\n\nIMPORTANT: Base your entire post on this personal context. Make it sound authentic and personal.`
      : '';
    
    return `Content Topic: "${title}"

Content Description: ${description}${personalContext}

Your Relationship to Content: ${contextInfo.relationship}
Content Approach: ${contextInfo.approach}
Personal Angle: ${contextInfo.angle}

Specific Details to Highlight:
- Key insights: ${keyPoints.slice(0, 3).join(' | ')}
- Important numbers/metrics: ${numbers.join(', ') || 'None mentioned'}
- Action words: ${actions.join(', ') || 'General advice'}
- Main topics: ${topics.join(', ')}

Create a ${platform} post that:
1. ${contextInfo.hookStyle}
2. Uses concrete examples and numbers when available
3. ${contextInfo.contentFocus}
4. Includes relevant hashtags for ${topics.join(' and ')} 
5. ${contextInfo.urgencyStyle}
6. ${contextInfo.ctaStyle}

${contextInfo.toneInstruction}
Include the URL: ${url}
${this.userSettings.companyName ? `Author/Company: ${this.userSettings.companyName}` : ''}`;
  }

  extractTopics(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    const topics = new Set();
    
    // Tech/Business topics
    const techTopics = {
      'ai|artificial intelligence|machine learning|neural network': 'AI',
      'web dev|website|javascript|react|html|css': 'WebDev', 
      'startup|business|entrepreneur|revenue': 'Business',
      'marketing|social media|content|seo': 'Marketing',
      'productivity|efficiency|automation': 'Productivity',
      'data|analytics|statistics': 'Data',
      'design|ui|ux|interface': 'Design',
      'career|job|interview|salary': 'Career'
    };
    
    for (const [pattern, topic] of Object.entries(techTopics)) {
      if (new RegExp(pattern).test(text)) {
        topics.add(topic);
      }
    }
    
    return Array.from(topics).slice(0, 3);
  }

  // Extract and apply page theme colors
  async extractAndApplyPageTheme() {
    if (!this.pageData || !this.pageData.brandColors) return;
    
    const colors = this.pageData.brandColors.filter(color => color && color !== '#000000');
    if (colors.length >= 2) {
      this.userSettings.brandColors.primary = colors[0];
      this.userSettings.brandColors.secondary = colors[1];
      
      // Update UI
      document.getElementById('primary-color').value = colors[0];
      document.getElementById('secondary-color').value = colors[1];
      
      await this.saveUserSettings();
      this.showToast('Page theme applied successfully!');
    }
  }
  
  // New UX helper methods
  getWordCount(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  getCharacterLimit(platform) {
    const limits = {
      linkedin: 1300,
      twitter: 280,
      instagram: 2200,
      facebook: 63206
    };
    return limits[platform] || 1000;
  }
  
  calculateQualityScore(post) {
    const content = post.content || '';
    const platform = post.platform || 'linkedin';
    
    let score = 0;
    
    // Length score
    const charLimit = this.getCharacterLimit(platform);
    const lengthRatio = content.length / charLimit;
    if (lengthRatio > 0.3 && lengthRatio < 0.9) score += 25;
    
    // Engagement indicators
    if (/[?!]/.test(content)) score += 20; // Questions/exclamations
    if (/#\w+/.test(content)) score += 15; // Hashtags
    if (/\d+/.test(content)) score += 10; // Numbers
    if (/[📈📊💡🚀⚡🔥✨]/.test(content)) score += 10; // Engaging emojis
    
    // Structure score
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 2) score += 20; // Good structure
    
    if (score >= 80) return { class: 'excellent', label: 'Excellent' };
    if (score >= 60) return { class: 'good', label: 'Good' };
    if (score >= 40) return { class: 'average', label: 'Average' };
    return { class: 'poor', label: 'Needs Work' };
  }
  
  getEngagementLevel(post) {
    const score = this.calculateQualityScore(post);
    if (score.class === 'excellent' || score.class === 'good') return 'high';
    if (score.class === 'average') return 'medium';
    return 'low';
  }
  
  updatePostStats() {
    const totalPosts = this.generatedPosts.length;
    const totalWords = this.generatedPosts.reduce((sum, post) => sum + (post.wordCount || 0), 0);
    
    document.getElementById('total-posts-count').textContent = `${totalPosts} ${totalPosts === 1 ? 'post' : 'posts'}`;
    document.getElementById('total-word-count').textContent = `${totalWords} words`;
  }
  
  autoSavePosts() {
    try {
      localStorage.setItem('social-poster-draft', JSON.stringify({
        posts: this.generatedPosts,
        pageData: this.pageData,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }
  
  // New action methods
  editPost(index) {
    const post = this.generatedPosts[index];
    const newContent = prompt('Edit your post:', post.content);
    
    if (newContent && newContent !== post.content) {
      this.generatedPosts[index].content = newContent;
      this.generatedPosts[index].wordCount = this.getWordCount(newContent);
      this.generatedPosts[index].characterCount = newContent.length;
      this.generatedPosts[index].qualityScore = this.calculateQualityScore({ content: newContent, platform: post.platform });
      
      this.displayGeneratedPosts();
      this.showToast('Post updated successfully!');
    }
  }
  
  async regenerateAllPosts() {
    this.showToast('Regenerating all posts...');
    await this.generatePosts();
  }
  
  async optimizeForEngagement() {
    this.userSettings.engagementFocus = 'viral';
    this.showToast('Optimizing for maximum engagement...');
    await this.generatePosts();
  }
  
  showScheduleModal() {
    this.showToast('Scheduling feature coming soon!', 'info');
  }
  
  async analyzeExternalUrl(url) {
    try {
      this.showToast('Analyzing external URL...', 'info');
      
      // Try background script analysis first (hidden tab method)
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeExternalUrl',
        url: url
      });
      
      if (response.success) {
        this.handleExtractionSuccess(response.data, url);
        this.showToast('URL analyzed successfully! 🎉');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Background analysis failed:', error);
      
      // Fallback: Ask user if they want to open the page
      const userConfirmed = confirm(
        `Unable to analyze the URL directly.\n\nWould you like to open "${new URL(url).hostname}" in a new tab for analysis?\n\nThis will allow the extension to extract content from the page.`
      );
      
      if (userConfirmed) {
        await this.createTabAndAnalyze(url);
      } else {
        this.hideLoading();
        this.showToast('Analysis cancelled', 'error');
      }
    }
  }
  
  async createTabAndAnalyze(url) {
    try {
      this.showToast('Opening page for analysis...', 'info');
      
      const response = await chrome.runtime.sendMessage({
        action: 'createTabAndAnalyze',
        url: url
      });
      
      if (response.success) {
        this.handleExtractionSuccess(response.data, url);
        this.showToast('Page analyzed successfully! 🎉');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Tab creation analysis failed:', error);
      this.showError(`Failed to analyze page: ${error.message}`);
    }
  }
  
  sharePostsLink() {
    const shareData = {
      posts: this.generatedPosts.map(p => ({ platform: p.platform, content: p.content })),
      url: this.pageData?.url
    };
    
    const shareUrl = `${window.location.origin}/share?data=${encodeURIComponent(JSON.stringify(shareData))}`;
    
    try {
      navigator.clipboard.writeText(shareUrl);
      this.showToast('Share link copied to clipboard!');
    } catch (error) {
      this.showToast('Failed to copy share link', 'error');
    }
  }
  
  // Context helper methods
  getContextInstructions(context) {
    const contexts = {
      'own-work': 'You are sharing your own original work (blog post, article, or content you created). Write with authority and ownership.',
      'completed-project': 'You are showcasing a project you just completed. Share your journey, challenges overcome, and results achieved.',
      'work-showcase': 'You are highlighting work you are proud of. Focus on the impact, skills demonstrated, and value created.',
      'found-interesting': 'You discovered this content and want to share valuable insights with your network. Curate and add your perspective.',
      'learning-resource': 'You are sharing something you learned from. Focus on takeaways, how it changed your thinking, and actionable insights.',
      'client-work': 'You are sharing work done for a client or in collaboration with a team. Highlight teamwork, results, and professional growth.'
    };
    
    return contexts[context] || contexts['found-interesting'];
  }
  
  getDetailedContext(context) {
    const details = {
      'own-work': {
        relationship: 'Author/Creator of this content',
        approach: 'Share insights from your creation process and the value it provides',
        angle: 'Expert sharing original insights and expertise',
        hookStyle: 'Start with "I just published/wrote/created..." or share a behind-the-scenes insight',
        contentFocus: 'Highlight the unique value and insights you provide in your content',
        urgencyStyle: 'Create urgency around the value readers will get from your content',
        ctaStyle: 'End with a question about readers\' experiences with the topic or invite them to read more',
        toneInstruction: 'Write with confidence and authority as the content creator. Share your expertise.'
      },
      'completed-project': {
        relationship: 'Project creator/lead who just completed this work',
        approach: 'Share the journey, challenges, solutions, and results',
        angle: 'Proud creator sharing accomplishments and lessons learned',
        hookStyle: 'Start with "Just wrapped up..." or "After X weeks/months of work..."',
        contentFocus: 'Focus on the transformation/results achieved and obstacles overcome',
        urgencyStyle: 'Share the excitement of completion and immediate applications',
        ctaStyle: 'Ask about others\' similar experiences or invite feedback on your approach',
        toneInstruction: 'Write with pride and accomplishment. Share specific challenges and how you solved them.'
      },
      'work-showcase': {
        relationship: 'Professional showcasing their expertise and capabilities',
        approach: 'Highlight the impact, skills, and value demonstrated',
        angle: 'Expert demonstrating professional capabilities',
        hookStyle: 'Start with the impact/results achieved or the challenge you solved',
        contentFocus: 'Emphasize the professional value, skills used, and business impact',
        urgencyStyle: 'Create FOMO around the results and methodologies',
        ctaStyle: 'Invite connections or discussions about similar challenges',
        toneInstruction: 'Write professionally but with personality. Demonstrate expertise without bragging.'
      },
      'found-interesting': {
        relationship: 'Curator sharing valuable content discovered',
        approach: 'Add your perspective and why this matters to your network',
        angle: 'Thoughtful curator providing valuable insights',
        hookStyle: 'Start with "Just came across this..." or "This completely changed how I think about..."',
        contentFocus: 'Focus on why this matters and how others can apply these insights',
        urgencyStyle: 'Create urgency around not missing these insights',
        ctaStyle: 'Ask what others think or if they\'ve had similar experiences',
        toneInstruction: 'Write as an insightful curator. Add your own perspective and make it relevant to your audience.'
      },
      'learning-resource': {
        relationship: 'Learner sharing valuable insights gained',
        approach: 'Focus on key takeaways and how they changed your thinking',
        angle: 'Continuous learner sharing growth and insights',
        hookStyle: 'Start with "This article/resource taught me..." or "My biggest takeaway from this..."',
        contentFocus: 'Highlight specific learnings and how to apply them',
        urgencyStyle: 'Create urgency around continuous learning and growth',
        ctaStyle: 'Ask others about their learning experiences or similar resources',
        toneInstruction: 'Write with curiosity and growth mindset. Show vulnerability in learning.'
      },
      'client-work': {
        relationship: 'Professional sharing collaborative work and team achievements',
        approach: 'Highlight teamwork, professional growth, and collective results',
        angle: 'Team player sharing collaborative success',
        hookStyle: 'Start with "Just completed an amazing project with..." or "Proud to share work we did for..."',
        contentFocus: 'Focus on collaboration, professional development, and client impact',
        urgencyStyle: 'Share excitement about teamwork and professional growth',
        ctaStyle: 'Invite others to share their collaboration experiences',
        toneInstruction: 'Write with gratitude for the team and client. Highlight collective achievements.'
      }
    };
    
    return details[context] || details['found-interesting'];
  }
  
  // Toggle custom context section visibility
  toggleCustomContextSection(show) {
    const section = document.getElementById('custom-context-section');
    if (show) {
      section.classList.remove('hidden');
      section.classList.add('animate-slide-in');
    } else {
      section.classList.add('hidden');
      section.classList.remove('animate-slide-in');
    }
  }
  
  // Update character counter for custom context
  updateCustomContextCounter() {
    const textarea = document.getElementById('custom-context-text');
    const counter = document.getElementById('custom-context-count');
    if (textarea && counter) {
      const current = textarea.value.length;
      const max = textarea.getAttribute('maxlength') || 300;
      counter.textContent = `${current}/${max}`;
      
      // Update counter color based on usage
      if (current > max * 0.9) {
        counter.className = 'text-xs text-red-500 font-mono font-medium';
      } else if (current > max * 0.7) {
        counter.className = 'text-xs text-yellow-500 font-mono font-medium';
      } else {
        counter.className = 'text-xs text-purple-500 font-mono';
      }
    }
  }
  
  // AI Refine functionality
  async aiRefinePosts() {
    if (this.generatedPosts.length === 0) {
      this.showToast('Generate posts first to refine them', 'error');
      return;
    }
    
    this.showToast('AI is refining your posts for maximum engagement...', 'info');
    
    // Temporarily change engagement focus to viral for refinement
    const originalFocus = this.userSettings.engagementFocus;
    this.userSettings.engagementFocus = 'viral';
    
    try {
      await this.generatePostsWithAI();
      this.showToast('Posts refined for maximum engagement! 🚀');
    } catch (error) {
      this.showToast('Failed to refine posts', 'error');
    } finally {
      // Restore original focus
      this.userSettings.engagementFocus = originalFocus;
    }
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  new SocialPosterApp();
});
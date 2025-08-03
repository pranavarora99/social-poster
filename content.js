class WebpageExtractor {
  constructor() {
    this.pageData = null;
  }

  extractPageData() {
    const data = {
      url: window.location.href,
      title: this.extractTitle(),
      description: this.extractDescription(),
      mainImage: this.extractMainImage(),
      images: this.extractAllImages(),
      keyPoints: this.extractKeyPoints(),
      brandColors: this.extractBrandColors(),
      logo: this.extractLogo(),
      metadata: this.extractMetadata(),
      content: this.extractMainContent()
    };

    this.pageData = data;
    return data;
  }

  extractTitle() {
    return document.querySelector('h1')?.innerText?.trim() ||
           document.querySelector('title')?.innerText?.trim() ||
           document.querySelector('meta[property="og:title"]')?.content ||
           'Untitled Page';
  }

  extractDescription() {
    return document.querySelector('meta[name="description"]')?.content ||
           document.querySelector('meta[property="og:description"]')?.content ||
           document.querySelector('p')?.innerText?.trim()?.substring(0, 200) ||
           '';
  }

  extractMainImage() {
    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    if (ogImage) return this.normalizeImageUrl(ogImage);

    const heroImage = document.querySelector('img[class*="hero"], img[class*="featured"], img[class*="banner"]');
    if (heroImage) return this.normalizeImageUrl(heroImage.src);

    const firstImage = document.querySelector('img');
    return firstImage ? this.normalizeImageUrl(firstImage.src) : null;
  }

  extractAllImages() {
    const images = Array.from(document.querySelectorAll('img'))
      .map(img => ({
        src: this.normalizeImageUrl(img.src),
        alt: img.alt || '',
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      }))
      .filter(img => img.width > 100 && img.height > 100)
      .slice(0, 10);

    return images;
  }

  extractKeyPoints() {
    const points = [];
    
    const headers = Array.from(document.querySelectorAll('h2, h3'))
      .map(h => h.innerText.trim())
      .filter(text => text.length > 10 && text.length < 100)
      .slice(0, 5);
    
    points.push(...headers);

    const listItems = Array.from(document.querySelectorAll('li'))
      .map(li => li.innerText.trim())
      .filter(text => text.length > 20 && text.length < 150)
      .slice(0, 3);
    
    points.push(...listItems);

    const strongText = Array.from(document.querySelectorAll('strong, b'))
      .map(el => el.innerText.trim())
      .filter(text => text.length > 10 && text.length < 100)
      .slice(0, 3);
    
    points.push(...strongText);

    return [...new Set(points)].slice(0, 8);
  }

  extractBrandColors() {
    const colors = new Set();
    
    const computedStyle = getComputedStyle(document.body);
    const bgColor = computedStyle.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
      colors.add(this.rgbToHex(bgColor));
    }

    const colorElements = document.querySelectorAll('[style*="color"], [style*="background"]');
    Array.from(colorElements).forEach(el => {
      const style = el.style;
      if (style.color) colors.add(this.rgbToHex(style.color));
      if (style.backgroundColor) colors.add(this.rgbToHex(style.backgroundColor));
    });

    const cssVars = Array.from(document.styleSheets)
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules);
        } catch (e) {
          return [];
        }
      })
      .filter(rule => rule.style && rule.selectorText === ':root')
      .flatMap(rule => Array.from(rule.style))
      .filter(prop => prop.startsWith('--') && prop.includes('color'))
      .map(prop => getComputedStyle(document.documentElement).getPropertyValue(prop).trim())
      .filter(value => value.startsWith('#') || value.startsWith('rgb'));

    cssVars.forEach(color => colors.add(this.rgbToHex(color)));

    return Array.from(colors).filter(color => color && color !== '#000000').slice(0, 5);
  }

  extractLogo() {
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[class*="logo" i]',
      'img[id*="logo" i]',
      '.logo img',
      '#logo img',
      'header img:first-of-type',
      '.navbar img:first-of-type'
    ];

    for (const selector of logoSelectors) {
      const logo = document.querySelector(selector);
      if (logo) {
        return {
          src: this.normalizeImageUrl(logo.src),
          alt: logo.alt || '',
          width: logo.naturalWidth || logo.width,
          height: logo.naturalHeight || logo.height
        };
      }
    }

    return null;
  }

  extractMetadata() {
    const metadata = {};
    
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(meta => {
      if (meta.name) {
        metadata[meta.name] = meta.content;
      }
      if (meta.property) {
        metadata[meta.property] = meta.content;
      }
    });

    return metadata;
  }

  extractMainContent() {
    const contentSelectors = [
      'article',
      '.content',
      '.post-content',
      '.entry-content',
      'main',
      '.main-content'
    ];

    for (const selector of contentSelectors) {
      const content = document.querySelector(selector);
      if (content) {
        return content.innerText.trim().substring(0, 1000);
      }
    }

    const paragraphs = Array.from(document.querySelectorAll('p'))
      .map(p => p.innerText.trim())
      .filter(text => text.length > 50)
      .slice(0, 5)
      .join(' ');

    return paragraphs.substring(0, 1000);
  }

  normalizeImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return window.location.origin + url;
    return new URL(url, window.location.href).href;
  }

  rgbToHex(rgb) {
    if (!rgb) return null;
    if (rgb.startsWith('#')) return rgb;
    
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;
    
    const [, r, g, b] = match;
    return '#' + [r, g, b].map(x => {
      const hex = parseInt(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}

let extractor = new WebpageExtractor();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPageData') {
    try {
      const data = extractor.extractPageData();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    extractor.extractPageData();
  });
} else {
  extractor.extractPageData();
}
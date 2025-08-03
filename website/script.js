// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar scroll effect
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Animation on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.feature-card, .step, .pricing-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Counter animation for stats
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    
    function updateCounter() {
        start += increment;
        if (start < target) {
            element.textContent = Math.floor(start).toLocaleString();
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target.toLocaleString();
        }
    }
    
    updateCounter();
}

// Animate stats when they come into view
const statsObserver = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const number = entry.target.querySelector('.stat-number');
            const text = number.textContent;
            
            if (text.includes('K+')) {
                const value = parseInt(text.replace('K+', ''));
                animateCounter(number, value * 1000);
            } else if (text.includes('min')) {
                // Skip animation for "5min"
            } else if (text.includes('★')) {
                // Skip animation for rating
            }
            
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat').forEach(stat => {
    statsObserver.observe(stat);
});

// Chrome Web Store link handler
document.querySelectorAll('a[href*="chrome.google.com/webstore"]').forEach(link => {
    link.addEventListener('click', function(e) {
        // Track click analytics here
        console.log('Chrome Web Store link clicked');
        
        // Show install instructions for non-Chrome browsers
        if (!navigator.userAgent.includes('Chrome')) {
            e.preventDefault();
            alert('This extension is currently only available for Google Chrome. Please open this page in Chrome to install.');
        }
    });
});

// Pricing card hover effects
document.querySelectorAll('.pricing-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Feature card interactions
document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', function() {
        // Add click interaction for feature cards
        this.style.background = '#f8fafc';
        setTimeout(() => {
            this.style.background = 'white';
        }, 200);
    });
});

// Mobile menu toggle (if needed)
function createMobileMenu() {
    const navbar = document.querySelector('.navbar .container');
    const navLinks = document.querySelector('.nav-links');
    
    if (window.innerWidth <= 768) {
        // Create mobile menu button if it doesn't exist
        if (!document.querySelector('.mobile-menu-btn')) {
            const menuBtn = document.createElement('button');
            menuBtn.className = 'mobile-menu-btn';
            menuBtn.innerHTML = '☰';
            menuBtn.style.cssText = `
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #4a5568;
            `;
            
            menuBtn.addEventListener('click', function() {
                navLinks.style.display = navLinks.style.display === 'none' ? 'flex' : 'none';
            });
            
            navbar.appendChild(menuBtn);
        }
        
        // Hide nav links by default on mobile
        navLinks.style.display = 'none';
    } else {
        // Show nav links on desktop
        navLinks.style.display = 'flex';
        
        // Remove mobile menu button if it exists
        const menuBtn = document.querySelector('.mobile-menu-btn');
        if (menuBtn) {
            menuBtn.remove();
        }
    }
}

// Handle window resize
window.addEventListener('resize', createMobileMenu);
createMobileMenu(); // Initial call

// Form validation (if contact forms are added)
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Newsletter signup (placeholder)
function handleNewsletterSignup(email) {
    if (validateEmail(email)) {
        // Send to your email service
        console.log('Newsletter signup:', email);
        return true;
    }
    return false;
}

// Add some Easter eggs for fun
let konami = [];
const konamiCode = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
];

document.addEventListener('keydown', function(e) {
    konami.push(e.code);
    konami = konami.slice(-konamiCode.length);
    
    if (konami.join('') === konamiCode.join('')) {
        // Easter egg activated
        document.body.style.transform = 'rotate(1deg)';
        setTimeout(() => {
            document.body.style.transform = 'rotate(0deg)';
        }, 500);
        
        console.log('🎉 Konami code activated! You found the Easter egg!');
    }
});

// Performance monitoring
window.addEventListener('load', function() {
    // Log page load time
    const loadTime = performance.now();
    console.log(`Page loaded in ${Math.round(loadTime)}ms`);
    
    // Preload critical images
    const criticalImages = [
        '/chrome-icon.svg'
    ];
    
    criticalImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });
});

// SEO and Analytics helpers
function trackPageView(page) {
    // Track with your analytics service
    console.log('Page view:', page);
}

function trackEvent(category, action, label) {
    // Track with your analytics service
    console.log('Event:', { category, action, label });
}

// Track initial page view
trackPageView(window.location.pathname);

// Track outbound links
document.querySelectorAll('a[href^="http"]').forEach(link => {
    link.addEventListener('click', function() {
        trackEvent('Outbound Link', 'Click', this.href);
    });
});

// Simple A/B testing framework
function getVariant(testName, variants) {
    const hash = hashCode(testName + navigator.userAgent);
    return variants[Math.abs(hash) % variants.length];
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
}

// Example A/B test for CTA button text
const ctaVariant = getVariant('cta-test', [
    'Install Free Extension',
    'Get Extension Free',
    'Add to Chrome Free',
    'Download Free Extension'
]);

// Update CTA buttons with variant
document.querySelectorAll('.btn-primary').forEach(btn => {
    if (btn.textContent.includes('Install') || btn.textContent.includes('Add to Chrome')) {
        btn.textContent = btn.textContent.replace(/Install.*Extension|Add to Chrome.*/, ctaVariant);
    }
});

console.log('🚀 Social Poster website loaded successfully!');
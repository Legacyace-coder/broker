const cfg = window.NORTHSTAR_CONFIG || {};
const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR_PROJECT') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('YOUR_PUBLIC');
let supabase = null;
let supabaseClientPromise = null;
let memberProfilePromise = null;

async function getSupabase() {
  if (!configured) throw new Error('Configure Supabase first.');
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('https://esm.sh/@supabase/supabase-js@2.49.1')
      .then(({ createClient }) => {
        supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        return supabase;
      })
      .catch(error => {
        supabaseClientPromise = null;
        throw new Error(`Could not load the authentication client: ${error.message}`);
      });
  }
  return supabaseClientPromise;
}

const isLocalFrontend = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = isLocalFrontend
  ? 'http://127.0.0.1:8000'
  : cfg.API_BASE_URL || 'https://broker-backend-delta.vercel.app';
const page = document.body.dataset.page || 'home';
const app = document.querySelector('#app');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v = '') => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const money = (v, asset = 'USDT') =>
  `${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${esc(asset)}`;

const paymentAssetLabel = asset => asset === 'ETH' ? 'Ethereum (ETH)' : asset;

const date = v => v ? new Date(v).toLocaleString() : '—';
const status = s => `<span class="badge ${esc(s || 'pending')}">${esc(s || 'pending')}</span>`;

const pageLinks = {
  home: 'index.html',
  about: 'pages/about.html',
  responsibility: 'pages/corporate-responsibility.html',
  'digital-assets': 'pages/digital-assets.html',
  'real-estate': 'pages/real-estate.html',
  agriculture: 'pages/agriculture.html',
  plans: 'pages/plans.html',
  faq: 'pages/faq.html',
  contact: 'pages/contact.html',
  login: 'pages/login.html',
  register: 'pages/register.html',
  'forgot-password': 'pages/forgot-password.html',
  terms: 'pages/terms.html'
};

const root = location.pathname.includes('/pages/') ||
  location.pathname.includes('/member/') ||
  location.pathname.includes('/admin/')
  ? '../'
  : '';



/* NORTHSTAR_FOUNDATION_V1 */
/* NORTHSTAR_THEME_SVG_FIX_V1 */
const THEME_KEY = 'northstar-theme';

function getThemePreference() {
  const saved = localStorage.getItem(THEME_KEY);
  return ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
}

function resolveTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function applyTheme(preference = getThemePreference()) {
  const selected = resolveTheme(preference);

  document.documentElement.dataset.theme = selected;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = selected;

  const toggle = document.querySelector('[data-theme-toggle]');

  if (toggle) {
    const labels = {
      system: 'System',
      light: 'Light',
      dark: 'Dark'
    };

    const icons = {
      light: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>
      </svg>`,
      dark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/>
        <path d="M16.5 3v3m-1.5-1.5h3"/>
      </svg>`,
      system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="13" rx="2"/>
        <path d="M8 21h8m-4-4v4"/>
      </svg>`
    };

    toggle.innerHTML = `
      <span class="theme-toggle-icon" aria-hidden="true">${icons[preference]}</span>
      <span class="theme-toggle-label">Theme: ${labels[preference]}</span>
    `;

    toggle.setAttribute(
      'aria-label',
      `Theme preference: ${labels[preference]}. Activate to change theme.`
    );
    toggle.setAttribute('aria-pressed', String(preference !== 'system'));
  }
}

function initTheme() {
  applyTheme(getThemePreference());

  const media = window.matchMedia('(prefers-color-scheme: light)');
  const updateSystemTheme = () => {
    if (getThemePreference() === 'system') {
      applyTheme('system');
    }
  };

  if (media.addEventListener) {
    media.addEventListener('change', updateSystemTheme);
  } else {
    media.addListener(updateSystemTheme);
  }
}

function bindThemeToggle() {
  const toggle = document.querySelector('[data-theme-toggle]');
  if (!toggle || toggle.dataset.bound === 'true') return;

  toggle.dataset.bound = 'true';

  toggle.addEventListener('click', () => {
    const current = getThemePreference();
    const next = {
      system: 'light',
      light: 'dark',
      dark: 'system'
    }[current];

    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}
/* END NORTHSTAR_FOUNDATION_V1 */


function nav() {
  const publicItems = [
    ['Home', 'index.html'],
    ['About', 'pages/about.html'],
    ['Responsibility', 'pages/corporate-responsibility.html'],
    ['Sectors', 'pages/digital-assets.html'],
    ['Plans', 'pages/plans.html'],
    ['FAQs', 'pages/faq.html'],
    ['Contact', 'pages/contact.html']
  ];

  const memberItems = [
    ['Dashboard', 'member/dashboard.html'],
    ['Deposit', 'member/new-deposit.html'],
    ['Withdraw', 'member/withdrawals.html'],
    ['Transactions', 'member/transactions.html'],
    ['Profile', 'member/profile.html']
  ];

  const isMember = page.startsWith('admin-') ||
    ['dashboard', 'new-deposit', 'deposit-history', 'investments',
      'withdrawals', 'transactions', 'partner-program', 'profile'].includes(page);

  const items = isMember ? memberItems : publicItems;
  const n = $('#main-nav');

  n.innerHTML = items.map(([t, p]) => {
    if (t === 'Sectors') {
      return `
        <div class="nav-dropdown">
          <button
            type="button"
            class="nav-dropdown-toggle"
            aria-haspopup="true"
            aria-expanded="false"
            aria-controls="sectors-dropdown-menu">
            <span>Sectors</span>
            <span class="nav-dropdown-chevron" aria-hidden="true">⌄</span>
          </button>
          <div class="nav-dropdown-menu" id="sectors-dropdown-menu">
            <a href="${root}pages/digital-assets.html">
              <span class="nav-dropdown-number">01</span>
              <span>Digital Assets</span>
            </a>
            <a href="${root}pages/real-estate.html">
              <span class="nav-dropdown-number">02</span>
              <span>Real Estate</span>
            </a>
            <a href="${root}pages/agriculture.html">
              <span class="nav-dropdown-number">03</span>
              <span>Agriculture</span>
            </a>
          </div>
        </div>`;
    }

    return `<a href="${root}${p}">${t}</a>`;
  }).join('') + (isMember
    ? `<a href="${root}index.html" data-logout>Sign out</a>`
    : `<a class="btn btn-outline" href="${root}pages/login.html">Login</a>
       <a class="btn btn-primary" href="${root}pages/register.html">Create account</a>`);
  n.insertAdjacentHTML('beforeend', `
    <button type="button" class="theme-toggle" data-theme-toggle
      aria-label="Switch colour theme" aria-pressed="false">
      <span class="theme-toggle-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="13" rx="2"/>
          <path d="M8 21h8m-4-4v4"/>
        </svg>
      </span>
      <span class="theme-toggle-label">Theme: System</span>
    </button>
  `);

  applyTheme(getThemePreference());

// NORTHSTAR_SECTORS_DROPDOWN_INTERACTIONS
  const sectorsDropdown = n.querySelector('.nav-dropdown');
  const sectorsToggle = n.querySelector('.nav-dropdown-toggle');

  if (sectorsDropdown && sectorsToggle) {
    const closeSectorsDropdown = () => {
      sectorsDropdown.classList.remove('is-open');
      sectorsToggle.setAttribute('aria-expanded', 'false');
    };

    sectorsToggle.addEventListener('click', event => {
      event.stopPropagation();

      const isOpen = sectorsDropdown.classList.toggle('is-open');
      sectorsToggle.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('pointerdown', event => {
      if (!sectorsDropdown.contains(event.target)) {
        closeSectorsDropdown();
      }
    });

    sectorsToggle.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeSectorsDropdown();
        sectorsToggle.focus();
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        sectorsDropdown.classList.add('is-open');
        sectorsToggle.setAttribute('aria-expanded', 'true');
        sectorsDropdown.querySelector('.nav-dropdown-menu a')?.focus();
      }
    });

    sectorsDropdown.querySelectorAll('.nav-dropdown-menu a').forEach(link => {
      link.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          closeSectorsDropdown();
          sectorsToggle.focus();
        }
      });
    });

    sectorsDropdown.querySelectorAll('.nav-dropdown-menu a').forEach(link => {
      link.addEventListener('click', () => {
        closeSectorsDropdown();
        n.classList.remove('open');
        $('.menu-toggle')?.setAttribute('aria-expanded', 'false');
      });
    });
  }
  bindThemeToggle();
  applyTheme(document.documentElement.dataset.theme);

  if (isMember && !page.startsWith('admin-')) {
    n.insertAdjacentHTML('beforeend', `<a class="nav-profile-avatar" href="${root}member/profile.html" data-profile-avatar aria-label="Open your profile"><span>U</span></a>`);
    loadNavProfileAvatar();
  }

  $('.menu-toggle')?.addEventListener('click', () => {
    const open = n.classList.toggle('open');
    $('.menu-toggle').setAttribute('aria-expanded', String(open));
  });

  $('.site-header')?.classList.toggle('scrolled', window.scrollY > 12);

  window.addEventListener('scroll', () => {
    $('.site-header')?.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  $('[data-logout]')?.addEventListener('click', async e => {
    e.preventDefault();
    if (supabase) await supabase.auth.signOut();
    location.href = '../pages/login.html';
  });
}

function footer() {
  document.querySelectorAll('[data-year]').forEach(n => {
    n.textContent = new Date().getFullYear();
  });
}

function loadOptionalFonts() {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.media = 'print';
  stylesheet.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap';
  stylesheet.onload = () => { stylesheet.media = 'all'; };
  document.head.append(stylesheet);
}

function bindPageTransitions() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.body.classList.add('page-entering');
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download') || link.hasAttribute('data-logout')) return;

    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin) return;
    if (destination.pathname === location.pathname && destination.search === location.search) return;

    event.preventDefault();
    document.body.classList.remove('page-entering');
    document.body.classList.add('page-leaving');
    window.setTimeout(() => { location.href = destination.href; }, 190);
  });
}

function initScrollReveals(root) {
  const targets = root.querySelectorAll([
    '.page-hero',
    '.home-sector-row',
    '.home-method-image',
    '.home-method-copy',
    '.home-principles-list > div',
    '.home-contact-content',
    '.image-feature',
    '.card-with-image',
    '.sector-image',
    '.dashboard-referral-summary',
    '.dashboard-panels > *'
  ].join(','));

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -36px 0px' });

  targets.forEach((element, index) => {
    element.classList.add('scroll-reveal');
    element.style.setProperty('--reveal-delay', `${Math.min(index % 5, 4) * 75}ms`);
    observer.observe(element);
  });
}

function notice(msg, kind = '') {
  return `<div class="status ${kind}" role="status">${esc(displayText(msg))}</div>`;
}

function displayText(value, fallback = '') {
  if (Array.isArray(value)) {
    return value.map(error => {
      const field = Array.isArray(error?.loc)
        ? error.loc.filter(part => part !== 'body').join('.')
        : '';
      const message = error?.msg || error?.message || JSON.stringify(error);
      return field ? `${field}: ${message}` : message;
    }).join('; ') || fallback;
  }

  let text = value;
  while (text && typeof text === 'object') {
    const nested = text.message ?? text.detail ?? text.error;
    if (nested === undefined) {
      text = JSON.stringify(text);
      break;
    }
    text = nested;
  }
  return text == null || text === '' ? fallback : String(text);
}

async function session() {
  if (!configured) return null;
  const client = await getSupabase();
  const { data } = await client.auth.getSession();
  return data.session || null;
}

function portalForRole(role) {
  return role === 'admin'
    ? '../admin/index.html'
    : role === 'member'
      ? '../member/dashboard.html'
      : null;
}

async function redirectForVerifiedRole({ signOutUnknown = false } = {}) {
  const client = await getSupabase();
  const { data: { session: activeSession } } = await client.auth.getSession();

  if (!activeSession?.access_token) return false;

  const roleData = await api('/api/auth/role');
  const target = portalForRole(roleData?.role);

  if (target) {
    location.replace(target);
    return true;
  }

  if (signOutUnknown) await client.auth.signOut();
  return false;
}

async function api(path, options = {}) {
  const s = await session();

  if (!s?.access_token) {
    throw new Error('Please sign in first.');
  }

  const headers = {
    'Authorization': `Bearer ${s.access_token}`,
    ...(options.headers || {})
  };

  if (
    !(options.body instanceof FormData) &&
    options.body !== undefined &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
  }

  let r;
  try {
    r = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Cannot reach the API. Check that it is online and allows requests from ${location.origin}.`);
  }

  let body = {};
  try {
    body = await r.json();
  } catch {}

  if (!r.ok) {
    const reason = body.detail ?? body.message;
    throw new Error(displayText(reason, 'Request failed'));
  }

  return body;
}

function getMemberProfile() {
  if (!memberProfilePromise) {
    memberProfilePromise = api('/api/me').catch(error => {
      memberProfilePromise = null;
      throw error;
    });
  }
  return memberProfilePromise;
}

function renderNavProfile(profile = {}) {
  const avatar = $('[data-profile-avatar]');
  if (!avatar) return;

  const name = profile.display_name || profile.full_name || profile.email || 'User';
  const imageUrl = typeof profile.profile_image_url === 'string' && /^https:\/\//i.test(profile.profile_image_url)
    ? profile.profile_image_url
    : null;

  avatar.innerHTML = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="Profile photo for ${esc(name)}">`
    : `<span>${esc(String(name).trim().slice(0, 1).toUpperCase())}</span>`;
  avatar.title = name;
}

async function loadNavProfileAvatar() {
  try {
    const result = await getMemberProfile();
    renderNavProfile(result.profile || {});
  } catch {
    $('[data-profile-avatar]')?.remove();
  }
}

function pageHero(kicker, title, sub, actions = '', variant = '') {
  return `<section class="page-hero${variant ? ` ${variant}` : ''}">
    <div class="container">
      <p class="eyebrow">${kicker}</p>
      <h1>${title}</h1>
      <p>${sub}</p>
      ${actions ? `<div class="hero-actions">${actions}</div>` : ''}
    </div>
  </section>`;
}

function cards(items, images = []) {
  return `<div class="grid grid-3">${items.map((x, i) =>
    `<article class="card${images[i] ? ' card-with-image' : ''}">
      ${images[i] ? `<img src="../assets/images/${encodeURIComponent(images[i].src).replace(/%2F/g, '/')}" alt="${esc(images[i].alt)}" loading="lazy">` : ''}
      <div class="${images[i] ? 'card-image-copy' : ''}">
        <div class="card-number">0${i + 1}</div>
        <h3>${x[0]}</h3>
        <p>${x[1]}</p>
      </div>
    </article>`
  ).join('')}</div>`;
}

function table(headers, rows) {
  if (!rows?.length) {
    return `<div class="empty-state">No records to display yet.</div>`;
  }

  return `<div class="table-wrap">
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  </div>`;
}

function rows(items, cols) {
  return table(
    cols.map(c => c[1]),
    items.map(item => `<tr>${cols.map(([key]) =>
      `<td>${
        key === 'status'
          ? status(item[key])
          : key === 'kind'
            ? esc(transactionLabel(item))
          : key === 'amount'
            ? money(item[key], item.asset)
            : key.endsWith('_at') || key === 'created_at'
              ? esc(date(item[key]))
              : esc(item[key] ?? '—')
      }</td>`
    ).join('')}</tr>`)
  );
}

function transactionLabel(item) {
  if (item.kind !== 'adjustment') return item.kind || 'transaction';

  const delta = String(item.reference || '').match(/(?:^|;\s*)delta=([+-]?(?:\d+(?:\.\d*)?|\.\d+))/i);
  if (!delta) return 'Balance update';

  const amount = Number(delta[1]);
  return amount > 0 ? 'Profit' : amount < 0 ? 'Balance decrease' : 'Balance update';
}

function placeholderImage(image, alt) {
  return `<figure class="image-placeholder image-feature">
    <img src="../assets/images/${encodeURIComponent(image).replace(/%2F/g, '/')}" alt="${esc(alt)}" loading="lazy">
  </figure>`;
}

function initHeroCarousel(root) {
  const hero = root.querySelector('.hero-home');
  if (!hero) return;

  const slides = Array.from(
    hero.querySelectorAll('[data-hero-slide]')
  );

  if (slides.length < 2) return;

  const counter = hero.querySelector('[data-hero-slide-counter]');

  // Keep the first image static when reduced motion is requested.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  let activeIndex = 0;

  window.setInterval(() => {
    // Avoid unnecessary image changes in background tabs.
    if (document.hidden) return;

    slides[activeIndex].classList.remove('is-active');

    activeIndex = (activeIndex + 1) % slides.length;

    slides[activeIndex].classList.add('is-active');

    if (counter) {
      const current = String(activeIndex + 1).padStart(2, '0');
      const total = String(slides.length).padStart(2, '0');

      counter.textContent = `${current} / ${total}`;
    }
  }, 10000);
}
function home() {
  return `<section class="hero hero-home">
    <div class="hero-home-slideshow" aria-hidden="true">
    <img class="hero-home-image is-active" src="assets/images/home page digital asset cta background.jpg" data-hero-slide alt="" />
    <img class="hero-home-image" src="assets/images/clear communication.jpg" data-hero-slide alt="" />
    <img class="hero-home-image" src="assets/images/company team hero background.jpg" data-hero-slide alt="" />
  </div>
    <div class="container hero-home-content">
      <p class="hero-home-kicker"><span>Independent perspective</span><span>Digital assets · Property · Agriculture</span></p>
      <h1>Northstar<br><span>Capital</span></h1>
      <p class="hero-home-intro">Research for decisions in changing markets.</p>
      <p class="hero-home-copy">A considered view of digital assets, real estate and agriculture, grounded in context, due diligence and a clear-eyed understanding of risk.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="pages/digital-assets.html">Explore our research</a>
        <a class="btn btn-outline" href="pages/about.html">Our approach <span aria-hidden="true">↗</span></a>
      </div>
      <div class="hero-home-foot"><span>Perspective before participation</span><span data-hero-slide-counter>01 / 07</span></div>
    </div>
  </section>

  <section class="home-sectors section">
    <div class="container">
      <div class="home-section-heading">
        <div><p class="eyebrow">Research areas</p><h2>Three markets.<br>One measured lens.</h2></div>
        <p>We look beyond the headline to understand structures, constraints and the forces that shape long-term outcomes.</p>
      </div>
      <div class="home-sector-list">
        <a class="home-sector-row" href="pages/digital-assets.html">
          <span class="home-sector-number">01</span>
          <img src="assets/images/digital assets.jpg" alt="Digital asset market infrastructure" loading="lazy">
          <span class="home-sector-copy"><span class="eyebrow">Infrastructure / custody / markets</span><strong>Digital assets</strong><span>Blockchain systems, custody models and market structure.</span></span>
          <span class="home-sector-arrow" aria-hidden="true">↗</span>
        </a>
        <a class="home-sector-row" href="pages/real-estate.html">
          <span class="home-sector-number">02</span>
          <img src="assets/images/real estate.jpg" alt="Real estate and property" loading="lazy">
          <span class="home-sector-copy"><span class="eyebrow">Property / ownership / liquidity</span><strong>Real estate</strong><span>Property fundamentals, ownership structures and due diligence.</span></span>
          <span class="home-sector-arrow" aria-hidden="true">↗</span>
        </a>
        <a class="home-sector-row" href="pages/agriculture.html">
          <span class="home-sector-number">03</span>
          <img src="assets/images/agriculture.jpg" alt="Agriculture and production" loading="lazy">
          <span class="home-sector-copy"><span class="eyebrow">Production / supply chains / land</span><strong>Agriculture</strong><span>Production systems, processing capacity and routes to market.</span></span>
          <span class="home-sector-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </section>

  <section class="home-method section section-alt">
    <div class="container home-method-layout">
      <figure class="home-method-image"><img src="assets/images/research cta image.jpg" alt="Research materials arranged for review" loading="lazy"></figure>
      <div class="home-method-copy">
        <p class="eyebrow">How we think</p>
        <h2>Context before conviction.</h2>
        <p>Markets move. Information changes. We focus on explaining the factors that shape a decision, not on predictions or promises.</p>
        <a class="text-link" href="pages/about.html">Read our approach <span aria-hidden="true">→</span></a>

      </div>
    </div>
  </section>

  <section class="home-principles-band section">
    <div class="container">
      <div class="home-section-heading">
        <div><p class="eyebrow">Our standards</p><h2>Clarity is a practice.</h2></div>
        <a class="text-link" href="pages/corporate-responsibility.html">How we work <span aria-hidden="true">→</span></a>
      </div>
      <div class="home-principles-list">
        <div><span>01</span><h3>Evidence first</h3><p>Examine relevant information before framing an opportunity.</p></div>
        <div><span>02</span><h3>Risk in view</h3><p>Make uncertainty, constraints and downside part of the discussion.</p></div>
        <div><span>03</span><h3>Accountability</h3><p>Document decisions and communicate with care.</p></div>
      </div>
    </div>
  </section>

  <section class="home-contact-band">
    <div class="container home-contact-content">
      <p class="eyebrow">Northstar / Conversation</p>
      <h2>Start with a better question.</h2>
      <p>Speak with our team about our research and areas of focus.</p>
      <a class="btn btn-primary" href="pages/contact.html">Contact Northstar <span aria-hidden="true">↗</span></a>
    </div>
  </section>`;
}

function setupHeroCarousel() {
  const hero = $('.hero', app);
  if (!hero) return;

  const slides = [
    {
      label: 'INDEPENDENT THINKING',
      title: 'Independent thinking.<br><span>Grounded in research.</span>',
      copy: 'We take a considered view of digital assets, real estate and agriculture—separating evidence from noise.',
      proof: 'Independent thinking'
    },
    {
      label: 'CLEAR COMMUNICATION',
      title: 'Clear communication.<br><span>Thoughtful decisions.</span>',
      copy: 'Understand complex markets through clear explanations of opportunity, uncertainty and risk.',
      proof: 'Clear communication'
    },
    {
      label: 'RISK-AWARE RESEARCH',
      title: 'Risk-aware research.<br><span>Perspective first.</span>',
      copy: 'We examine trade-offs, uncertainty and potential downside before framing an opportunity.',
      proof: 'Risk-aware research'
    }
  ];

  hero.classList.add('hero-carousel');

  hero.innerHTML = `<div class="hero-backdrops" aria-hidden="true">
    <div class="hero-backdrop is-active"></div>
    <div class="hero-backdrop"></div>
    <div class="hero-backdrop"></div>
  </div>
  <div class="container hero-content">
    <div class="hero-copy" data-hero-copy>
      <p class="eyebrow">NORTHSTAR CAPITAL <span class="hero-label" data-hero-label></span></p>
      <h1 data-hero-title></h1>
      <p data-hero-description></p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="pages/plans.html">Explore our services</a>
        <a class="btn btn-outline" href="pages/about.html">Our approach</a>
      </div>
      <div class="hero-proof" aria-label="Our principles">
        <span>Independent thinking</span>
        <span>Clear communication</span>
        <span>Risk-aware research</span>
      </div>
    </div>
    <div class="hero-carousel-controls" aria-label="Homepage highlights">
      <button class="hero-arrow" type="button" data-hero-prev aria-label="Previous highlight">‹</button>
      <div class="hero-dots">
        ${slides.map((slide, index) =>
          `<button class="hero-dot${index === 0 ? ' is-active' : ''}"
            type="button"
            data-hero-slide="${index}"
            aria-label="Show ${slide.label.toLowerCase()} highlight"
            aria-pressed="${index === 0}"></button>`
        ).join('')}
      </div>
      <button class="hero-arrow" type="button" data-hero-next aria-label="Next highlight">›</button>
      <span class="sr-only" data-hero-status role="status" aria-live="polite"></span>
    </div>
  </div>`;

  const backdrops = $$('.hero-backdrop', hero);
  const title = $('[data-hero-title]', hero);
  const description = $('[data-hero-description]', hero);
  const label = $('[data-hero-label]', hero);
  const copy = $('[data-hero-copy]', hero);
  const dots = $$('.hero-dot', hero);
  const status = $('[data-hero-status]', hero);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let active = 0;
  let timer;
  let pointerPaused = false;
  let focusPaused = false;

  const render = (index, announce = false) => {
    active = (index + slides.length) % slides.length;
    const slide = slides[active];

    backdrops.forEach((element, i) => {
      element.classList.toggle('is-active', i === active);
    });

    dots.forEach((element, i) => {
      const selected = i === active;
      element.classList.toggle('is-active', selected);
      element.setAttribute('aria-pressed', String(selected));
    });

    copy.classList.remove('is-changing');
    title.innerHTML = slide.title;
    description.textContent = slide.copy;
    label.textContent = slide.label;

    $$('.hero-proof span', hero).forEach(element => {
      element.classList.toggle('is-highlighted', element.textContent === slide.proof);
    });

    void copy.offsetWidth;
    copy.classList.add('is-changing');

    if (announce) status.textContent = `${slide.label}: ${slide.copy}`;
  };

  const stop = () => {
    window.clearInterval(timer);
    timer = undefined;
  };

  const start = () => {
    stop();
    if (!pointerPaused && !focusPaused && !reduceMotion.matches && !document.hidden) {
      timer = window.setInterval(() => render(active + 1), 6500);
    }
  };

  dots.forEach((button, index) => {
    button.addEventListener('click', () => {
      render(index, true);
      start();
    });
  });

  $('[data-hero-prev]', hero).addEventListener('click', () => {
    render(active - 1, true);
    start();
  });

  $('[data-hero-next]', hero).addEventListener('click', () => {
    render(active + 1, true);
    start();
  });

  hero.addEventListener('pointerenter', () => {
    pointerPaused = true;
    stop();
  });

  hero.addEventListener('pointerleave', () => {
    pointerPaused = false;
    start();
  });

  hero.addEventListener('focusin', () => {
    focusPaused = true;
    stop();
  });

  hero.addEventListener('focusout', event => {
    if (!hero.contains(event.relatedTarget)) {
      focusPaused = false;
      start();
    }
  });

  hero.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      render(active + 1, true);
      start();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      render(active - 1, true);
      start();
    }
  });

  document.addEventListener('visibilitychange', start);
  reduceMotion.addEventListener?.('change', start);

  render(0);
  start();
}

const publicContent = {
  about: () => `${pageHero(
    'ABOUT NORTHSTAR',
    'A company built<br><span>with a long-term view.</span>',
    'An introduction to Northstar Capital Limited and its corporate identity.',
    '',
    'page-hero--company'
  )}
  <section class="section">
    <div class="container grid grid-2">
      <div>
        <p class="eyebrow">THE COMPANY</p>
        <h2>Northstar Capital Limited</h2>
        <p>Northstar Capital Limited is a private company limited by shares, incorporated in England and Wales on 29 December 2021.</p>
        <p>The company is registered under company number 13821196.</p>
      </div>
      <div class="card">
        <p class="eyebrow">COMPANY DETAILS</p>
        <div class="company-detail">
          <span>Legal name</span>
          <strong>Northstar Capital Limited</strong>
        </div>
        <div class="company-detail">
          <span>Company number</span>
          <strong>13821196</strong>
        </div>
        <div class="company-detail">
          <span>Incorporation date</span>
          <strong>29 December 2021</strong>
        </div>
        <div class="company-detail">
          <span>Company type</span>
          <strong>Private company limited by shares</strong>
        </div>
        <div class="company-detail">
          <span>Jurisdiction</span>
          <strong>England and Wales</strong>
        </div>
      </div>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container">
      <div class="section-heading">
        <p class="eyebrow">OUR AREAS OF INTEREST</p>
        <h2>Three areas. A broader perspective.</h2>
        <p>The Northstar Capital website presents the following sectors for exploration.</p>
      </div>
      ${cards([
        ['Digital Assets', 'Explore blockchain-based assets, digital infrastructure and the changing digital asset economy.'],
        ['Real Estate', 'Explore property markets, real assets and the factors that influence property investment.'],
        ['Agriculture', 'Explore agricultural production, processing, storage and market access.']
      ])}
    </div>
  </section>`,

  responsibility: () => `${pageHero(
    'RESPONSIBLE BUSINESS',
    'Progress should be<br><span>built responsibly.</span>',
    'A proposed framework for ethical conduct, governance and long-term thinking.',
    '',
    'page-hero--responsibility'
  )}
  <section class="section">
    <div class="container grid grid-2">
      <div>
        <h2>Responsibility is part of the process.</h2>
        <p>Responsible business means considering more than immediate financial outcomes. It means asking how decisions are made, who may be affected and what risks could emerge over time.</p>
      </div>
      ${placeholderImage('RESPONSIBLE BUSINESS IMAGE.jpg', 'Business leaders working together toward shared goals.')}
    </div>
  </section>
  <section class="section section-alt">
    <div class="container">
      ${cards([
        ['Governance', 'Clear responsibilities, documented processes and oversight.'],
        ['People and communities', 'Respectful workplaces and constructive relationships.'],
        ['Environmental awareness', 'Assess relevant environmental effects and sustainability.']
      ], [
        { src: 'governance cta image.jpg', alt: 'A connected governance and operations network.' },
        { src: 'people and community cta image.jpg', alt: 'People sharing an idea collaboratively.' },
        { src: 'environmental awareness cta image.jpg', alt: 'A seedling and the Earth symbolising environmental care.' }
      ])}
    </div>
  </section>`,

  'digital-assets': () => sector(
    'OUR SECTORS / 01',
    'Understanding the<br><span>digital asset economy.</span>',
    'Explore blockchain-based assets, digital infrastructure and the opportunities and risks shaping this evolving sector.',
    [
      ['Blockchain infrastructure', 'Distributed ledgers, transaction validation and protocol design.'],
      ['Digital asset markets', 'Liquidity, volatility, market structure and speculative risk.'],
      ['Custody and security', 'Wallet security, private-key management and counterparty risk.']
    ],
    'sector page image.jpg',
    'A digital asset coin in a field.',
    'digital-assets',
    [
      { src: 'blockchain.jpg', alt: 'Blockchain technology network illustration.' },
      { src: 'digital assets.jpg', alt: 'Digital asset and cryptocurrency security illustration.' },
      { src: 'custody and security background.jpg', alt: 'Digital asset custody and security illustration.' }
    ]
  ),

  'real-estate': () => sector(
    'OUR SECTORS / 02',
    'Value built<br><span>for the long term.</span>',
    'Explore property markets, real assets and the factors that influence long-term performance.',
    [
      ['Residential property', 'Demand, affordability, occupancy and maintenance.'],
      ['Commercial property', 'Tenant quality, lease terms and operating expenses.'],
      ['Industrial and logistics', 'Transport access, infrastructure and market demand.']
    ],
    'real estate.jpg',
    'A home, savings and a calculator illustrating property finance.',
    'real-estate'
  ),

  agriculture: () => sector(
    'OUR SECTORS / 03',
    'Supporting the<br><span>future of food.</span>',
    'Explore agricultural production, processing, storage and market access.',
    [
      ['Primary production', 'Crop cultivation, livestock and suitable operating inputs.'],
      ['Processing and storage', 'Handling, preservation and post-harvest loss reduction.'],
      ['Distribution and markets', 'Transport and commercial relationships connecting producers and customers.']
    ],
    'agriculture.jpg',
    'An agricultural field with the word Agro.',
    'agriculture'
  ),

  plans: () => `${pageHero(
    'SERVICES & CATEGORIES',
    'Choose clarity<br><span>before commitment.</span>',
    'Review the service categories below. These are illustrative categories, not offers of guaranteed investment returns.',
    '',
    'page-hero--sector'
  )}
  <section class="section">
    <div class="container">
      <div id="plans-list" class="grid grid-3">
        <div class="loading">Loading available categories…</div>
      </div>
      <div class="notice" style="margin-top:28px">
        Create an Account and Login to Choose a Plan
      </div>
    </div>
  </section>`,

  faq: () => `${pageHero(
    'HELP CENTRE',
    'Frequently asked<br><span>questions.</span>',
    'Find answers about accounts, records, requests and security.',
    '',
    'page-hero--faq'
  )}
  <section class="section">
    <div class="container" style="max-width:850px">
      ${[
        ['How do I create an account?', 'Use the registration page with an email address and password. Confirm your email if your project settings require it.'],
        ['Does a deposit request mean funds were received?', 'No. A request is a record only. Crypto transfers and bank payments are manually reconciled before any USDT is credited. A bank transfer may be credited at a different USDT amount after review.'],
        ['How do withdrawals work?', 'A withdrawal request reserves the requested USDT amount. Admin approval records a decision but does not send funds; a transfer reference is recorded when the payment is marked complete.'],
        ['Can I pay by card?', 'Card payments are not currently available. A payment processor must be selected and integrated before card checkout is enabled.'],
        ['Are returns guaranteed?', 'No. Investment outcomes are uncertain and losses are possible. Treat claims of guaranteed high returns with caution.'],
        ['How do I protect my account?', 'Use a unique password, protect your email, never share authentication codes and contact support if you suspect unauthorised access.'],
        ['How can I recover my password?', 'Use the password recovery page to request a reset email.']
      ].map(([q, a]) =>
        `<div class="faq-item">
          <button class="faq-question" aria-expanded="false">${q}<span>＋</span></button>
          <div class="faq-answer">${a}</div>
        </div>`
      ).join('')}
    </div>
  </section>`,

  contact: () => `${pageHero(
    'CONTACT',
    'Start a<br><span>conversation.</span>',
    'For enquiries and further information about Northstar Capital, use the form below.',
    '',
    'page-hero--contact'
  )}
  <section class="section">
    <div class="container grid grid-2">
      <div>
        <p class="eyebrow">GET IN TOUCH</p>
        <h2>We welcome your enquiries.</h2>
        <p>Whether your enquiry concerns the company, its areas of interest or general information, you can prepare your message here.</p>
        <p class="muted">Additional contact details will be published here when available.</p>
      </div>
      <form class="form-card form-grid" id="contact-form">
        <div class="field">
          <label for="contact-name">Full name</label>
          <input id="contact-name" name="name" required maxlength="120">
        </div>
        <div class="field">
          <label for="contact-email">Email address</label>
          <input id="contact-email" name="email" type="email" required maxlength="254">
        </div>
        <div class="field">
          <label for="contact-subject">Subject</label>
          <input id="contact-subject" name="subject" required maxlength="160">
        </div>
        <div class="field">
          <label for="contact-message">Message</label>
          <textarea id="contact-message" name="message" required maxlength="4000"></textarea>
        </div>
        <button class="btn btn-primary" type="submit">Prepare enquiry</button>
        <div id="form-message" aria-live="polite"></div>
      </form>
    </div>
  </section>`,

  login: () => authForm('Sign in', 'Welcome back. Sign in to access your account.', 'login'),
  register: () => authForm('Create your account', 'Register with your email and a strong password.', 'register'),
  'forgot-password': () => authForm('Reset your password', 'We’ll request a password reset email if your account exists.', 'forgot-password'),

  terms: () => `${pageHero(
    'LEGAL INFORMATION',
    'Terms of use',
    'These starter terms are a placeholder and must be reviewed by qualified counsel before the website is used commercially.'
  )}
  <section class="section">
    <div class="container" style="max-width:850px">
      <h2>1. Informational use</h2>
      <p>This website starter provides general information only. It is not financial, legal, tax or investment advice, and it is not an offer to buy or sell a financial product.</p>
      <h2>2. Risk</h2>
      <p>Investments can lose value. Digital assets can be highly volatile, property may be illiquid, and agriculture is exposed to operating and environmental risks. Past performance does not guarantee future results.</p>
      <h2>3. Account security</h2>
      <p>Users are responsible for safeguarding their login credentials and reporting suspected unauthorised activity.</p>
      <h2>4. Requests and transfers</h2>
      <p>Recording a deposit or withdrawal request does not establish that a payment has been received or sent. Any actual payment must be confirmed by the relevant payment provider and reconciled.</p>
      <h2>5. Company details and jurisdiction</h2>
      <p>Replace this text with the verified legal entity name, registration information, applicable jurisdiction, complaint procedure and professionally reviewed terms before launch.</p>
    </div>
  </section>`
};

function sector(kicker, title, sub, items, image, imageAlt, sectorName, images = []) {
  const hero = pageHero(
    kicker,
    title,
    sub,
    `<a class="btn btn-primary" href="contact.html">Discuss this sector</a>`
  ).replace(
    '<section class="page-hero">',
    `<section class="page-hero sector-page-hero sector-page-hero--${sectorName}">`
  );

  return `${hero}
  <section class="section">
    <div class="container grid grid-2">
      <div>
        <p class="eyebrow">OUR APPROACH</p>
        <h2>Understand the fundamentals.</h2>
        <p>Each asset class has its own risks, costs and operating conditions. Research and due diligence should come before any commitment.</p>
        <p>Values can decline and an investment may not be easy to sell. No outcome is guaranteed.</p>
      </div>
      <figure class="sector-image">
        <img src="../assets/images/${encodeURIComponent(image).replace(/%2F/g, '/')}" alt="${esc(imageAlt)}" loading="lazy">
      </figure>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container">
      <div class="section-heading">
        <p class="eyebrow">AREAS TO UNDERSTAND</p>
        <h2>Explore the landscape</h2>
      </div>
      ${cards(items, images)}
    </div>
  </section>`;
}

function authForm(title, sub, kind) {
  let fields = kind === 'register'
    ? `<div class="field">
        <label for="full-name">Full name</label>
        <input id="full-name" name="full_name" required maxlength="120" autocomplete="name">
      </div>
      <div class="field">
        <label for="referral-code">Referral code (optional)</label>
        <input id="referral-code" name="referral_code" maxlength="20" value="${esc(new URLSearchParams(location.search).get('ref') || '')}" autocomplete="off">
      </div>`
    : '';

  if (kind === 'login') {
    fields += `<div class="field">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="email">
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password">
    </div>
    <p class="form-note"><a href="forgot-password.html">Forgot password?</a></p>`;
  } else if (kind === 'register') {
    fields += `<div class="field">
      <label for="tether-trc20-wallet">Your Tether (USDT TRC20) wallet address</label>
      <input id="tether-trc20-wallet" name="tether_trc20_wallet" type="text" required maxlength="220" autocomplete="off" placeholder="Enter your TRC20 receiving address">
    </div>
    <div class="field">
      <label for="bitcoin-wallet">Your Bitcoin wallet address</label>
      <input id="bitcoin-wallet" name="bitcoin_wallet" type="text" required maxlength="220" autocomplete="off" placeholder="Enter your Bitcoin receiving address">
    </div>
    <div class="field">
      <label for="usdc-wallet">Your USDC wallet address</label>
      <input id="usdc-wallet" name="usdc_wallet" type="text" required maxlength="220" autocomplete="off" placeholder="Enter your USDC receiving address and ensure the network is correct">
    </div>
    <div class="field">
      <label for="email">Email Address</label>
      <input id="email" name="email" type="email" required autocomplete="email">
    </div>
    <div class="field">
      <label for="email-confirm">Confirm Email Address</label>
      <input id="email-confirm" name="email_confirm" type="email" required autocomplete="email" placeholder="Re-enter your email address">
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required minlength="10" autocomplete="new-password">
      <small class="form-note">Use at least 10 characters.</small>
    </div>
    <div class="field">
      <label for="password-confirm">Confirm password</label>
      <input id="password-confirm" name="password_confirm" type="password" required minlength="10" autocomplete="new-password">
    </div>
    <label class="form-note">
      <input type="checkbox" name="terms" required> I agree to the terms of use.
    </label>
    <div class="captcha-field">
      <span class="captcha-label">Human verification</span>
      <div id="turnstile-container" class="turnstile-container"></div>
      <small id="captcha-help" class="form-note" aria-live="polite">Loading human verification…</small>
    </div>`;
  } else {
    fields = `<div class="field">
      <label for="email">Account email</label>
      <input id="email" name="email" type="email" required autocomplete="email">
    </div>`;
  }

  const registration = kind === 'register';
  const captchaReady = cfg.CAPTCHA_SITE_KEY &&
    !cfg.CAPTCHA_SITE_KEY.includes('YOUR_CLOUDFLARE');

  return `${pageHero('SECURE ACCOUNT', title, sub, '', 'page-hero--auth')}
  <section class="section">
    <form class="form-card form-grid" id="auth-form" data-auth-kind="${kind}">
      ${!configured ? notice('Setup required: add your Supabase URL and public key in assets/js/config.js before using authentication.', 'error') : ''}
      ${registration && !captchaReady ? notice('Setup required: configure a Cloudflare Turnstile site key and enable Turnstile in Supabase Auth before registrations can be submitted.', 'error') : ''}
      ${fields}
      <button class="btn btn-primary" type="submit"${registration ? ' disabled' : ''}>
        ${kind === 'login' ? 'Sign in' : registration ? 'Create account' : 'Send reset email'}
      </button>
      <div id="form-message" aria-live="polite"></div>
      <p class="form-note">
        ${kind === 'login'
          ? `New here? <a href="register.html">Create an account</a>`
          : registration
            ? `Already registered? <a href="login.html">Sign in</a>`
            : `<a href="login.html">Back to sign in</a>`}
      </p>
    </form>
    ${registration ? `<dialog class="auth-dialog" id="auth-result-dialog" aria-labelledby="auth-dialog-title">
      <div class="auth-dialog-content">
        <span class="auth-dialog-icon" data-auth-dialog-icon aria-hidden="true"></span>
        <h2 id="auth-dialog-title"></h2>
        <p data-auth-dialog-message></p>
        <button class="btn btn-primary" type="button" data-auth-dialog-close>Continue</button>
      </div>
    </dialog>` : ''}
  </section>`;
}

async function renderPlans() {
  const target = $('#plans-list');
  if (!target) return;

  try {
    const r = await fetch(`${API}/api/plans`);
    const d = await r.json();
    const items = d.items || [];

    target.innerHTML = items.map(p =>
      `<article class="card">
        <p class="eyebrow">SERVICE CATEGORY</p>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description || 'Contact us for further information.')}</p>
        <p><strong>${money(p.minimum_amount)}</strong>${p.maximum_amount ? ` – ${money(p.maximum_amount)}` : '+'}</p>
        <p class="form-note">Eligibility and terms must be independently verified.</p>
        <a class="btn btn-outline" href="contact.html">Enquire</a>
      </article>`
    ).join('') || '<div class="empty-state">No categories are published yet.</div>';
  } catch {
    target.innerHTML = '<div class="empty-state">Service categories are temporarily unavailable. Check that the API is running.</div>';
  }
}

let turnstileLoader;

async function loadTurnstile() {
  if (window.turnstile) return window.turnstile;

  if (!turnstileLoader) {
    turnstileLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error('Human verification did not load.'));
      script.onerror = () => reject(new Error('Could not load human verification. Check your connection and try again.'));
      document.head.append(script);
    }).catch(error => {
      turnstileLoader = null;
      throw error;
    });
  }

  return turnstileLoader;
}

function showRegistrationResult(success, message) {
  const dialog = $('#auth-result-dialog');

  if (!dialog) {
    $('#form-message').innerHTML = notice(message, success ? 'success' : 'error');
    return;
  }

  dialog.dataset.state = success ? 'success' : 'error';
  $('[data-auth-dialog-icon]', dialog).textContent = success ? '✓' : '!';
  $('#auth-dialog-title', dialog).textContent = success ? 'Account created' : 'Account creation failed';
  $('[data-auth-dialog-message]', dialog).textContent = message;

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    $('#form-message').innerHTML = notice(message, success ? 'success' : 'error');
  }
}

async function handleAuth() {
  const form = $('#auth-form');
  if (!form) return;

  const kind = form.dataset.authKind;
  const out = $('#form-message');
  const submitButton = $('button[type="submit"]', form);
  let captchaToken = '';
  let widgetId;

  const dialog = $('#auth-result-dialog');

  if (dialog) {
    $('[data-auth-dialog-close]', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  }

  if (kind === 'register') {
    const help = $('#captcha-help');

    if (!cfg.CAPTCHA_SITE_KEY || cfg.CAPTCHA_SITE_KEY.includes('YOUR_CLOUDFLARE')) {
      help.textContent = 'Registration is unavailable until Turnstile is configured.';
    } else {
      try {
        const turnstile = await loadTurnstile();

        widgetId = turnstile.render('#turnstile-container', {
          sitekey: cfg.CAPTCHA_SITE_KEY,
          callback: token => {
            captchaToken = token;
            submitButton.disabled = false;
            help.textContent = 'Human verification complete.';
          },
          'expired-callback': () => {
            captchaToken = '';
            submitButton.disabled = true;
            help.textContent = 'Verification expired. Complete the check again.';
          },
          'error-callback': () => {
            captchaToken = '';
            submitButton.disabled = true;
            help.textContent = 'Verification failed to load. Refresh the page and try again.';
          }
        });
      } catch (error) {
        help.textContent = error.message;
      }
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);

    try {
      const client = await getSupabase();
      let res;

      if (kind === 'login') {
        res = await client.auth.signInWithPassword({
          email: data.get('email'),
          password: data.get('password')
        });

        if (res.error) throw res.error;

        submitButton.disabled = true;

        try {
          const redirected = await redirectForVerifiedRole({ signOutUnknown: true });

          if (!redirected) {
            throw new Error('This account does not have an authorised member or administrator role. Contact support.');
          }
        } catch (routeError) {
          await client.auth.signOut();
          throw routeError;
        }

        return;
      }

      if (kind === 'register') {
        if (
          String(data.get('email') || '').trim().toLowerCase() !==
          String(data.get('email_confirm') || '').trim().toLowerCase()
        ) {
          throw new Error('Email addresses do not match.');
        }

        if (data.get('password') !== data.get('password_confirm')) {
          throw new Error('Passwords do not match.');
        }

        if (!captchaToken) {
          throw new Error('Complete the human verification before creating your account.');
        }

        submitButton.disabled = true;

        res = await client.auth.signUp({
          email: data.get('email'),
          password: data.get('password'),
          options: {
            data: {
              full_name: data.get('full_name'),
              referral_code: String(data.get('referral_code') || '').trim().toUpperCase(),
              tether_trc20_wallet: String(data.get('tether_trc20_wallet') || '').trim(),
              bitcoin_wallet: String(data.get('bitcoin_wallet') || '').trim(),
              usdc_wallet: String(data.get('usdc_wallet') || '').trim()
            },
            emailRedirectTo: location.origin + '/pages/login.html',
            captchaToken
          }
        });

        if (res.error) throw res.error;

        showRegistrationResult(
          true,
          'Your account has been created. If email confirmation is enabled, check your inbox to verify your address before signing in.'
        );
        return;
      }

      res = await client.auth.resetPasswordForEmail(data.get('email'), {
        redirectTo: location.origin + '/pages/login.html'
      });

      if (res.error) throw res.error;

      out.innerHTML = notice('If the account exists, a password reset email has been requested.', 'success');
    } catch (err) {
      if (kind === 'register') {
        showRegistrationResult(false, err.message || 'We could not create your account. Please try again.');
      } else {
        out.innerHTML = notice(err.message || 'Authentication failed.', 'error');
      }

      if (kind === 'register' && widgetId !== undefined) {
        captchaToken = '';
        submitButton.disabled = true;
        window.turnstile?.reset(widgetId);
        $('#captcha-help').textContent = 'Please complete the human verification again.';
      }
    } finally {
      if (kind === 'register' && !dialog?.open && widgetId !== undefined) {
        submitButton.disabled = !captchaToken;
      }
    }
  });
}

async function protect() {
  const memberPages = [
    'dashboard',
    'new-deposit',
    'deposit-history',
    'investments',
    'withdrawals',
    'transactions',
    'partner-program',
    'profile'
  ];

  const isAdmin = page.startsWith('admin-');
  const isMember = memberPages.includes(page);

  if (!isAdmin && !isMember) return true;

  if (!configured) {
    app.innerHTML = `<section class="section">
      <div class="container">
        ${notice('Configure Supabase in assets/js/config.js to use the portal.', 'error')}
        <a class="btn btn-primary" href="../pages/login.html">Go to login</a>
      </div>
    </section>`;
    return false;
  }

  try {
    const activeSession = await session();

    if (!activeSession) {
      location.replace('../pages/login.html');
      return false;
    }

    const roleData = await api('/api/auth/role');
    const role = roleData?.role;
    const target = portalForRole(role);

    if (!target) {
      const client = await getSupabase();
      await client.auth.signOut();
      location.replace('../pages/login.html');
      return false;
    }

    if (isAdmin && role !== 'admin') {
      location.replace(target);
      return false;
    }

    if (isMember && role !== 'member') {
      location.replace(target);
      return false;
    }

    if (isAdmin) await api('/api/admin/overview');
    return true;
  } catch (err) {
    app.innerHTML = `<section class="section">
      <div class="container">
        ${notice(err.message || 'Unable to load your account.', 'error')}
      </div>
    </section>`;
    return false;
  }
}

function sidebar(admin = false) {
  const items = admin
    ? [
        ['Overview', 'index.html'],
        ['Users', 'users.html'],
        ['KYC reviews', 'kyc.html'],
        ['Deposits', 'deposits.html'],
        ['Withdrawals', 'withdrawals.html'],
        ['Plans', 'investments.html'],
        ['Transactions', 'transactions.html'],
        ['Referrals', 'partner-program.html'],
        ['Audit log', 'audit-log.html'],
        ['Settings', 'settings.html']
      ]
    : [
        ['Dashboard', 'dashboard.html'],
        ['New deposit request', 'new-deposit.html'],
        ['Deposit history', 'deposit-history.html'],
        ['Investments', 'investments.html'],
        ['Withdrawals', 'withdrawals.html'],
        ['Transactions', 'transactions.html'],
        ['Referrals', 'partner-program.html'],
        ['My profile', 'profile.html']
      ];

  return `<aside class="sidebar">
    ${items.map(([n, p]) =>
      `<a class="${location.pathname.endsWith(p) ? 'active' : ''}" href="${p}">${n}</a>`
    ).join('')}
  </aside>`;
}

async function memberPage() {
  const admin = page.startsWith('admin-');

  const title = admin
    ? ({
        'admin-overview': 'Admin overview',
        'admin-users': 'Users',
        'admin-kyc': 'KYC reviews',
        'admin-deposits': 'Deposit reviews',
        'admin-withdrawals': 'Withdrawal reviews',
        'admin-plans': 'Plans & products',
        'admin-transactions': 'Transactions',
        'admin-partners': 'Referrals',
        'admin-audit': 'Audit log',
        'admin-settings': 'Settings'
      }[page] || 'Administration')
    : ({
        dashboard: 'Dashboard',
        'new-deposit': 'New deposit request',
        'deposit-history': 'Deposit history',
        investments: 'Investments',
        withdrawals: 'Withdrawals',
        transactions: 'Transactions',
        'partner-program': 'Referrals',
        profile: 'My profile'
      }[page] || 'Member area');

  app.innerHTML = `<section class="section portal-shell ${page === 'dashboard' ? 'member-dashboard-shell' : admin ? 'admin-dashboard-shell' : 'member-page-shell'}">
    <div class="container">
      <p class="eyebrow">${admin ? 'ADMINISTRATION' : 'MEMBER AREA'}</p>
      <h1>${title}</h1>
      <div class="dashboard-layout">
        ${sidebar(admin)}
        <div class="dashboard-main">
          <div class="loading">Loading your records…</div>
        </div>
      </div>
    </div>
  </section>`;

  const main = $('.dashboard-main');

  try {
    if (page === 'dashboard') {
      const marketPromise = api('/api/market/prices').catch(() => null);
      const referralPromise = api('/api/member/referrals').catch(() => null);
      const [d, me, requestData, contractData] = await Promise.all([
        api('/api/dashboard'),
        getMemberProfile(),
        api('/api/member/investment-requests'),
        api('/api/member/contracts')
      ]);

      const profile = me.profile || {};
      const balance = Number(d.wallet?.balance ?? 0);
      const requests = requestData.items || [];
      const contracts = contractData.items || [];
      const totalReturn = contracts.reduce((sum, c) => sum + Number(c.total_return || 0), 0);
      const contractValue = contracts.reduce((sum, c) => sum + Number(c.current_value ?? c.principal ?? 0), 0);

      const pendingDeck =
        (d.deposits || []).filter(x => x.status === 'pending').length +
        (d.withdrawals || []).filter(x => x.status === 'pending').length +
        requests.filter(x => x.status === 'pending').length;

      // Updated to match the four statuses returned by the backend.
      const kycStatus = String(profile.kyc_status || 'not_submitted').toLowerCase();

      const kycLabels = {
        not_submitted: 'Not submitted',
        pending_review: 'Under review',
        approved: 'Approved',
        rejected: 'Action required'
      };

      const kycMessages = {
        not_submitted: 'Documents required',
        pending_review: 'Under review',
        approved: 'Verified',
        rejected: 'Action required'
      };

      const kycLabel = kycLabels[kycStatus] || 'Not submitted';
      const kycMessage = kycMessages[kycStatus] || kycMessages.not_submitted;

      const displayName = (profile.display_name || profile.full_name || profile.email || 'there').trim();
      const profileImageUrl = typeof profile.profile_image_url === 'string' && /^https:\/\//i.test(profile.profile_image_url)
        ? profile.profile_image_url
        : null;
      const profileInitial = displayName.slice(0, 1).toUpperCase();
      const formatMarketPrice = value =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: Number(value) < 1 ? 6 : 2
        }).format(Number(value));
      const statusText = v => String(v || 'pending').replace(/_/g, ' ');

      main.innerHTML = `
        <div class="ns-dashboard">
          <header class="ns-dashboard-heading">
            <div>
              <p class="eyebrow">YOUR INVESTMENT ACCOUNT</p>
              <h2>Good to have you back, ${esc(displayName.split(' ')[0])}.</h2>

            </div>
            <div class="ns-account-status">
              <span class="ns-status-dot"></span>
              <span>${esc(kycLabel)}</span>
              <a href="profile.html" aria-label="Manage account verification">Manage</a>
            </div>
          </header>

          <section class="ns-account-overview">
            <div class="ns-account-primary">
              <div class="ns-account-label">
                <span>AVAILABLE BALANCE</span>
                <span class="ns-account-reference">WALLET LEDGER</span>
              </div>
              <strong>${money(balance, d.wallet?.asset || 'USDT')}</strong>

              <div class="ns-account-actions">
                <a class="btn btn-primary" href="new-deposit.html">Add funds <span aria-hidden="true">↗</span></a>
                <a class="ns-text-action" href="withdrawals.html">Withdrawal options <span aria-hidden="true">→</span></a>
              </div>
            </div>
            <div class="ns-account-secondary">
              <div class="ns-secondary-heading">
                <span>INVESTMENT POSITION</span>
                <span class="ns-secondary-mark">NC / 01</span>
              </div>
              <div class="ns-position-line">
                <span>Contract value</span>
                <strong>${money(contractValue, 'USDT')}</strong>
              </div>
              <div class="ns-position-line">
                <span>Recorded returns</span>
                <strong>${money(totalReturn, 'USDT')}</strong>
              </div>
              <div class="ns-position-line">
                <span>Active contracts</span>
                <strong>${contracts.filter(c => c.status === 'active').length}</strong>
              </div>
              <div class="ns-position-line">
                <span>Items awaiting review</span>
                <strong>${pendingDeck}</strong>
              </div>
              <a class="ns-secondary-link" href="investments.html">View investment details <span aria-hidden="true">↗</span></a>
            </div>
          </section>

          <section class="ns-dashboard-section ns-market-section" aria-label="Market reference">
            <div class="ns-section-heading">
              <div>
                <p class="eyebrow">MARKET REFERENCE</p>
                <h3>Digital asset prices</h3>
              </div>
              <span class="ns-section-note">Indicative USD pricing</span>
            </div>
            <div class="ns-market-grid ticker-strip" id="market-ticker">
              <div class="loading">Loading reference prices…</div>
            </div>
            <div id="market-notice" aria-live="polite"></div>
          </section>

          <div class="ns-dashboard-columns">
            <section class="ns-dashboard-section ns-contract-section">
              <div class="ns-section-heading">
                <div>
                  <p class="eyebrow">YOUR PORTFOLIO</p>
                  <h3>Investment commitments</h3>
                </div>
                <a href="investments.html">Explore plans ↗</a>
              </div>
              ${contracts.length
                ? `<div class="ns-contract-list">
                    ${contracts.slice(0, 5).map(c => `
                      <article class="ns-contract-row">
                        <div class="ns-contract-symbol" aria-hidden="true">NC</div>
                        <div class="ns-contract-name">
                          <strong>${esc(c.plans?.name || 'Investment contract')}</strong>
                          <span>${esc(statusText(c.status))}</span>
                        </div>
                        <div class="ns-contract-amount">
                          <strong>${money(c.current_value ?? c.principal ?? 0, c.asset || 'USDT')}</strong>
                          <span>Current value</span>
                        </div>
                      </article>
                    `).join('')}
                  </div>`
                : `<div class="ns-empty-state">
                    <span class="ns-empty-index">01 / PORTFOLIO</span>
                    <h4>Your investment portfolio starts here.</h4>

                    <a href="investments.html">Review available plans ↗</a>
                  </div>`}
              <div class="ns-contract-foot">
                <span>Recorded principal</span>
                <strong>${money(contracts.reduce((sum, c) => sum + Number(c.principal || 0), 0), 'USDT')}</strong>
              </div>
            </section>

            <aside class="ns-dashboard-section ns-verification-section">
              <div class="ns-section-heading">
                <div>
                  <p class="eyebrow">ACCOUNT ASSURANCE</p>
                  <h3>Verification</h3>
                </div>
                <span class="ns-verification-index">02</span>
              </div>
              <div class="ns-verification-state">
                <span class="ns-verification-label">IDENTITY STATUS</span>
                <strong>${esc(kycLabel)}</strong>
                <p>${esc(kycMessage)}</p>
              </div>
              <a class="ns-outline-link" href="profile.html">View profile and documents <span aria-hidden="true">↗</span></a>
              <div class="ns-verification-foot">
                <span>Account security</span>
                <span>Profile settings</span>
              </div>
            </aside>
          </div>

          <div class="ns-dashboard-columns ns-activity-columns">
            <section class="ns-dashboard-section">
              <div class="ns-section-heading">
                <div>
                  <p class="eyebrow">INVESTMENT REQUESTS</p>
                  <h3>Plan applications</h3>
                </div>
                <a href="investments.html">View all ↗</a>
              </div>
              ${requests.length
                ? `<ul class="ns-record-list">
                    ${requests.slice(0, 4).map(item => `
                      <li>
                        <div class="ns-record-main">
                          <strong>${esc(item.plans?.name || 'Investment plan')}</strong>
                          <span>${esc(date(item.created_at))}</span>
                        </div>
                        <div class="ns-record-meta">
                          <strong>${money(item.requested_amount, item.asset || 'USDT')}</strong>
                          ${status(item.status)}
                        </div>
                      </li>
                    `).join('')}
                  </ul>`
                : '<div class="ns-empty-compact">No investment applications have been submitted.</div>'}
            </section>

            <section class="ns-dashboard-section">
              <div class="ns-section-heading">
                <div>
                  <p class="eyebrow">FUNDING ACTIVITY</p>
                  <h3>Recent deposits</h3>
                </div>
                <a href="deposit-history.html">View history ↗</a>
              </div>
              ${(d.deposits || []).length
                ? `<ul class="ns-record-list">
                    ${d.deposits.slice(0, 4).map(item => `
                      <li>
                        <div class="ns-record-main">
                          <strong>${money(item.amount, item.asset || 'USDT')}</strong>
                          <span>${esc(date(item.created_at))}</span>
                        </div>
                        <div class="ns-record-meta">${status(item.status)}</div>
                      </li>
                    `).join('')}
                  </ul>`
                : '<div class="ns-empty-compact">No recent deposit requests.</div>'}
            </section>
          </div>

          <div class="ns-dashboard-columns ns-activity-columns">
            <section class="ns-dashboard-section">
              <div class="ns-section-heading">
                <div>
                  <p class="eyebrow">WITHDRAWAL ACTIVITY</p>
                  <h3>Recent withdrawals</h3>
                </div>
                <a href="withdrawals.html">View requests ↗</a>
              </div>
              ${(d.withdrawals || []).length
                ? `<ul class="ns-record-list">
                    ${d.withdrawals.slice(0, 4).map(item => `
                      <li>
                        <div class="ns-record-main">
                          <strong>${money(item.amount, item.asset || 'USDT')}</strong>
                          <span>${esc(date(item.created_at))}</span>
                        </div>
                        <div class="ns-record-meta">${status(item.status)}</div>
                      </li>
                    `).join('')}
                  </ul>`
                : '<div class="ns-empty-compact">No recent withdrawal requests.</div>'}
            </section>

            <section class="ns-dashboard-section">
              <div class="ns-section-heading">
                <div>
                  <p class="eyebrow">ACCOUNT HISTORY</p>
                  <h3>Recent transactions</h3>
                </div>
                <a href="transactions.html">Full history ↗</a>
              </div>
              ${(d.transactions || []).length
                ? `<ul class="ns-record-list">
                    ${d.transactions.slice(0, 5).map(item => `
                      <li>
                        <div class="ns-record-main">
                          <strong>${esc(transactionLabel(item))}</strong>
                          <span>${esc(date(item.created_at))}</span>
                        </div>
                        <div class="ns-record-meta">
                          <strong>${money(item.amount, item.asset || 'USDT')}</strong>
                          ${status(item.status)}
                        </div>
                      </li>
                    `).join('')}
                  </ul>`
                : '<div class="ns-empty-compact">Your account transactions will appear here.</div>'}
            </section>
          </div>

          <section class="ns-dashboard-section ns-referral-section">
            <div class="ns-section-heading">
              <div>
                <p class="eyebrow">PRIVATE NETWORK</p>
                <h3>Your referral details</h3>
              </div>
              <a href="partner-program.html">Referral programme ↗</a>
            </div>
            <div id="dashboard-referral-content"><p class="muted">Loading referral details…</p></div>
          </section>
        </div>`;

      referralPromise.then(referral => {
        const target = $('#dashboard-referral-content', main);
        const referralCode = String(referral?.referral_code || '');
        if (!target) return;
        if (!referralCode) {
          target.innerHTML = '<p class="muted">Referral details are currently unavailable.</p>';
          return;
        }

        const referralUrl = new URL('../pages/register.html', location.href);
        referralUrl.searchParams.set('ref', referralCode);
        target.innerHTML = `<div class="referral-overview">
          <div><span>Referral score</span><strong>${Number(referral.referral_score || 0).toLocaleString()}</strong></div>
          <div class="dashboard-referral-code-field"><label for="dashboard-referral-code">Your referral code</label><input id="dashboard-referral-code" class="referral-code-input" readonly value="${esc(referralCode)}"></div>
        </div>
        <label class="field dashboard-referral-link-field"><span>Invite link</span><input id="dashboard-referral-link" type="url" readonly value="${esc(referralUrl.href)}"></label>
        <div class="actions">
          <button class="btn btn-outline small-btn" id="copy-dashboard-referral-code" type="button">Copy code</button>
          <button class="btn btn-outline small-btn" id="copy-dashboard-referral-link" type="button">Copy invite link</button>
        </div>
        <div id="dashboard-referral-message" aria-live="polite"></div>`;

        const copyReferralField = async selector => {
          const field = $(selector, main);
          try {
            await navigator.clipboard.writeText(field.value);
            $('#dashboard-referral-message', main).innerHTML = notice('Copied to clipboard.', 'success');
          } catch {
            field.focus();
            field.select();
            $('#dashboard-referral-message', main).innerHTML = notice('The value is selected. Copy it to continue.', 'error');
          }
        };

        $('#copy-dashboard-referral-code', main).addEventListener('click', () => copyReferralField('#dashboard-referral-code'));
        $('#copy-dashboard-referral-link', main).addEventListener('click', () => copyReferralField('#dashboard-referral-link'));
      });

      marketPromise.then(marketData => {
        const tickers = marketData?.items || [];
        $('#market-ticker', main).innerHTML = tickers.map(coin => {
          const change = Number(coin.change_24h);
          const changeLabel = Number.isFinite(change)
            ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}% · 24h`
            : '24h change unavailable';

          return `<div class="ticker-item">
            <span>${esc(coin.name)} · ${esc(coin.symbol)}</span>
            <strong>${formatMarketPrice(coin.price_usd)}</strong>
            <em>${esc(changeLabel)}</em>
          </div>`;
        }).join('') || '<div class="empty-state">No market prices available.</div>';

        const message = !marketData
          ? 'Live market data is temporarily unavailable. Prices are not being displayed.'
          : marketData.stale
            ? 'Market provider unavailable. Showing previously fetched prices; they may be out of date.'
            : `Reference prices in USD | Source: CoinGecko | Updated ${new Date(marketData.fetched_at).toLocaleTimeString()}`;
        $('#market-notice', main).innerHTML = notice(message);
      });
    }

    else if (page === 'new-deposit') {
      const instructionsResult = await api('/api/payment-instructions');
      const methods = instructionsResult.items || [];
      const available = methods.filter(item => item.enabled !== false);
      const cryptoOptions = available.filter(item => item.method === 'crypto');
      const defaultCryptoAsset = cryptoOptions.find(item => item.asset === 'USDT')?.asset || cryptoOptions[0]?.asset || '';
      const bank = available.find(item => item.method === 'bank');

      main.innerHTML = `<div class="notice">
        Use only the payment instructions shown here. A request is not proof of payment; funds are credited only after manual reconciliation. The member ledger currently supports USDT only. Card payments are not enabled because no processor has been selected.
      </div>
      ${!available.length
        ? '<div class="empty-state" style="margin-top:20px">Deposit instructions are not available yet. Contact support.</div>'
        : `<div class="payment-layout">
            <div class="payment-instructions">
              ${available.map(item => item.method === 'crypto'
                ? `<article class="instruction-card">
                    <p class="eyebrow">CRYPTO TRANSFER · ${esc(item.network)}</p>
                    <h2>Send ${esc(paymentAssetLabel(item.asset || 'USDT'))}</h2>
                    <p>Only send the selected asset using the exact network shown. Transfers on the wrong network may be unrecoverable.</p>
                    <div class="copy-field">
                      <code>${esc(item.wallet_address)}</code>
                      <button class="btn btn-outline small-btn" type="button" data-copy="${esc(item.wallet_address)}">Copy</button>
                    </div>
                    ${item.instructions ? `<p>${esc(item.instructions)}</p>` : ''}
                  </article>`
                : `<article class="instruction-card">
                    <p class="eyebrow">BANK TRANSFER · ${esc(item.currency)}</p>
                    <h2>Transfer to our account</h2>
                    <dl class="instruction-list">
                      <dt>Bank</dt><dd>${esc(item.bank_name)}</dd>
                      <dt>Account name</dt><dd>${esc(item.account_name)}</dd>
                      <dt>Account number</dt><dd>${esc(item.account_number)}</dd>
                      ${item.iban ? `<dt>IBAN</dt><dd>${esc(item.iban)}</dd>` : ''}
                      ${item.swift_bic ? `<dt>SWIFT / BIC</dt><dd>${esc(item.swift_bic)}</dd>` : ''}
                    </dl>
                    ${item.instructions ? `<p>${esc(item.instructions)}</p>` : ''}
                  </article>`
              ).join('')}
            </div>

            <form id="deposit-form" class="form-card form-grid payment-request">
              <p class="eyebrow">NEW DEPOSIT REQUEST</p>
              <h2>Tell us about your transfer</h2>

              <div class="field">
                <label for="deposit-method">Payment method</label>
                <select name="payment_method" id="deposit-method" required>
                  ${cryptoOptions.length ? '<option value="crypto">Crypto transfer</option>' : ''}
                  ${bank ? `<option value="bank">Bank transfer (${esc(bank.currency)})</option>` : ''}
                </select>
              </div>

              ${cryptoOptions.length ? `<div class="field" id="deposit-asset-field">
                <label for="deposit-asset">Crypto asset</label>
                <select name="crypto_asset" id="deposit-asset" required>
                  ${cryptoOptions.map(item => `<option value="${esc(item.asset)}" ${item.asset === defaultCryptoAsset ? 'selected' : ''}>${esc(paymentAssetLabel(item.asset))}</option>`).join('')}
                </select>
              </div>` : ''}

              <div class="field">
                <label for="deposit-amount" id="deposit-amount-label">Amount</label>
                <input id="deposit-amount" name="amount" type="number" min="0.00000001" max="1000000" step="0.00000001" required>
              </div>

              <div class="field hidden" id="bank-amount-field">
                <label for="bank-payment-amount" id="payment-amount-label">Amount sent (${esc(bank?.currency || 'currency')})</label>
                <input id="bank-payment-amount" name="payment_amount" type="number" min="0.00000001" max="1000000" step="0.00000001">
              </div>

              <input name="payment_currency" id="payment-currency" type="hidden" value="${esc(defaultCryptoAsset || bank?.currency || '')}">

              <div class="field">
                <label for="deposit-reference">Transfer reference or transaction ID</label>
                <input id="deposit-reference" name="reference" maxlength="180">
              </div>

              <button class="btn btn-primary" type="submit">Submit for verification</button>
              <div id="form-message" aria-live="polite"></div>
            </form>
          </div>`}`;

      $('#deposit-method')?.addEventListener('change', e => {
        const isBank = e.currentTarget.value === 'bank';
        const selectedAsset = isBank
          ? ''
          : $('#deposit-asset')?.value || defaultCryptoAsset || 'USDT';
        const needsManualCredit = isBank || selectedAsset !== 'USDT';

        $('#deposit-asset-field')?.classList.toggle('hidden', isBank);
        $('#bank-amount-field').classList.toggle('hidden', !needsManualCredit);
        $('#bank-payment-amount').required = needsManualCredit;
        $('#deposit-amount-label').textContent = needsManualCredit
          ? 'Requested USDT credit (admin-confirmed)'
          : 'USDT amount sent';
        $('#payment-amount-label').textContent = isBank
          ? `Amount sent (${bank?.currency || 'currency'})`
          : `Amount sent (${selectedAsset})`;
        $('#payment-currency').value = isBank ? (bank?.currency || '') : selectedAsset;
      });

      $('#deposit-method')?.dispatchEvent(new Event('change'));
      $('#deposit-asset')?.addEventListener('change', () => {
        $('#deposit-method')?.dispatchEvent(new Event('change'));
      });

      main.querySelectorAll('[data-copy]').forEach(button => {
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(button.dataset.copy);
            button.textContent = 'Copied';
            setTimeout(() => button.textContent = 'Copy', 1500);
          } catch {
            $('#form-message').innerHTML = notice('Could not access clipboard. Select and copy the address manually.', 'error');
          }
        });
      });

      $('#deposit-form')?.addEventListener('reset', () => {
        setTimeout(() => $('#deposit-method')?.dispatchEvent(new Event('change')), 0);
      });

      $('#deposit-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const method = f.get('payment_method');
        const selectedAsset = method === 'crypto'
          ? $('#deposit-asset')?.value || defaultCryptoAsset || 'USDT'
          : 'USDT';
        const needsManualCredit = method === 'bank' || selectedAsset !== 'USDT';

        try {
          const r = await api('/api/deposits', {
            method: 'POST',
            body: JSON.stringify({
              amount: Number(f.get('amount')),
              asset: 'USDT',
              payment_method: method,
              payment_amount: needsManualCredit ? Number(f.get('payment_amount')) : null,
              payment_currency: method === 'bank' ? f.get('payment_currency') : selectedAsset,
              reference: f.get('reference') || null
            })
          });

          $('#form-message').innerHTML = notice(r.message, 'success');
          form.reset();
        } catch (err) {
          $('#form-message').innerHTML = notice(err.message, 'error');
        }
      });
    }

    else if (page === 'deposit-history') {
      const d = await api('/api/deposits');

      main.innerHTML = table(
        ['ID', 'Method', 'Payment reported', 'USDT requested', 'USDT credited', 'Status', 'Submitted'],
        d.items.map(item =>
          `<tr>
            <td>${esc(item.id)}</td>
            <td>${esc(item.payment_method || 'crypto')}</td>
            <td>${item.payment_amount ? money(item.payment_amount, item.payment_currency || item.asset) : '—'}</td>
            <td>${money(item.amount, item.asset)}</td>
            <td>${item.credited_amount ? money(item.credited_amount, 'USDT') : 'Pending review'}</td>
            <td>${status(item.status)}</td>
            <td>${esc(date(item.created_at))}</td>
          </tr>`
        )
      );
    }

    else if (page === 'withdrawals') {
      main.innerHTML = '<div class="notice">Loading your withdrawal information…</div>';

      try {
        const [withdrawalData, addressData] = await Promise.all([
          api('/api/withdrawals'),
          api('/api/member/withdrawal-addresses')
        ]);

        const withdrawals = withdrawalData.items || [];
        const addresses = addressData.items || [];

        const addressOptions = addresses.map(a => `
          <option value="${esc(a.id)}" data-address="${esc(a.wallet_address || a.address || '')}"
            data-network="${esc(a.network || 'TRC20')}"
            ${a.is_default ? 'selected' : ''}>
            ${esc(a.label || 'Saved address')} · ${esc(a.network || 'TRC20')} · ${esc((a.address || a.wallet_address || '').slice(0, 18))}
          </option>
        `).join('');

        main.innerHTML = `<section class="card">
          <div class="dashboard-topbar">
            <div>
              <p class="eyebrow">WITHDRAWALS</p>
              <h2>Withdraw funds</h2>

            </div>
            <button id="toggle-withdraw-form" class="btn btn-primary" type="button">Request withdrawal</button>
          </div>

          <div id="withdraw-form-panel" hidden>
            <form id="withdraw-form" class="form-card form-grid">
              <div class="notice">USDT only. Requests reserve the amount; transfers are completed separately.</div>

              <div class="field">
                <label>Amount (USDT)</label>
                <input name="amount" type="number" min="0.0001" step="0.0001" required>
              </div>

              <input name="asset" type="hidden" value="USDT">

              <div class="field">
                <label>Network</label>
                <select name="network" id="withdraw-network">
                  <option value="TRC20">TRC20</option>
                  <option value="ERC20">ERC20</option>
                  <option value="Ethereum">Ethereum</option>
                </select>
              </div>

              <div class="field">
                <label>Saved destination address</label>
                <select id="saved-withdraw-address" aria-label="Choose a saved destination wallet">
                  <option value="">Enter an address manually</option>
                  ${addressOptions}
                </select>
              </div>

              <div class="field">
                <label>Destination wallet address</label>
                <input name="wallet_address" id="withdraw-wallet-address" minlength="8" maxlength="220" autocomplete="off" required>
              </div>

              <button class="btn btn-primary" type="submit">Submit withdrawal request</button>
              <button class="btn btn-outline" id="cancel-withdraw-form" type="button">Cancel</button>
              <div id="withdraw-form-message" aria-live="polite"></div>
            </form>
          </div>
        </section>

        <section class="card" style="margin-top:24px">
          <h2>Save a withdrawal address</h2>
          <p class="muted">Save an address for future requests. Always confirm the network and address with your wallet provider.</p>

          <form id="save-withdraw-address-form" class="form-grid">
            <div class="field">
              <label>Label</label>
              <input name="label" maxlength="60" placeholder="e.g. My USDT wallet" required>
            </div>

            <div class="field">
              <label>Network</label>
              <select name="network">
                <option value="TRC20">TRC20</option>
                <option value="ERC20">ERC20</option>
                <option value="Ethereum">Ethereum</option>
              </select>
            </div>

            <div class="field">
              <label>Wallet address</label>
              <input name="address" minlength="8" maxlength="220" autocomplete="off" required>
            </div>

            <label><input name="is_default" type="checkbox"> Use as my default address</label>
            <button class="btn btn-outline" type="submit">Save address</button>
            <div id="save-address-message" aria-live="polite"></div>
          </form>

          <div style="margin-top:16px">
            ${addresses.length
              ? `<p class="eyebrow">SAVED ADDRESSES</p>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Label</th><th>Network</th><th>Address</th><th>Default</th></tr></thead>
                    <tbody>
                      ${addresses.map(a =>
                        `<tr>
                          <td>${esc(a.label || 'Saved address')}</td>
                          <td>${esc(a.network || '?')}</td>
                          <td>${esc(a.address || a.wallet_address || '?')}</td>
                          <td>${a.is_default ? 'Yes' : 'No'}</td>
                        </tr>`
                      ).join('')}
                    </tbody>
                  </table>
                </div>`
              : '<p class="muted">You have not saved any addresses yet.</p>'}
          </div>
        </section>

        <section style="margin-top:32px">
          <h2>Your withdrawal requests</h2>
          ${rows(withdrawals, [
            ['id', 'Reference'],
            ['amount', 'Amount'],
            ['asset', 'Asset'],
            ['status', 'Status'],
            ['created_at', 'Submitted']
          ])}
        </section>`;

        const panel = $('#withdraw-form-panel');

        $('#toggle-withdraw-form').addEventListener('click', () => {
          panel.hidden = !panel.hidden;
          $('#toggle-withdraw-form').textContent = panel.hidden ? 'Request withdrawal' : 'Hide form';
        });

        $('#cancel-withdraw-form').addEventListener('click', () => {
          panel.hidden = true;
          $('#toggle-withdraw-form').textContent = 'Request withdrawal';
        });

        $('#saved-withdraw-address').addEventListener('change', e => {
          const option = e.currentTarget.selectedOptions[0];
          $('#withdraw-wallet-address').value = option?.dataset.address || '';
          const network = option?.dataset.network;
          if (option?.value && network) $('#withdraw-network').value = network;
        });

        $('#saved-withdraw-address').dispatchEvent(new Event('change'));

        $('#save-withdraw-address-form').addEventListener('submit', async e => {
          e.preventDefault();

          const form = e.currentTarget;
          const f = new FormData(form);
          const message = $('#save-address-message');
          const button = form.querySelector('button[type="submit"]');

          button.disabled = true;

          try {
            const result = await api('/api/member/withdrawal-addresses', {
              method: 'POST',
              body: JSON.stringify({
                label: String(f.get('label') || '').trim(),
                network: f.get('network'),
                wallet_address: String(f.get('address') || '').trim(),
                is_default: f.has('is_default')
              })
            });

            message.innerHTML = notice(result.message || 'Address saved.', 'success');
            setTimeout(() => memberPage('withdrawals'), 500);
          } catch (err) {
            message.innerHTML = notice(err.message || 'Could not save this address.', 'error');
            button.disabled = false;
          }
        });

        $('#withdraw-form').addEventListener('submit', async e => {
          e.preventDefault();

          const form = e.currentTarget;
          const f = new FormData(form);
          const button = form.querySelector('button[type="submit"]');
          const message = $('#withdraw-form-message');

          button.disabled = true;

          try {
            const result = await api('/api/withdrawals', {
              method: 'POST',
              body: JSON.stringify({
                amount: Number(f.get('amount')),
                asset: 'USDT',
                network: f.get('network'),
                wallet_address: String(f.get('wallet_address') || '').trim()
              })
            });

            message.innerHTML = notice(result.message || 'Withdrawal request submitted for review.', 'success');
            setTimeout(() => memberPage('withdrawals'), 700);
          } catch (err) {
            message.innerHTML = notice(err.message || 'Could not submit your withdrawal request.', 'error');
            button.disabled = false;
          }
        });
      } catch (err) {
        main.innerHTML = `<div class="notice">${esc(err.message || 'Could not load withdrawal information. Please try again.')}</div>`;
      }
    }

    else if (page === 'transactions') {
      const d = await api('/api/transactions');
      main.innerHTML = rows(d.items, [
        ['kind', 'Type'],
        ['amount', 'Amount'],
        ['asset', 'Asset'],
        ['status', 'Status'],
        ['reference', 'Reference'],
        ['created_at', 'Date']
      ]);
    }

    else if (page === 'investments') {
      main.innerHTML = '<div class="notice">Loading investment plans and your requests…</div>';

      try {
        const [plansData, requestsData, contractsData] = await Promise.all([
          api('/api/plans'),
          api('/api/member/investment-requests'),
          api('/api/member/contracts')
        ]);

        const plans = plansData.items || [];
        const requests = requestsData.items || [];
        const contracts = contractsData.items || [];

        const planCards = plans.length
          ? plans.map(p => `<article class="card investment-plan">
              <p class="eyebrow">INVESTMENT PLAN</p>
              <h3>${esc(p.name || 'Investment plan')}</h3>
              <p>${esc(p.description || 'Review the plan details before submitting a request.')}</p>

              <div class="investment-plan-meta">
                <span>Minimum</span><strong>${money(Number(p.minimum_amount || 0), 'USDT')}</strong>
                <span>Maximum</span><strong>${money(Number(p.maximum_amount || 0), 'USDT')}</strong>
                <span>Duration</span><strong>${p.contract_duration_days ? `${Number(p.contract_duration_days)} days` : 'Not specified'}</strong>
              </div>

              ${p.terms ? `<p class="muted">${esc(p.terms)}</p>` : ''}

              <form class="investment-request-form form-grid" data-plan-id="${esc(p.id)}">
                <div class="field">
                  <label>Amount (USDT)</label>
                  <input name="amount" type="number" min="${Number(p.minimum_amount || 0)}" max="${Number(p.maximum_amount || 0)}" step="0.01" required>
                </div>

                <div class="field">
                  <label>Note (optional)</label>
                  <input name="member_note" maxlength="500" placeholder="Anything the reviewer should know">
                </div>

                <button class="btn btn-primary" type="submit">Request this plan</button>
                <div class="form-message" aria-live="polite"></div>
              </form>
            </article>`).join('')
          : '<div class="notice">There are no active plans available right now.</div>';

        const requestRows = requests.length
          ? requests.map(r => `<tr>
              <td>${esc(r.plan_name || r.plans?.name || 'Investment plan')}</td>
              <td>${money(Number(r.requested_amount || 0), 'USDT')}</td>
              <td>${status(r.status || 'pending')}</td>
              <td>${esc(r.member_note || '?')}</td>
              <td>${date(r.created_at)}</td>
              <td>${esc(r.admin_note || '?')}</td>
            </tr>`).join('')
          : '<tr><td colspan="6">You have not submitted any plan requests yet.</td></tr>';

        const contractCards = contracts.length
          ? contracts.map(c => {
              const principal = Number(c.principal_amount ?? c.principal ?? 0);
              const returns = Number(c.total_return ?? c.return_amount ?? 0);
              const currentValue = Number(c.current_value ?? (principal + returns));

              return `<article class="card">
                <div class="dashboard-topbar">
                  <div>
                    <p class="eyebrow">CONTRACT</p>
                    <h3>${esc(c.plan_name || c.plan?.name || 'Investment contract')}</h3>
                  </div>
                  ${status(c.status || 'active')}
                </div>

                <div class="investment-plan-meta">
                  <span>Principal</span><strong>${money(principal, 'USDT')}</strong>
                  <span>Recorded returns</span><strong>${money(returns, 'USDT')}</strong>
                  <span>Current value</span><strong>${money(currentValue, 'USDT')}</strong>
                  <span>Start date</span><strong>${date(c.start_date || c.created_at)}</strong>
                  <span>End date</span><strong>${c.end_date ? date(c.end_date) : 'Not specified'}</strong>
                </div>
              </article>`;
            }).join('')
          : '<div class="notice">No active contracts.</div>';

        main.innerHTML = `<section>
          <p class="eyebrow">PLANS & REQUESTS</p>
          <h2>Explore investment plans</h2>

          <div class="investment-plan-grid">${planCards}</div>
        </section>

        <section style="margin-top:36px">
          <p class="eyebrow">YOUR ACTIVITY</p>
          <h2>Plan requests</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Plan</th><th>Amount</th><th>Status</th><th>Your note</th><th>Submitted</th><th>Admin note</th></tr></thead>
              <tbody>${requestRows}</tbody>
            </table>
          </div>
        </section>

        <section style="margin-top:36px">
          <p class="eyebrow">APPROVED PLANS</p>
          <h2>Your contracts</h2>
          <div class="investment-contract-grid">${contractCards}</div>
        </section>`;

        $$('.investment-request-form').forEach(form => {
          form.addEventListener('submit', async e => {
            e.preventDefault();

            const button = form.querySelector('button[type="submit"]');
            const message = form.querySelector('.form-message');
            const data = new FormData(form);
            const amount = Number(data.get('amount'));
            const plan = plans.find(p => String(p.id) === String(form.dataset.planId));

            if (
              !plan ||
              !Number.isFinite(amount) ||
              amount < Number(plan.minimum_amount) ||
              amount > Number(plan.maximum_amount)
            ) {
              message.innerHTML = notice('Enter an amount within this plan’s minimum and maximum.', 'error');
              return;
            }

            button.disabled = true;

            try {
              const result = await api('/api/member/investment-requests', {
                method: 'POST',
                body: JSON.stringify({
                  plan_id: form.dataset.planId,
                  requested_amount: amount,
                  member_note: String(data.get('member_note') || '').trim()
                })
              });

              message.innerHTML = notice(result.message || 'Your request has been submitted for admin review.', 'success');
              form.reset();
              setTimeout(() => memberPage('investments'), 500);
            } catch (err) {
              message.innerHTML = notice(err.message || 'Could not submit your request.', 'error');
              button.disabled = false;
            }
          });
        });
      } catch (err) {
        main.innerHTML = `<div class="notice">${esc(err.message || 'Could not load investment information. Please try again.')}</div>`;
      }
    }

    else if (page === 'partner-program') {
      try {
        const referral = await api('/api/member/referrals');
        const referralCode = String(referral.referral_code || '');
        const referralUrl = new URL('../pages/register.html', location.href);
        referralUrl.searchParams.set('ref', referralCode);

        main.innerHTML = `<div class="referral-dashboard">
          <section class="card referral-score-card">
            <p class="eyebrow">YOUR REFERRAL SCORE</p>
            <strong>${Number(referral.referral_score || 0).toLocaleString()}</strong>

          </section>
          <section class="card referral-share-card">
            <p class="eyebrow">YOUR REFERRAL CODE</p>
            <strong class="referral-code">${esc(referralCode)}</strong>
            <label class="field">
              <span>Invite link</span>
              <input id="referral-link" type="url" readonly value="${esc(referralUrl.href)}">
            </label>
            <div class="actions">
              <button class="btn btn-primary" id="copy-referral-link" type="button">Copy invite link</button>
              <button class="btn btn-outline" id="copy-referral-code" type="button">Copy code</button>
            </div>
            <div id="referral-copy-message" aria-live="polite"></div>
          </section>
        </div>`;

        const copyReferralValue = async value => {
          try {
            await navigator.clipboard.writeText(value);
            $('#referral-copy-message').innerHTML = notice('Copied to clipboard.', 'success');
          } catch {
            const input = $('#referral-link');
            input.focus();
            input.select();
            $('#referral-copy-message').innerHTML = notice('Clipboard unavailable. The invite link is selected for copying.', 'error');
          }
        };

        $('#copy-referral-link').addEventListener('click', () => copyReferralValue(referralUrl.href));
        $('#copy-referral-code').addEventListener('click', () => copyReferralValue(referralCode));
      } catch (error) {
        main.innerHTML = `<div class="notice">${esc(error.message || 'Could not load your referral details.')}</div>`;
      }
    }

    else if (page === 'profile') {
      main.innerHTML = '<div class="notice">Loading your profile…</div>';

      try {
        const [meData, kycData] = await Promise.all([
          getMemberProfile(),
          api('/api/kyc/documents')
        ]);

        const profile = meData.profile || {};
        const documents = kycData.items || [];
        const profileImageUrl = typeof profile.profile_image_url === 'string' && /^https:\/\//i.test(profile.profile_image_url)
          ? profile.profile_image_url
          : null;
        const profileInitial = String(profile.display_name || profile.full_name || profile.email || 'U').trim().slice(0, 1).toUpperCase();
        const kycStatus = String(profile.kyc_status || 'not_submitted').toLowerCase();

        const kycLabels = {
          not_submitted: 'Not submitted',
          pending_review: 'Under review',
          approved: 'Approved',
          rejected: 'Action required'
        };

        const kycLabel = kycLabels[kycStatus] || 'Not submitted';
        const kycLocked = ['pending_review', 'approved'].includes(kycStatus);

        const documentRows = documents.length
          ? documents.map(doc => {
              const rawLink = doc.signed_url || doc.signedUrl || doc.url || doc.signedURL;
              const link = typeof rawLink === 'string' && /^https:\/\//i.test(rawLink)
                ? rawLink
                : null;

              return `<tr>
                <td>${esc(doc.document_type || 'Document')}</td>
                <td>${esc(doc.original_filename || doc.filename || doc.file_name || 'Uploaded file')}</td>
                <td>${date(doc.created_at || doc.uploaded_at)}</td>
                <td>${link
                  ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">View file</a>`
                  : 'Stored privately'}</td>
              </tr>`;
            }).join('')
          : '<tr><td colspan="4">No documents uploaded yet.</td></tr>';

        main.innerHTML = `<section class="card">
          <p class="eyebrow">ACCOUNT SETTINGS</p>
          <h2>Your profile</h2>


          <form id="profile-form" class="form-card form-grid">
            <div class="field">
              <label>Email address</label>
              <input value="${esc(profile.email || '')}" disabled>
            </div>

            <div class="field">
              <label>Display name</label>
              <input name="display_name" maxlength="80" value="${esc(profile.display_name || profile.full_name || '')}" placeholder="Name shown around your account">
            </div>

            <div class="field">
              <label>Full name</label>
              <input name="full_name" maxlength="120" value="${esc(profile.full_name || '')}" autocomplete="name">
            </div>

            <div class="field">
              <label>Phone number</label>
              <input name="phone" maxlength="40" value="${esc(profile.phone || '')}" autocomplete="tel">
            </div>

            <button class="btn btn-primary" type="submit">Save profile</button>
            <div id="profile-message" aria-live="polite"></div>
          </form>
        </section>

        <section class="card" style="margin-top:24px">
          <p class="eyebrow">PROFILE PHOTO</p>
          <h2>Personalise your account</h2>

          <div id="profile-image-preview" class="profile-image-preview">
            ${profileImageUrl
              ? `<img src="${esc(profileImageUrl)}" alt="Your profile photo">`
              : `<span aria-label="Profile photo placeholder">${esc(profileInitial)}</span>`}
          </div>

          <form id="profile-image-form" class="form-grid">
            <div class="field">
              <label>Choose an image</label>
              <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
              <small class="muted">JPG, PNG or WEBP · Max 10 MB</small>
            </div>

            <button class="btn btn-outline" type="submit">Upload photo</button>
            <div id="profile-image-message" aria-live="polite"></div>
          </form>
        </section>

        <section class="card" style="margin-top:24px">
          <div class="dashboard-topbar">
            <div>
              <p class="eyebrow">IDENTITY DOCUMENTS</p>
              <h2>KYC documents</h2>
            </div>
            <span class="chip">${esc(kycLabel)}</span>
          </div>

          <p class="muted">
            Upload one identity document and one proof-of-address document.
            Accepted formats are JPG, PNG, WEBP, and PDF. Maximum file size: 10 MB.
          </p>

          ${kycStatus === 'pending_review' ? `
            <div class="notice">
              Your documents have been submitted and are awaiting administrator review.
              You cannot upload additional documents while this review is in progress.
            </div>
          ` : ''}

          ${kycStatus === 'approved' ? `
            <div class="notice">
              Your KYC application has been approved. Document uploads are currently locked.
            </div>
          ` : ''}

          ${kycStatus === 'rejected' ? `
            <div class="notice">
              Your previous KYC application was rejected.
              ${profile.kyc_review_note
                ? `<p><strong>Review feedback:</strong> ${esc(profile.kyc_review_note)}</p>`
                : 'Please review your documents and upload replacements.'}
              Upload both required document categories again to resubmit.
            </div>
          ` : ''}

          ${!kycLocked ? `
            <form id="kyc-upload-form" class="form-grid">
              <div class="field">
                <label>Document type</label>
                <select name="document_type" required>
                  <option value="identity">Identity document</option>
                  <option value="address">Proof of address</option>
                  <option value="other">Other supporting document</option>
                </select>
              </div>

              <div class="field">
                <label>Select document</label>
                <input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required>
              </div>

              <button class="btn btn-primary" type="submit">Upload document</button>
              <div id="kyc-message" aria-live="polite"></div>
            </form>
          ` : ''}

          <div style="margin-top:20px">
            <h3>Uploaded documents</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Type</th><th>File</th><th>Uploaded</th><th>Access</th></tr>
                </thead>
                <tbody>${documentRows}</tbody>
              </table>
            </div>
          </div>

          <p class="muted" style="margin-top:16px">
            Approval records the administrator's decision. It does not independently
            establish document authenticity unless a separate verification process is performed.
          </p>
        </section>`;

        $('#profile-form').addEventListener('submit', async e => {
          e.preventDefault();

          const form = e.currentTarget;
          const f = new FormData(form);
          const button = form.querySelector('button[type="submit"]');

          button.disabled = true;

          try {
            await api('/api/me', {
              method: 'PATCH',
              body: JSON.stringify({
                display_name: String(f.get('display_name') || '').trim(),
                full_name: String(f.get('full_name') || '').trim(),
                phone: String(f.get('phone') || '').trim()
              })
            });

            $('#profile-message').innerHTML = notice('Profile updated successfully.', 'success');
          } catch (err) {
            $('#profile-message').innerHTML = notice(err.message || 'Could not update your profile.', 'error');
          } finally {
            button.disabled = false;
          }
        });

        $('#profile-image-form').addEventListener('submit', async e => {
          e.preventDefault();

          const form = e.currentTarget;
          const file = form.querySelector('input[type="file"]').files[0];
          const message = $('#profile-image-message');
          const button = form.querySelector('button[type="submit"]');

          if (!file) return;

          if (file.size > 10 * 1024 * 1024) {
            message.innerHTML = notice('The image must be 10 MB or smaller.', 'error');
            return;
          }

          button.disabled = true;

          try {
            const body = new FormData();
            body.append('file', file);

            const result = await api('/api/me/profile-image', {
              method: 'POST',
              body
            });

            message.innerHTML = notice(result.message || 'Profile photo uploaded.', 'success');
            if (typeof result.profile_image_url === 'string' && /^https:\/\//i.test(result.profile_image_url)) {
              $('#profile-image-preview').innerHTML = `<img src="${esc(result.profile_image_url)}" alt="Your profile photo">`;
              const profileData = await getMemberProfile();
              profileData.profile = { ...profileData.profile, profile_image_url: result.profile_image_url };
              memberProfilePromise = Promise.resolve(profileData);
              renderNavProfile(profileData.profile);
            }
            form.reset();
          } catch (err) {
            message.innerHTML = notice(err.message || 'Could not upload the profile photo.', 'error');
          } finally {
            button.disabled = false;
          }
        });

        // FIX: This form is absent when KYC is pending_review or approved.
        // Optional chaining prevents addEventListener from being called on null.
        const kycUploadForm = $('#kyc-upload-form');

        kycUploadForm?.addEventListener('submit', async e => {
          e.preventDefault();

          const form = e.currentTarget;
          const file = form.querySelector('input[type="file"]').files[0];
          const message = $('#kyc-message');
          const button = form.querySelector('button[type="submit"]');

          if (!file) return;

          if (file.size > 10 * 1024 * 1024) {
            message.innerHTML = notice('The document must be 10 MB or smaller.', 'error');
            return;
          }

          button.disabled = true;

          try {
            const body = new FormData();
            body.append('document_type', form.querySelector('[name="document_type"]').value);
            body.append('file', file);

            const result = await api('/api/kyc/documents', {
              method: 'POST',
              body
            });

            message.innerHTML = notice(result.message || 'Document uploaded successfully.', 'success');
            setTimeout(() => memberPage('profile'), 700);
          } catch (err) {
            message.innerHTML = notice(err.message || 'Could not upload the document.', 'error');
            button.disabled = false;
          }
        });

      } catch (err) {
        main.innerHTML = `<div class="notice">${esc(err.message || 'Could not load your profile. Please try again.')}</div>`;
      }
    }

    else if (page === 'admin-overview') {
      const d = await api('/api/admin/overview');

      main.innerHTML = `<div class="grid grid-3 admin-overview-grid">
        <a class="admin-overview-card" href="users.html" aria-label="View registered users">
          <article class="card stat-card">
          <p>Registered users</p>
          <strong>${d.users}</strong>
            <span>View users <span aria-hidden="true">→</span></span>
          </article>
        </a>
        <a class="admin-overview-card" href="deposits.html?status=pending" aria-label="Review pending deposits">
          <article class="card stat-card">
          <p>Pending deposits</p>
          <strong>${d.pending_deposits}</strong>
            <span>Review deposits <span aria-hidden="true">→</span></span>
          </article>
        </a>
        <a class="admin-overview-card" href="withdrawals.html?status=pending" aria-label="Review pending withdrawals">
          <article class="card stat-card">
          <p>Pending withdrawals</p>
          <strong>${d.pending_withdrawals}</strong>
            <span>Review withdrawals <span aria-hidden="true">→</span></span>
          </article>
        </a>
        <a class="admin-overview-card" href="withdrawals.html?status=approved" aria-label="Record approved withdrawals awaiting transfer">
          <article class="card stat-card">
          <p>Approved withdrawals awaiting transfer</p>
          <strong>${d.approved_withdrawals}</strong>
            <span>Record transfers <span aria-hidden="true">→</span></span>
          </article>
        </a>
      </div>
      <div class="notice" style="margin-top:20px">
        Verify incoming payments before approval. Mark withdrawals completed only after transfer.
      </div>`;
    }

    else if (page === 'admin-users') {
      const d = await api('/api/admin/users');

      main.innerHTML = `<div class="notice">

      </div>
      <div class="table-wrap" style="margin-top:20px">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Current balance</th>
              <th>Set balance (USDT)</th>
              <th>Reason (required)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${d.items.map(user => {
              const wallet = Array.isArray(user.wallets) ? user.wallets[0] : user.wallets;
              const balance = wallet?.balance ?? 0;
              const asset = wallet?.asset || 'USDT';

              return `<tr>
                <td>${esc(user.email || user.id)}<br><small>${esc(user.full_name || '')}</small></td>
                <td>${esc(user.role)}</td>
                <td><span data-current-balance="${esc(user.id)}">${money(balance, asset)}</span></td>
                <td colspan="3">
                  <form class="actions balance-edit-form" data-user-id="${esc(user.id)}">
                    <input aria-label="New balance for ${esc(user.email || user.id)}" name="balance" type="number" min="0" max="999999999999.99999999" step="0.00000001" value="${esc(balance)}" required>
                    <input aria-label="Reason for balance change" name="reason" type="text" maxlength="500" minlength="3" placeholder="Reason for adjustment" required>
                    <button class="btn btn-outline small-btn" type="submit">Set balance</button>
                    <span id="balance-message-${esc(user.id)}" aria-live="polite"></span>
                  </form>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

      main.querySelectorAll('.balance-edit-form').forEach(form => {
        form.addEventListener('submit', async event => {
          event.preventDefault();

          const fields = new FormData(form);
          const userId = form.dataset.userId;
          const message = $(`#balance-message-${CSS.escape(userId)}`);
          const button = $('button[type="submit"]', form);

          button.disabled = true;

          try {
            const result = await api(`/api/admin/users/${encodeURIComponent(userId)}/balance`, {
              method: 'PUT',
              body: JSON.stringify({
                balance: fields.get('balance'),
                reason: fields.get('reason')
              })
            });

            const item = result.item;
            const current = $(`[data-current-balance="${CSS.escape(userId)}"]`);

            if (current && item) {
              current.textContent = money(item.balance, item.asset || 'USDT');
            }

            message.innerHTML = notice(result.message, 'success');
          } catch (error) {
            message.innerHTML = notice(error.message || 'Balance could not be updated.', 'error');
          } finally {
            button.disabled = false;
          }
        });
      });
    }

    else if (page === 'admin-kyc') {
      let currentFilter = 'pending_review';

      const renderKycQueue = async (filter = currentFilter) => {
        currentFilter = filter;
        main.innerHTML = '<div class="loading">Loading KYC applications…</div>';

        try {
          const d = await api(`/api/admin/kyc?status=${encodeURIComponent(filter)}`);
          const items = d.items || [];

          const documentLink = doc => {
            const url = doc.signed_url;

            // Signed document links must use HTTPS.
            if (!url || !/^https:\/\//i.test(url)) {
              return '<span class="muted">Unavailable</span>';
            }

            return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">View document ↗</a>`;
          };

          const documentRows = docs => {
            if (!docs?.length) {
              return '<p class="muted">No documents available.</p>';
            }

            return `<div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Document</th><th>Filename</th><th>Uploaded</th><th>File</th></tr>
                </thead>
                <tbody>
                  ${docs.map(doc => `<tr>
                    <td>${esc(doc.document_type || 'Document')}</td>
                    <td>${esc(doc.original_filename || 'Uploaded file')}</td>
                    <td>${esc(date(doc.created_at) || '—')}</td>
                    <td>${documentLink(doc)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
          };

          main.innerHTML = `<div class="card" style="margin-bottom:24px">
            <div class="dashboard-topbar">
              <div>
                <p class="eyebrow">IDENTITY VERIFICATION</p>
                <h2>KYC applications</h2>

              </div>
              <span class="chip">${items.length} records</span>
            </div>

            <div class="field" style="max-width:320px;margin-top:18px">
              <label for="kyc-status-filter">Filter applications</label>
              <select id="kyc-status-filter">
                <option value="pending_review" ${filter === 'pending_review' ? 'selected' : ''}>Pending review</option>
                <option value="approved" ${filter === 'approved' ? 'selected' : ''}>Approved</option>
                <option value="rejected" ${filter === 'rejected' ? 'selected' : ''}>Rejected</option>
                <option value="not_submitted" ${filter === 'not_submitted' ? 'selected' : ''}>Not submitted</option>
                <option value="all" ${filter === 'all' ? 'selected' : ''}>All applications</option>
              </select>
            </div>
          </div>

          ${items.length
            ? items.map(item => {
                const profile = item.profile || {};
                const docs = item.documents || [];
                const pending = profile.kyc_status === 'pending_review';

                return `<article class="card" style="margin-bottom:24px">
                  <div class="dashboard-topbar">
                    <div>
                      <p class="eyebrow">MEMBER APPLICATION</p>
                      <h2>${esc(profile.full_name || profile.display_name || 'Unnamed member')}</h2>
                      <p class="muted">${esc(profile.email || profile.id || '')}</p>
                    </div>
                    ${status(profile.kyc_status)}
                  </div>

                  <div class="grid grid-2" style="margin:20px 0">
                    <div>
                      <p class="muted">Phone</p>
                      <strong>${esc(profile.phone || 'Not provided')}</strong>
                    </div>
                    <div>
                      <p class="muted">Member since</p>
                      <strong>${esc(date(profile.created_at) || '—')}</strong>
                    </div>
                    <div>
                      <p class="muted">Submitted for review</p>
                      <strong>${esc(date(profile.kyc_submitted_at) || '—')}</strong>
                    </div>
                    <div>
                      <p class="muted">Last reviewed</p>
                      <strong>${esc(date(profile.kyc_reviewed_at) || 'Not reviewed')}</strong>
                    </div>
                  </div>

                  <div class="notice" style="margin-bottom:20px">
                    ${item.has_required_documents
                      ? 'Both required document categories are available.'
                      : 'One or more required document categories are missing.'}
                  </div>

                  <h3>Submitted documents</h3>
                  ${documentRows(docs)}

                  ${profile.kyc_review_note ? `
                    <div class="notice" style="margin-top:20px">
                      <strong>Review note</strong>
                      <p>${esc(profile.kyc_review_note)}</p>
                    </div>
                  ` : ''}

                  ${pending ? `
                    <div class="actions" style="margin-top:24px">
                      <button class="btn btn-primary" data-kyc-action="approved" data-user-id="${esc(profile.id)}">
                        Approve application
                      </button>
                      <button class="btn btn-outline" data-kyc-action="rejected" data-user-id="${esc(profile.id)}">
                        Reject application
                      </button>
                    </div>
                  ` : ''}

                  <p class="muted" style="margin-top:16px;font-size:12px">
                    Document links are private and expire after one hour. Opened documents should be reviewed securely.
                  </p>
                </article>`;
              }).join('')
            : '<div class="empty-state"><h2>No applications found</h2><p>There are no records for this status.</p></div>'}
          `;

          $('#kyc-status-filter').addEventListener('change', event => {
            renderKycQueue(event.target.value);
          });

          main.querySelectorAll('[data-kyc-action]').forEach(button => {
            button.addEventListener('click', async () => {
              const action = button.dataset.kycAction;
              const userId = button.dataset.userId;
              let note = '';

              if (action === 'rejected') {
                const reason = prompt('Enter the reason for rejecting this KYC application:');
                if (reason === null) return;

                note = reason.trim();

                if (!note) {
                  alert('A rejection reason is required.');
                  return;
                }
              } else {
                if (!confirm('Confirm that you have reviewed the documents and want to approve this application?')) {
                  return;
                }
              }

              button.disabled = true;

              try {
                const result = await api(`/api/admin/kyc/${encodeURIComponent(userId)}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ status: action, note })
                });

                alert(result.message || 'KYC review completed.');
                await renderKycQueue(currentFilter);
              } catch (error) {
                const message = error.message || 'The KYC decision could not be completed.';

                if (message.includes('audit record could not be written')) {
                  alert(`${message}\n\nThe decision was already saved. Check the audit logs before taking any further action.`);
                  await renderKycQueue(currentFilter);
                } else {
                  alert(message);
                  button.disabled = false;
                }
              }
            });
          });

        } catch (error) {
          main.innerHTML = `<div class="notice">${esc(error.message || 'Could not load KYC applications.')}</div>`;
        }
      };

      await renderKycQueue();
    }

    else if (page === 'admin-deposits') {
      const allowedStatuses = ['pending', 'approved', 'rejected', 'all'];
      const requestedStatus = new URLSearchParams(location.search).get('status');
      const selectedStatus = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'pending';
      const query = selectedStatus === 'all' ? '' : `?status=${encodeURIComponent(selectedStatus)}`;
      const d = await api(`/api/admin/deposits${query}`);

      main.innerHTML = `<div class="field admin-list-filter">
        <label for="admin-record-status">Deposit status</label>
        <select id="admin-record-status">
          ${allowedStatuses.map(value => `<option value="${value}" ${selectedStatus === value ? 'selected' : ''}>${value === 'all' ? 'All requests' : value[0].toUpperCase() + value.slice(1)}</option>`).join('')}
        </select>
      </div>` + table(
        ['User', 'Payment method', 'Payment reported', 'USDT requested', 'Status', 'Review'],
        d.items.map(x =>
          `<tr>
            <td>${esc(x.profiles?.email || x.user_id)}</td>
            <td>${esc(x.payment_method || 'crypto')} · ${esc(x.network)}</td>
            <td>${x.payment_amount ? money(x.payment_amount, x.payment_currency || x.asset) : '—'}<br><small>${esc(x.reference || 'No reference supplied')}</small></td>
            <td>${money(x.amount, 'USDT')}</td>
            <td>${status(x.status)}${x.credited_amount ? `<br><small>Credited ${money(x.credited_amount, 'USDT')}</small>` : ''}</td>
            <td>
              ${x.status === 'pending'
                ? `<div class="actions">
                    <button class="btn btn-primary small-btn" data-review="approved" data-id="${esc(x.id)}" data-method="${esc(x.payment_method || 'crypto')}" data-currency="${esc(x.payment_currency || 'USDT')}" data-amount="${esc(x.amount)}">Approve after reconciliation</button>
                    <button class="btn btn-outline small-btn" data-review="rejected" data-id="${esc(x.id)}" data-method="${esc(x.payment_method || 'crypto')}">Reject</button>
                  </div>`
                : '—'}
            </td>
          </tr>`
        )
      );

      $('#admin-record-status').addEventListener('change', event => {
        const url = new URL(location.href);
        url.searchParams.set('status', event.target.value);
        location.assign(url);
      });

      main.querySelectorAll('[data-review]').forEach(button => {
        button.addEventListener('click', async () => {
          const needsManualCredit = button.dataset.method === 'bank' || button.dataset.currency !== 'USDT';

          const credited = needsManualCredit && button.dataset.review === 'approved'
            ? prompt('Enter the verified USDT amount to credit after confirming receipt and conversion:')
            : null;

          if (needsManualCredit && button.dataset.review === 'approved' && credited === null) return;

          if (
            needsManualCredit &&
            button.dataset.review === 'approved' &&
            (!Number.isFinite(Number(credited)) || Number(credited) <= 0)
          ) {
            alert('Enter a valid USDT credit amount.');
            return;
          }

          const note = prompt('Reconciliation note (optional):');
          if (note === null) return;

          try {
            await api(`/api/admin/deposits/${button.dataset.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                status: button.dataset.review,
                note: note || null,
                credited_amount: button.dataset.review === 'approved'
                  ? (needsManualCredit ? Number(credited) : Number(button.dataset.amount))
                  : null
              })
            });

            await memberPage();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    }

    else if (page === 'admin-withdrawals') {
      const allowedStatuses = ['pending', 'approved', 'completed', 'rejected', 'all'];
      const requestedStatus = new URLSearchParams(location.search).get('status');
      const selectedStatus = allowedStatuses.includes(requestedStatus) ? requestedStatus : 'pending';
      const query = selectedStatus === 'all' ? '' : `?status=${encodeURIComponent(selectedStatus)}`;
      const d = await api(`/api/admin/withdrawals${query}`);

      main.innerHTML = `<div class="field admin-list-filter">
        <label for="admin-record-status">Withdrawal status</label>
        <select id="admin-record-status">
          ${allowedStatuses.map(value => `<option value="${value}" ${selectedStatus === value ? 'selected' : ''}>${value === 'all' ? 'All requests' : value[0].toUpperCase() + value.slice(1)}</option>`).join('')}
        </select>
      </div>` + table(
        ['User', 'Amount', 'Network', 'Wallet', 'Status', 'Review / transfer'],
        d.items.map(x =>
          `<tr>
            <td>${esc(x.profiles?.email || x.user_id)}</td>
            <td>${money(x.amount, x.asset)}</td>
            <td>${esc(x.network)}</td>
            <td><code>${esc(x.wallet_address)}</code></td>
            <td>${status(x.status)}</td>
            <td>
              ${x.status === 'pending'
                ? `<div class="actions">
                    <button class="btn btn-primary small-btn" data-review="approved" data-id="${esc(x.id)}">Approve</button>
                    <button class="btn btn-outline small-btn" data-review="rejected" data-id="${esc(x.id)}">Reject / refund</button>
                  </div>`
                : x.status === 'approved'
                  ? `<button class="btn btn-primary small-btn" data-review="completed" data-id="${esc(x.id)}">Mark transferred</button>`
                  : esc(x.review_note || '—')}
            </td>
          </tr>`
        )
      );

      $('#admin-record-status').addEventListener('change', event => {
        const url = new URL(location.href);
        url.searchParams.set('status', event.target.value);
        location.assign(url);
      });

      main.querySelectorAll('[data-review]').forEach(button => {
        button.addEventListener('click', async () => {
          const action = button.dataset.review;

          const promptText = action === 'completed'
            ? 'Confirm the USDT transfer is complete. Enter the transfer reference:'
            : 'Review note (optional):';

          const note = prompt(promptText);
          if (note === null) return;

          if (action === 'completed' && !note.trim()) {
            alert('A transfer reference is required to mark this withdrawal complete.');
            return;
          }

          try {
            await api(`/api/admin/withdrawals/${button.dataset.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: action, note: note || null })
            });

            await memberPage();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    }

    else if (page === 'admin-transactions') {
      const d = await api('/api/admin/transactions');
      main.innerHTML = rows(d.items, [
        ['kind', 'Type'],
        ['amount', 'Amount'],
        ['asset', 'Asset'],
        ['status', 'Status'],
        ['reference', 'Reference'],
        ['created_at', 'Date']
      ]);
    }

    else if (page === 'admin-audit') {
      const d = await api('/api/admin/audit-log');
      main.innerHTML = rows(d.items, [
        ['action', 'Action'],
        ['entity_type', 'Entity'],
        ['entity_id', 'Entity ID'],
        ['actor_id', 'Actor'],
        ['created_at', 'Date']
      ]);
    }

    else if (page === 'admin-plans') {
      const [d, requestData, contractData] = await Promise.all([
        api('/api/admin/plans'),
        api('/api/admin/investment-requests?status=pending'),
        api('/api/admin/contracts')
      ]);
      const requests = requestData.items || [];
      const contracts = contractData.items || [];

      main.innerHTML = `<form id="plan-form" class="form-card form-grid">
        <h2>Create a service category</h2>

        <div class="field">
          <label>Name</label>
          <input name="name" required maxlength="100">
        </div>

        <div class="field">
          <label>Description</label>
          <textarea name="description" maxlength="1000"></textarea>
        </div>

        <div class="field">
          <label>Minimum amount</label>
          <input name="minimum_amount" type="number" min="0.01" step="0.01" required>
        </div>

        <div class="field">
          <label>Maximum amount (optional)</label>
          <input name="maximum_amount" type="number" min="0.01" step="0.01">
        </div>

        <button class="btn btn-primary">Create category</button>
        <div id="form-message" aria-live="polite"></div>
      </form>

      <section class="plan-management-list" style="margin-top:32px">
        <h2>Manage investment plans</h2>
        ${d.items.length
          ? d.items.map(plan => `<form class="card plan-edit-form" data-plan-id="${esc(plan.id)}">
              <div class="plan-edit-fields">
                <div class="field">
                  <label>Plan name</label>
                  <input name="name" value="${esc(plan.name || '')}" maxlength="100" required>
                </div>
                <div class="field">
                  <label>Description</label>
                  <textarea name="description" maxlength="1000">${esc(plan.description || '')}</textarea>
                </div>
                <div class="field">
                  <label>Minimum amount</label>
                  <input name="minimum_amount" type="number" min="0.01" step="0.01" value="${esc(plan.minimum_amount)}" required>
                </div>
                <div class="field">
                  <label>Maximum amount (optional)</label>
                  <input name="maximum_amount" type="number" min="0.01" step="0.01" value="${plan.maximum_amount == null ? '' : esc(plan.maximum_amount)}">
                </div>
                <label class="toggle-row"><input name="active" type="checkbox" ${plan.active ? 'checked' : ''}> Available to members</label>
              </div>
              <div class="actions plan-edit-actions">
                <button class="btn btn-primary small-btn" type="submit">Save changes</button>
                <button class="btn btn-outline small-btn" type="button" data-delete-plan="${esc(plan.id)}">Delete</button>
              </div>
              <div class="plan-edit-message" aria-live="polite"></div>
            </form>`).join('')
          : '<div class="empty-state">No investment plans have been created.</div>'}
      </section>

      <section style="margin-top:32px">
        <h2>Investment requests awaiting review</h2>
        ${requests.length
          ? `<div class="table-wrap">
              <table>
                <thead><tr><th>Member</th><th>Plan</th><th>Requested</th><th>Submitted</th><th>Member note</th><th>Review</th></tr></thead>
                <tbody>${requests.map(request => `<tr>
                  <td>${esc(request.profiles?.full_name || request.profiles?.display_name || request.profiles?.email || request.user_id)}</td>
                  <td>${esc(request.plans?.name || 'Investment plan')}</td>
                  <td>${money(request.requested_amount, request.asset || 'USDT')}</td>
                  <td>${esc(date(request.created_at))}</td>
                  <td>${esc(request.member_note || '—')}</td>
                  <td><div class="actions">
                    <button class="btn btn-primary small-btn" type="button" data-investment-review="approved" data-id="${esc(request.id)}">Approve</button>
                    <button class="btn btn-outline small-btn" type="button" data-investment-review="rejected" data-id="${esc(request.id)}">Reject</button>
                  </div></td>
                </tr>`).join('')}</tbody>
              </table>
            </div>`
          : '<div class="empty-state">There are no pending investment requests.</div>'}
      </section>

      <section style="margin-top:32px">
        <h2>Active investment contracts</h2>
        ${contracts.length
          ? contracts.map(contract => `<article class="card" style="margin-top:16px">
              <div class="dashboard-topbar">
                <div>
                  <h3>${esc(contract.plans?.name || 'Investment contract')}</h3>
                  <p class="muted">${esc(contract.profiles?.full_name || contract.profiles?.display_name || contract.profiles?.email || contract.user_id)} · ${money(contract.principal, contract.asset || 'USDT')}</p>
                </div>
                ${status(contract.status)}
              </div>
              ${contract.status === 'active'
                ? `<form class="form-grid contract-performance-form" data-contract-id="${esc(contract.id)}" style="margin-top:16px">
                    <div class="field">
                      <label>Period start</label>
                      <input name="period_start" type="date" required>
                    </div>
                    <div class="field">
                      <label>Period end</label>
                      <input name="period_end" type="date" required>
                    </div>
                    <div class="field">
                      <label>Return or loss (USDT)</label>
                      <input name="return_amount" type="number" step="0.00000001" required>
                    </div>
                    <div class="field">
                      <label>Note (optional)</label>
                      <input name="note" maxlength="1000">
                    </div>
                    <button class="btn btn-outline" type="submit">Record performance</button>
                    <div class="form-message" aria-live="polite"></div>
                  </form>`
                : '<p class="muted"></p>'}
            </article>`).join('')
          : '<div class="empty-state">Approved contracts will appear here.</div>'}
      </section>`;

      main.querySelectorAll('.contract-performance-form').forEach(form => {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const fields = new FormData(form);
          const button = form.querySelector('button[type="submit"]');
          const message = form.querySelector('.form-message');
          button.disabled = true;

          try {
            const result = await api(`/api/admin/contracts/${encodeURIComponent(form.dataset.contractId)}/performance`, {
              method: 'POST',
              body: JSON.stringify({
                period_start: fields.get('period_start'),
                period_end: fields.get('period_end'),
                return_amount: Number(fields.get('return_amount')),
                note: String(fields.get('note') || '').trim()
              })
            });
            message.innerHTML = notice(result.message || 'Performance record saved.', 'success');
            form.reset();
          } catch (error) {
            message.innerHTML = notice(error.message || 'Performance record could not be saved.', 'error');
          } finally {
            button.disabled = false;
          }
        });
      });

      main.querySelectorAll('[data-investment-review]').forEach(button => {
        button.addEventListener('click', async () => {
          const action = button.dataset.investmentReview;
          let adminNote = '';

          if (action === 'rejected') {
            const note = prompt('Enter a reason for rejecting this investment request:');
            if (note === null) return;
            adminNote = note.trim();
            if (!adminNote) {
              alert('A rejection reason is required.');
              return;
            }
          } else if (!confirm('Approve this investment request and create its contract?')) {
            return;
          }

          button.disabled = true;

          try {
            await api(`/api/admin/investment-requests/${encodeURIComponent(button.dataset.id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: action, admin_note: adminNote })
            });
            await memberPage('admin-plans');
          } catch (error) {
            alert(error.message || 'The investment request could not be reviewed.');
            button.disabled = false;
          }
        });
      });

      $('#plan-form').addEventListener('submit', async e => {
        e.preventDefault();

        const form = e.currentTarget;
        const f = new FormData(form);
        const button = form.querySelector('button[type="submit"]');
        const minimum = Number(f.get('minimum_amount'));
        const maximum = f.get('maximum_amount') ? Number(f.get('maximum_amount')) : null;

        if (maximum !== null && maximum < minimum) {
          $('#form-message').innerHTML = notice('Maximum amount must be greater than or equal to minimum amount.', 'error');
          return;
        }

        button.disabled = true;
        try {
          await api('/api/admin/plans', {
            method: 'POST',
            body: JSON.stringify({
              name: f.get('name'),
              description: f.get('description'),
              minimum_amount: minimum,
              maximum_amount: maximum,
              active: true
            })
          });

          $('#form-message').innerHTML = notice('Plan created.', 'success');
          form.reset();
          setTimeout(() => memberPage('admin-plans'), 500);
        } catch (err) {
          $('#form-message').innerHTML = notice(err.message, 'error');
        } finally {
          button.disabled = false;
        }
      });

      main.querySelectorAll('.plan-edit-form').forEach(form => {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const fields = new FormData(form);
          const minimum = Number(fields.get('minimum_amount'));
          const maximum = fields.get('maximum_amount') ? Number(fields.get('maximum_amount')) : null;
          const message = $('.plan-edit-message', form);
          const button = form.querySelector('button[type="submit"]');

          if (maximum !== null && maximum < minimum) {
            message.innerHTML = notice('Maximum amount must be greater than or equal to minimum amount.', 'error');
            return;
          }

          button.disabled = true;
          try {
            await api(`/api/admin/plans/${encodeURIComponent(form.dataset.planId)}`, {
              method: 'PATCH',
              body: JSON.stringify({
                name: String(fields.get('name') || '').trim(),
                description: String(fields.get('description') || '').trim(),
                minimum_amount: minimum,
                maximum_amount: maximum,
                active: fields.has('active')
              })
            });
            message.innerHTML = notice('Plan updated.', 'success');
          } catch (error) {
            message.innerHTML = notice(error.message || 'Plan could not be updated.', 'error');
          } finally {
            button.disabled = false;
          }
        });
      });

      main.querySelectorAll('[data-delete-plan]').forEach(button => {
        button.addEventListener('click', async () => {
          const form = button.closest('.plan-edit-form');
          const message = $('.plan-edit-message', form);
          if (!confirm('Remove this plan from member listings? Existing contracts remain unchanged.')) return;

          button.disabled = true;
          try {
            const result = await api(`/api/admin/plans/${encodeURIComponent(button.dataset.deletePlan)}`, {
              method: 'DELETE'
            });
            message.innerHTML = notice(result.message || 'Plan deleted from member listings.', 'success');
            setTimeout(() => memberPage('admin-plans'), 500);
          } catch (error) {
            message.innerHTML = notice(error.message || 'Plan could not be deleted.', 'error');
            button.disabled = false;
          }
        });
      });
    }

    else if (page === 'admin-settings') {
      const d = await api('/api/admin/payment-instructions');
      const cryptoOptions = d.items.filter(item => item.method === 'crypto');
      const bank = d.items.find(item => item.method === 'bank') || {};

      main.innerHTML = `<p class="muted">
        Payment destinations are visible to signed-in members only when enabled. Verify bank receipts and blockchain transactions independently before approving deposits. Card payments are disabled until a processor is configured.
      </p>

      <div class="settings-grid">
        ${cryptoOptions.map(crypto => `<form class="form-card form-grid settings-card crypto-instructions-form" data-asset="${esc(crypto.asset)}">
          <p class="eyebrow">${esc(paymentAssetLabel(crypto.asset))} · CRYPTO</p>
          <h2>${esc(paymentAssetLabel(crypto.asset))} transfer instructions</h2>

          <label class="toggle-row">
            <input type="checkbox" name="enabled" ${crypto.enabled ? 'checked' : ''}> Show to members
          </label>

          <div class="field">
            <label>Network</label>
            <input name="network" maxlength="40" value="${esc(crypto.network || '')}" placeholder="Network for ${esc(crypto.asset)}">
          </div>

          <div class="field">
            <label>${esc(crypto.asset)} receiving address</label>
            <input name="wallet_address" maxlength="220" value="${esc(crypto.wallet_address || '')}" placeholder="Public receiving address">
          </div>

          <div class="field">
            <label>Additional instructions</label>
            <textarea name="instructions" maxlength="1000">${esc(crypto.instructions || '')}</textarea>
          </div>

          <button class="btn btn-primary">Save ${esc(crypto.asset)} instructions</button>
          <div class="crypto-message" aria-live="polite"></div>
        </form>`).join('')}

        <form id="bank-instructions-form" class="form-card form-grid settings-card">
          <p class="eyebrow">BANK TRANSFER</p>
          <h2>Bank transfer instructions</h2>

          <label class="toggle-row">
            <input type="checkbox" name="enabled" ${bank.enabled ? 'checked' : ''}> Show to members
          </label>

          <div class="field">
            <label>Bank name</label>
            <input name="bank_name" maxlength="120" value="${esc(bank.bank_name || '')}">
          </div>

          <div class="field">
            <label>Account holder</label>
            <input name="account_name" maxlength="120" value="${esc(bank.account_name || '')}">
          </div>

          <div class="field">
            <label>Account number</label>
            <input name="account_number" maxlength="80" value="${esc(bank.account_number || '')}">
          </div>

          <div class="field">
            <label>Accepted currency code (ISO 4217)</label>
            <input name="currency" maxlength="3" pattern="[A-Za-z]{3}" value="${esc(bank.currency || '')}" placeholder="USD">
          </div>

          <div class="field">
            <label>IBAN (optional)</label>
            <input name="iban" maxlength="80" value="${esc(bank.iban || '')}">
          </div>

          <div class="field">
            <label>SWIFT / BIC (optional)</label>
            <input name="swift_bic" maxlength="20" value="${esc(bank.swift_bic || '')}">
          </div>

          <div class="field">
            <label>Additional instructions</label>
            <textarea name="instructions" maxlength="1000">${esc(bank.instructions || '')}</textarea>
          </div>

          <button class="btn btn-primary">Save bank instructions</button>
          <div id="bank-message" aria-live="polite"></div>
        </form>
      </div>

      <div class="notice" style="margin-top:24px">
        Do not put card processor secrets, private keys or confidential credentials in these fields. These forms store payment destination details in the project database.
      </div>`;

      $$('.crypto-instructions-form').forEach(form => {
        form.addEventListener('submit', async event => {
          event.preventDefault();

          const fields = new FormData(form);
          const message = $('.crypto-message', form);
          const button = form.querySelector('button[type="submit"]');
          button.disabled = true;

          try {
            await api('/api/admin/payment-instructions/crypto', {
              method: 'PUT',
              body: JSON.stringify({
                asset: form.dataset.asset,
                enabled: fields.has('enabled'),
                network: fields.get('network'),
                wallet_address: fields.get('wallet_address'),
                instructions: fields.get('instructions')
              })
            });

            message.innerHTML = notice(`${form.dataset.asset} instructions saved.`, 'success');
          } catch (error) {
            message.innerHTML = notice(error.message, 'error');
          } finally {
            button.disabled = false;
          }
        });
      });

      $('#bank-instructions-form').addEventListener('submit', async event => {
        event.preventDefault();

        const form = new FormData(event.currentTarget);

        try {
          await api('/api/admin/payment-instructions/bank', {
            method: 'PUT',
            body: JSON.stringify({
              enabled: form.has('enabled'),
              bank_name: form.get('bank_name'),
              account_name: form.get('account_name'),
              account_number: form.get('account_number'),
              currency: form.get('currency'),
              iban: form.get('iban'),
              swift_bic: form.get('swift_bic'),
              instructions: form.get('instructions')
            })
          });

          $('#bank-message').innerHTML = notice('Bank payment instructions saved.', 'success');
        } catch (error) {
          $('#bank-message').innerHTML = notice(error.message, 'error');
        }
      });
    }

    else if (page === 'admin-partners') {
      const referrals = await api('/api/admin/referrals');
      const referrers = referrals.referrers || [];
      const recentReferrals = referrals.recent_referrals || [];

      main.innerHTML = `<div class="grid grid-3">
        <article class="card stat-card">
          <p>Attributed signups</p>
          <strong>${Number(referrals.total_referrals || 0).toLocaleString()}</strong>
        </article>
        <article class="card stat-card">
          <p>Members with referrals</p>
          <strong>${Number(referrals.active_referrers || 0).toLocaleString()}</strong>
        </article>
        <article class="card stat-card">
          <p>Referral codes</p>
          <strong>${referrers.length.toLocaleString()}</strong>
        </article>
      </div>

      <section style="margin-top:32px">
        <h2>Referrers</h2>
        ${table(
          ['Member', 'Email', 'Referral code', 'Signups'],
          referrers.map(item => `<tr>
            <td>${esc(item.name)}</td>
            <td>${esc(item.email || '—')}</td>
            <td><code>${esc(item.referral_code)}</code></td>
            <td>${Number(item.referral_count || 0).toLocaleString()}</td>
          </tr>`)
        )}
      </section>

      <section style="margin-top:32px">
        <h2>Recent referred signups</h2>
        ${table(
          ['Member', 'Email', 'Referred by', 'Code', 'Joined'],
          recentReferrals.map(item => `<tr>
            <td>${esc(item.name)}</td>
            <td>${esc(item.email || '—')}</td>
            <td>${esc(item.referrer_name)}${item.referrer_email ? `<br><small>${esc(item.referrer_email)}</small>` : ''}</td>
            <td><code>${esc(item.referral_code || '—')}</code></td>
            <td>${esc(date(item.created_at))}</td>
          </tr>`)
        )}
      </section>`;
    }

  } catch (err) {
    main.innerHTML = notice(err.message || 'Unable to load records.', 'error');
  }
}

function bindPublic() {
  document.querySelectorAll('.faq-question').forEach(b => {
    b.addEventListener('click', () => {
      const item = b.closest('.faq-item');
      const open = item.classList.toggle('open');
      b.setAttribute('aria-expanded', String(open));
      b.querySelector('span').textContent = open ? '−' : '＋';
    });
  });

  const f = $('#contact-form');

  f?.addEventListener('submit', e => {
    e.preventDefault();
    $('#form-message').innerHTML = notice(
      'Your enquiry details have been validated. Message delivery is not yet enabled.',
      'success'
    );
  });
}

/* NORTHSTAR_TAWKTO_CHAT_V1 */
/* NORTHSTAR_TAWKTO_RECOVERY_V2 */
function initTawkChat() {
  // Never load customer chat inside the admin area.
  if (page.startsWith('admin-') || location.pathname.includes('/admin/')) {
    return;
  }

  // Initialize the API BEFORE checking for an existing loader.
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = window.Tawk_LoadStart || new Date();

  const existing = document.getElementById('northstar-tawkto-script');

  if (existing) {
    // A successfully loaded script should not be injected twice.
    if (existing.dataset.loaded === 'true') {
      return;
    }

    // Remove a stale or previously failed loader so it can be retried.
    existing.remove();
  }

  const script = document.createElement('script');
  script.id = 'northstar-tawkto-script';
  script.async = true;
  script.src = 'https://embed.tawk.to/6af3b0285fbe7b3c4b749183/1k73ug8mo';
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', 'anonymous');

  script.onload = () => {
    script.dataset.loaded = 'true';
    console.info('[Northstar] Tawk.to loader loaded.');
  };

  script.onerror = () => {
    console.error(
      '[Northstar] Tawk.to failed to load. Check CSP, network access, or browser extensions.'
    );
    script.remove();
  };

  document.head.appendChild(script);
}
async function init() {
  initTheme();
  loadOptionalFonts();
  bindPageTransitions();
  nav();
  initTawkChat();
  footer();

  if (page === 'login') {
    try {
      if (await redirectForVerifiedRole({ signOutUnknown: true })) return;
    } catch (error) {
      app.innerHTML = `<section class="section">
        <div class="container">
          ${notice(error.message || 'Unable to verify your account. Please try again.', 'error')}
          <a class="btn btn-outline" href="../pages/login.html">Continue to login</a>
        </div>
      </section>`;
      return;
    }
  }

  if (publicContent[page]) {
    app.innerHTML = publicContent[page]();
    bindPublic();
    initScrollReveals(app);

    if (page === 'plans') renderPlans();
    if (['login', 'register', 'forgot-password'].includes(page)) handleAuth();

    return;
  }

  if (page === 'home') {
    app.innerHTML = home();
    initHeroCarousel(app);
    bindPublic();
    initScrollReveals(app);
    return;
  }

  if (await protect()) {
    await memberPage();
    initScrollReveals(app);
  }
}

init();
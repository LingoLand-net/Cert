/* Lingo‑Ville — public certificate verification */
(function () {
  const CFG = window.VERIFY_CONFIG;

  // ---------- Setup PDF.js ----------
  if (window.pdfjsLib && CFG.PDFJS_WORKER) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.PDFJS_WORKER;
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const sections = {
    search:  $('searchState'),
    loading: $('loadingState'),
    result:  $('resultState'),
    error:   $('errorState')
  };

  function showOnly(name) {
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    sections[name].classList.remove('hidden');
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      const dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) { return String(d); }
  }

  function showToast(message, duration = 2400) {
    const t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(t._to);
    t._to = setTimeout(() => t.classList.remove('show'), duration);
  }

  // ---------- Local cache ----------
  const CERT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const CERT_CACHE_PREFIX = 'lv_cert_';

  function readCertCache(certId) {
    try {
      const raw = localStorage.getItem(CERT_CACHE_PREFIX + certId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || !parsed.at) return null;
      if (Date.now() - parsed.at > CERT_CACHE_TTL_MS) {
        localStorage.removeItem(CERT_CACHE_PREFIX + certId);
        return null;
      }
      return parsed.data;
    } catch (_) {
      return null;
    }
  }

  function writeCertCache(certId, data) {
    try {
      localStorage.setItem(
        CERT_CACHE_PREFIX + certId,
        JSON.stringify({ data, at: Date.now() })
      );
    } catch (_) {
      // Storage full or blocked — ignore, this is best-effort
    }
  }

  // ---------- Hash routing ----------
  function parseHash() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
    return raw ? decodeURIComponent(raw).toLowerCase() : '';
  }

  function setHash(certId) {
    const next = `#/${encodeURIComponent(certId)}`;
    if (window.location.hash !== next) {
      window.history.pushState(null, '', next);
      handleRoute();
    }
  }

  function clearHash() {
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname);
    }
  }

  // ---------- API ----------
  async function fetchCert(certId) {
    const url = `${CFG.APPS_SCRIPT_URL}?action=getCert&id=${encodeURIComponent(certId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('NETWORK_' + res.status);
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message || 'LOOKUP_FAILED');
    return json.data;
  }

  // ---------- PDF rendering ----------
  async function renderPdf(container, url) {
    container.innerHTML = '';

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const renderScale = isMobile ? 1.25 : 1.5;

    // Try PDF.js first
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('FETCH_' + res.status);
      const buf = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

      // On mobile: render only the first page as a preview.
      // On desktop: render all pages inline.
      const pagesToRender = isMobile ? 1 : pdf.numPages;

      for (let i = 1; i <= pagesToRender; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }

      // On mobile: wrap the preview in a tap-to-open link
      if (isMobile) {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          const wrapper = document.createElement('a');
          wrapper.href = url;
          wrapper.target = '_blank';
          wrapper.rel = 'noopener';
          wrapper.className = 'block relative cursor-pointer';

          container.removeChild(canvas);
          wrapper.appendChild(canvas);

          const pill = document.createElement('div');
          pill.className = 'absolute top-3 right-3 bg-white/95 text-slate-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg pointer-events-none';
          pill.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Tap to open
          `;
          wrapper.appendChild(pill);
          container.appendChild(wrapper);

          const hint = document.createElement('p');
          hint.className = 'text-xs text-slate-400 text-center mt-3';
          hint.textContent = 'Opens in your device PDF viewer';
          container.appendChild(hint);
        }
      }
      return;
    } catch (err) {
      console.warn('PDF.js failed, falling back to direct link:', err);
    }

    // Fallback (both mobile + desktop): direct link, opens in a new tab
    container.innerHTML = `
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener"
         class="block w-full py-10 rounded-lg border-2 border-dashed border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/40 transition text-center">
        <svg class="w-12 h-12 text-teal mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm font-bold text-slate-700">Open Certificate</p>
        <p class="text-xs text-slate-400 mt-1">Opens in a new tab</p>
      </a>
    `;
  }

  // ---------- Render states ----------
  function renderStatusBanner(status) {
    const el = $('statusBanner');
    if (status === 'active') {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-teal-50 border border-teal-200 rounded-2xl">
          <svg class="w-5 h-5 text-teal flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
          <span class="text-sm font-bold text-teal-800">Verified · Active Certificate</span>
        </div>`;
    } else if (status === 'revoked') {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl">
          <svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <span class="text-sm font-bold text-red-700">This certificate has been revoked</span>
        </div>`;
    } else if (status === 'pending') {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
          <span class="text-sm font-bold text-yellow-700">This certificate is pending review</span>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <span class="text-sm font-bold text-slate-700">Status: ${escapeHtml(status)}</span>
        </div>`;
    }
  }

  async function renderResult(cert) {
    showOnly('result');

    renderStatusBanner(cert.Status);
    $('certIdBadge').textContent = cert.CertID;
    $('metaId').textContent = cert.CertID;
    $('metaName').textContent = cert.StudentName || '—';
    $('metaCourse').textContent = cert.Course || '—';
    $('metaLevel').textContent = cert.Level || '—';
    $('metaDate').textContent = fmtDate(cert.IssueDate);
    $('metaIssuer').textContent = cert.Issuer || 'Lingo-Ville Language Centre';

    // Report
    const reportCard = $('reportCard');
    if (cert.ReportURL) {
      reportCard.classList.remove('hidden');
      $('reportDownloadBtn').href = cert.ReportURL;
    } else {
      reportCard.classList.add('hidden');
    }

    // PDF: render for active, skip for revoked
    const pdfViewer = $('pdfViewer');
    if (cert.Status === 'revoked') {
      pdfViewer.innerHTML = `
        <div class="text-center py-16 px-4">
          <p class="text-slate-500 font-semibold">The PDF preview has been disabled because this certificate is revoked.</p>
          <p class="text-xs text-slate-400 mt-2">If you believe this is an error, contact ${escapeHtml(CFG.SUPPORT_EMAIL)}.</p>
        </div>`;
    } else if (cert.CertURL) {
      pdfViewer.innerHTML = `
        <div class="text-center py-20">
          <div class="spinner mx-auto"></div>
          <p class="text-xs text-slate-400 mt-3">Rendering PDF…</p>
        </div>`;
      renderPdf(pdfViewer, cert.CertURL);
    } else {
      pdfViewer.innerHTML = `
        <div class="text-center py-16 text-slate-500 text-sm">Certificate file is not available.</div>`;
    }
  }

  function renderError(message, title) {
    showOnly('error');
    $('errorTitle').textContent = title || 'Certificate Not Found';
    $('errorMessage').textContent = message || 'The ID you entered does not match any record.';
  }

  // ---------- Router ----------
  let currentLookup = 0;

  async function handleRoute() {
    const certId = parseHash();

    if (!certId) {
      showOnly('search');
      return;
    }

    const myLookup = ++currentLookup;

    // Fast path: render from local cache if fresh.
    const cached = readCertCache(certId);
    if (cached) {
      if (myLookup !== currentLookup) return;
      renderResult(cached);
      return;
    }

    // Slow path: hit the network.
    showOnly('loading');

    try {
      const cert = await fetchCert(certId);
      if (myLookup !== currentLookup) return;
      writeCertCache(certId, cert);
      renderResult(cert);
    } catch (err) {
      if (myLookup !== currentLookup) return;
      if (err.message === 'CERT_NOT_FOUND') {
        renderError(`No certificate matches the ID "${certId}".`, 'Certificate Not Found');
      } else if (err.message === 'MISSING_CERT_ID') {
        showOnly('search');
      } else {
        renderError('Could not reach the verification service. Please try again.', 'Verification Error');
      }
    }
  }

  // ---------- Prefetch on typing ----------
  let prefetchTimer = null;
  const prefetchedIds = new Set();

  function prefetchCert(certId) {
    if (!certId) return;
    if (prefetchedIds.has(certId)) return;
    if (readCertCache(certId)) return; // already cached
    prefetchedIds.add(certId);

    fetchCert(certId)
      .then(data => writeCertCache(certId, data))
      .catch(() => { /* silent — this is best-effort */ });
  }

  // ---------- Sharing ----------
  function getShareUrl() {
    return window.location.href;
  }

  async function shareInstagramStory() {
    const url = getShareUrl();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Lingo‑Ville Certificate',
          text: 'I just got certified by Lingo‑Ville 🎓',
          url: url
        });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    showToast('Open this page on your phone to post to Instagram Story');
  }

  function shareLinkedIn() {
    const url = encodeURIComponent(getShareUrl());
    const share = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    window.open(share, '_blank', 'noopener,width=620,height=620');
  }

  async function shareCopyLink() {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast('Verification link copied');
    } catch (_) {
      window.prompt('Copy this link:', url);
    }
  }

  function wireShareButtons() {
    $('shareInstagramBtn')?.addEventListener('click', shareInstagramStory);
    $('shareLinkedinBtn')?.addEventListener('click', shareLinkedIn);
    $('shareLinkBtn')?.addEventListener('click', shareCopyLink);
  }

  // ---------- Events ----------
  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = $('certInput').value.trim().toLowerCase();
    if (!val) return;
    setHash(val);
  });

  $('certInput').addEventListener('input', (e) => {
    clearTimeout(prefetchTimer);
    const val = e.target.value.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+){2,4}$/.test(val)) return;
    prefetchTimer = setTimeout(() => prefetchCert(val), 400);
  });

  $('backBtn').addEventListener('click', () => {
    $('certInput').value = '';
    clearHash();
    showOnly('search');
    setTimeout(() => $('certInput').focus(), 50);
  });

  $('errorBackBtn').addEventListener('click', () => {
    $('certInput').value = '';
    clearHash();
    showOnly('search');
    setTimeout(() => $('certInput').focus(), 50);
  });

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // ---------- Boot ----------
  $('year').textContent = new Date().getFullYear();

  const initial = parseHash();
  if (initial) $('certInput').value = initial;

  wireShareButtons();
  handleRoute();
})();
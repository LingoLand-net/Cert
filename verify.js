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

  // ---------- Hash routing ----------
  function parseHash() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
    return raw ? decodeURIComponent(raw).toLowerCase() : '';
  }

  function setHash(certId) {
    // Preserve base URL, just change the hash
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

    // Try PDF.js first
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('FETCH_' + res.status);
      const buf = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }
      return;
    } catch (err) {
      console.warn('PDF.js failed, falling back to iframe:', err);
    }

    // Fallback: iframe + download link
    container.innerHTML = `
      <iframe src="${escapeHtml(url)}#toolbar=1&navpanes=0"
              class="w-full rounded-lg border border-slate-200 bg-white"
              style="height: min(80vh, 800px);"></iframe>
      <p class="text-xs text-slate-400 text-center mt-3">
        Can't see the PDF?
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="text-teal-700 underline">Open in a new tab</a>.
      </p>
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

    // Prevent race conditions if user clicks around quickly
    const myLookup = ++currentLookup;
    showOnly('loading');

    try {
      const cert = await fetchCert(certId);
      if (myLookup !== currentLookup) return; // stale
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

  // ---------- Events ----------
  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = $('certInput').value.trim().toLowerCase();
    if (!val) return;
    setHash(val);
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

  // If a hash is present on load, prefill the input for context
  const initial = parseHash();
  if (initial) $('certInput').value = initial;

  handleRoute();
})();
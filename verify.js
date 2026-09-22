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
  const CERT_CACHE_TTL_MS = 5 * 60 * 1000;
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
    } catch (_) { return null; }
  }

  function writeCertCache(certId, data) {
    try {
      localStorage.setItem(CERT_CACHE_PREFIX + certId, JSON.stringify({ data, at: Date.now() }));
    } catch (_) {}
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

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('FETCH_' + res.status);
      const buf = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
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

    const reportCard = $('reportCard');
    if (cert.ReportURL) {
      reportCard.classList.remove('hidden');
      $('reportDownloadBtn').href = cert.ReportURL;
    } else {
      reportCard.classList.add('hidden');
    }

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
      pdfViewer.innerHTML = `<div class="text-center py-16 text-slate-500 text-sm">Certificate file is not available.</div>`;
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
    if (!certId) { showOnly('search'); return; }

    const myLookup = ++currentLookup;
    const cached = readCertCache(certId);
    if (cached) {
      if (myLookup !== currentLookup) return;
      renderResult(cached);
      return;
    }

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
    if (readCertCache(certId)) return;
    prefetchedIds.add(certId);
    fetchCert(certId).then(d => writeCertCache(certId, d)).catch(() => {});
  }

  // ---------- Sharing ----------
  function getShareUrl() { return window.location.href; }

  async function shareInstagramStory() {
    const url = getShareUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lingo‑Ville Certificate', text: 'I just got certified by Lingo‑Ville 🎓', url });
        return;
      } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    showToast('Open this page on your phone to post to Instagram Story');
  }

  function shareLinkedIn() {
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener,width=620,height=620');
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

  // ===================================================================
  // QR SCANNER — robust version
  // ===================================================================
  const qr = {
    modal: null, video: null, videoWrapper: null, closeBtn: null,
    status: null, statusText: null, retryBtn: null,
    stream: null, scanTimer: null,
    canvas: null, ctx: null,
    active: false,
    cameraStarting: false,
    detector: null,
    scanMode: 'none',           // 'native' | 'jsqr' | 'both'
    lastScan: '', lastScanTime: 0,
    frameCount: 0,              // for diagnostic logging
    lastResult: 'none'          // for diagnostic logging
  };

  function initQrScanner() {
    qr.modal        = $('qrModal');
    qr.video        = $('qrVideo');
    qr.videoWrapper = $('qrVideoWrapper');
    qr.closeBtn     = $('qrCloseBtn');
    qr.status       = $('qrStatus');
    qr.statusText   = $('qrStatusText');
    qr.retryBtn     = $('qrRetryBtn');

    if (!qr.modal) { console.warn('[QR] modal not found'); return; }

    qr.canvas = document.createElement('canvas');
    qr.ctx = qr.canvas.getContext('2d', { willReadFrequently: true });

    $('scanQrBtn')?.addEventListener('click', openQrScanner);
    qr.closeBtn?.addEventListener('click', closeQrScanner);
    qr.retryBtn?.addEventListener('click', startCamera);

    qr.modal.addEventListener('click', (e) => {
      if (e.target === qr.modal) closeQrScanner();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && qr.active) closeQrScanner();
    });

    setupDetector();
  }

  async function setupDetector() {
    // Native BarcodeDetector (fastest when supported)
    if ('BarcodeDetector' in window) {
      try {
        if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          console.log('[QR] Native supported formats:', formats);
          if (formats.includes('qr_code')) {
            qr.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            console.log('[QR] Native BarcodeDetector ready');
          }
        } else {
          qr.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          console.log('[QR] Native BarcodeDetector ready (no format probe)');
        }
      } catch (err) {
        console.warn('[QR] BarcodeDetector init failed:', err);
      }
    } else {
      console.log('[QR] BarcodeDetector not available in this browser');
    }

    if (typeof window.jsQR === 'function') {
      console.log('[QR] jsQR library loaded');
    } else {
      console.warn('[QR] jsQR library NOT loaded — waiting for fallback CDN');
    }

    // Determine strategy
    if (qr.detector && typeof window.jsQR === 'function') qr.scanMode = 'both';
    else if (qr.detector) qr.scanMode = 'native';
    else if (typeof window.jsQR === 'function') qr.scanMode = 'jsqr';
    else qr.scanMode = 'none';

    console.log('[QR] Scan strategy:', qr.scanMode);
  }

  function setQrStatus(message, showRetry = false) {
    if (!qr.status) return;
    qr.status.classList.add('visible');
    qr.videoWrapper.style.display = 'none';
    if (qr.statusText) qr.statusText.textContent = message;
    if (qr.retryBtn) qr.retryBtn.style.display = showRetry ? 'inline-block' : 'none';
  }

  function clearQrStatus() {
    if (!qr.status) return;
    qr.status.classList.remove('visible');
    qr.videoWrapper.style.display = '';
  }

  async function openQrScanner() {
    if (!qr.modal) return;

    if (!window.isSecureContext) {
      showToast('Camera requires HTTPS');
      console.warn('[QR] Not a secure context');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Camera not supported in this browser');
      return;
    }

    // Re-probe backends (jsQR may have loaded lazily via fallback CDN)
    if (qr.scanMode === 'none' || !qr.detector) {
      await setupDetector();
    }

    if (qr.scanMode === 'none') {
      // One more short wait for the fallback CDN
      await new Promise(r => setTimeout(r, 600));
      await setupDetector();
      if (qr.scanMode === 'none') {
        showToast('QR library failed to load. Please refresh.');
        console.error('[QR] No scanning backend available');
        return;
      }
    }

    qr.active = true;
    qr.frameCount = 0;
    qr.modal.classList.add('open');
    qr.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('qr-modal-open');
    clearQrStatus();
    await startCamera();
  }

  function closeQrScanner() {
    if (!qr.active) return;
    qr.active = false;
    stopCamera();
    qr.modal.classList.remove('open');
    qr.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('qr-modal-open');
    clearQrStatus();
  }

  async function startCamera() {
    if (qr.cameraStarting) {
      console.log('[QR] startCamera already in progress — skipping duplicate call');
      return;
    }
    qr.cameraStarting = true;

    try {
      stopCamera();
      clearQrStatus();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setQrStatus('Camera is not supported in this browser.', false);
        return;
      }

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      try {
        qr.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('[QR] getUserMedia error:', err && err.name, err);
        let msg = 'Could not access the camera.';
        let canRetry = true;

        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
          msg = 'Camera permission denied. Please allow camera access and try again.';
        } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
          msg = 'No camera found on this device.';
          canRetry = false;
        } else if (err && err.name === 'NotReadableError') {
          msg = 'Camera is in use by another app. Close it and retry.';
        } else if (err && err.name === 'OverconstrainedError') {
          try {
            qr.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } catch (err2) {
            setQrStatus('Could not access the camera.', false);
            return;
          }
        } else {
          setQrStatus(msg, canRetry);
          return;
        }
        if (!qr.stream) {
          setQrStatus(msg, canRetry);
          return;
        }
      }

      console.log('[QR] Stream acquired:', qr.stream.getVideoTracks()[0]?.getSettings?.());

      qr.video.srcObject = qr.stream;
      qr.video.setAttribute('playsinline', 'true');
      qr.video.setAttribute('webkit-playsinline', 'true');
      qr.video.muted = true;
      qr.video.playsInline = true;

      try {
        await qr.video.play();
        console.log('[QR] Video playing, readyState =', qr.video.readyState);
      } catch (err) {
        console.warn('[QR] video.play() failed:', err);
      }

      // Wait for actual video dimensions
      await waitForVideoReady();

      // Start scan loop
      startScanLoop();
    } finally {
      qr.cameraStarting = false;
    }
  }

  function waitForVideoReady() {
    return new Promise((resolve) => {
      if (qr.video.videoWidth > 0 && qr.video.readyState >= 2) return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      qr.video.addEventListener('loadeddata', finish, { once: true });
      qr.video.addEventListener('playing', finish, { once: true });
      const poll = setInterval(() => {
        if (qr.video.videoWidth > 0 && qr.video.readyState >= 2) {
          clearInterval(poll);
          finish();
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); finish(); }, 3000);
    });
  }

  function stopCamera() {
    stopScanLoop();
    if (qr.stream) {
      qr.stream.getTracks().forEach(t => t.stop());
      qr.stream = null;
    }
    if (qr.video) qr.video.srcObject = null;
  }

  // -------- Scan loop (setTimeout-based, more reliable on mobile than rAF) --------
  function startScanLoop() {
    stopScanLoop();
    const SCAN_INTERVAL_MS = 120; // ~8 fps

    const tick = () => {
      if (!qr.active) return;
      try {
        scanOnce();
      } catch (err) {
        console.warn('[QR] scanOnce error:', err);
      }
      qr.scanTimer = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    // Kick off after a brief delay to let the first frame settle
    qr.scanTimer = setTimeout(tick, 250);
  }

  function stopScanLoop() {
    if (qr.scanTimer) {
      clearTimeout(qr.scanTimer);
      qr.scanTimer = null;
    }
  }

  function scanOnce() {
    const video = qr.video;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      qr.frameCount++;
      if (qr.frameCount % 30 === 0) {
        console.log('[QR] Waiting for video frames, readyState=' + video.readyState + ', videoWidth=' + video.videoWidth);
      }
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Higher resolution = better detection of small QR codes
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));

    if (qr.canvas.width !== w || qr.canvas.height !== h) {
      qr.canvas.width = w;
      qr.canvas.height = h;
    }

    try {
      qr.ctx.drawImage(video, 0, 0, w, h);
    } catch (err) {
      console.warn('[QR] drawImage failed:', err);
      return;
    }

    let imageData;
    try {
      imageData = qr.ctx.getImageData(0, 0, w, h);
    } catch (err) {
      console.warn('[QR] getImageData failed:', err);
      return;
    }

    qr.frameCount++;

    // --- Native detector (async) ---
    if (qr.detector) {
      qr.detector.detect(qr.canvas)
        .then(codes => {
          if (!qr.active) return;
          if (codes && codes.length && codes[0].rawValue) {
            qr.lastResult = 'native';
            handleQrResult(codes[0].rawValue);
          }
        })
        .catch(err => {
          if (qr.frameCount % 30 === 0) {
            console.warn('[QR] Native detect error:', err && err.message);
          }
        });
    }

    // --- jsQR (sync) ---
    if (typeof window.jsQR === 'function') {
      let code = null;
      try {
        code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
      } catch (err) {
        if (qr.frameCount % 30 === 0) console.warn('[QR] jsQR threw:', err);
      }

      if (code && code.data) {
        qr.lastResult = 'jsqr';
        handleQrResult(code.data);
        return;
      }
    }

    // Diagnostic heartbeat every 30 frames (~3.6s)
    if (qr.frameCount % 30 === 0) {
      console.log('[QR] Scanned frame #' + qr.frameCount +
        ' · ' + w + 'x' + h +
        ' · strategy=' + qr.scanMode +
        ' · lastResult=' + qr.lastResult);
    }
  }

  function handleQrResult(rawData) {
    const now = Date.now();
    if (rawData === qr.lastScan && now - qr.lastScanTime < 1500) return;
    qr.lastScan = rawData;
    qr.lastScanTime = now;

    console.log('[QR] ✅ Detected content:', rawData);

    const certId = extractCertId(rawData);
    if (!certId) {
      showToast('This QR code is not a Lingo‑Ville certificate');
      console.warn('[QR] QR content does not match expected format');
      return;
    }

    console.log('[QR] ✅ Extracted cert ID:', certId);

    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (_) {} }

    closeQrScanner();

    const input = $('certInput');
    if (input) input.value = certId;

    setTimeout(() => setHash(certId), 80);
  }

  function extractCertId(content) {
    if (!content) return '';
    const s = String(content).trim();

    if (/^https?:\/\//i.test(s)) {
      try {
        const url = new URL(s);
        const hash = (url.hash || '').replace(/^#\/?/, '').trim();
        if (hash) {
          const decoded = decodeURIComponent(hash).toLowerCase();
          if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/.test(decoded)) return decoded;
        }
        for (const p of ['id', 'cert', 'certid', 'certificate']) {
          const v = url.searchParams.get(p);
          if (v && /^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/i.test(v.trim())) {
            return v.trim().toLowerCase();
          }
        }
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length) {
          const last = parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, '').trim();
          if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/i.test(last)) return last.toLowerCase();
        }
      } catch (_) {}
      return '';
    }

    const plain = s.toLowerCase();
    if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/.test(plain)) return plain;
    return '';
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
  initQrScanner();
  handleRoute();
})();
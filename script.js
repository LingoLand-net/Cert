(function () {
    const CERTS_PATH = '/certs/';

    // DOM elements
    const landingState = document.getElementById('landingState');
    const certificateState = document.getElementById('certificateState');
    const errorState = document.getElementById('errorState');
    const toast = document.getElementById('toast');
    const certIdDisplay = document.getElementById('certIdDisplay');
    const certPdfLabel = document.getElementById('certPdfLabel');
    const reportPdfLabel = document.getElementById('reportPdfLabel');
    const certDownloadBtn = document.getElementById('certDownloadBtn');
    const reportDownloadBtn = document.getElementById('reportDownloadBtn');
    const certPdfContainer = document.getElementById('certPdfContainer');
    const pdfLoading = document.getElementById('pdfLoading');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const backBtn = document.getElementById('backBtn');
    const errorBackBtn = document.getElementById('errorBackBtn');
    const searchBtn = document.getElementById('searchBtn');
    const certIdInput = document.getElementById('certIdInput');
    const errorMessageEl = document.getElementById('errorMessage');

    const pdfCourseName = document.getElementById('pdfCourseName');
    const pdfLevel = document.getElementById('pdfLevel');
    const pdfIssueDate = document.getElementById('pdfIssueDate');
    const pdfIssuer = document.getElementById('pdfIssuer');

    const ocrOverlay = document.getElementById('ocrOverlay');

    function showOcrLoader() {
        if (ocrOverlay) ocrOverlay.classList.add('active');
    }

    function hideOcrLoader() {
        if (ocrOverlay) ocrOverlay.classList.remove('active');
    }

    function getCertIdFromURL() {
        const hash = window.location.hash.replace(/^#\/?/, '');
        if (hash && hash !== 'index.html' && hash !== '') return hash.toLowerCase();
        return null;
    }

    function showState(state) {
        landingState.classList.add('hidden');
        certificateState.classList.add('hidden');
        errorState.classList.add('hidden');
        if (state === 'landing') {
            landingState.classList.remove('hidden');
            document.title = 'Certificate Verification — Lingo-Ville';
            if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
        } else if (state === 'certificate') {
            certificateState.classList.remove('hidden');
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
            document.title = 'Certificate Not Found — Lingo-Ville';
        }
    }

    function showToast(msg, dur = 3000) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('show'), dur);
    }

    function copyVerificationLink() {
        navigator.clipboard.writeText(window.location.href)
            .then(() => showToast('✅ Verification link copied!'))
            .catch(() => showToast('⚠️ Copy manually'));
    }

    // Load Tesseract dynamically (only once)
    async function loadTesseract() {
        if (window.Tesseract) return window.Tesseract;
        showToast('Getting student report (May take a few seconds)...', 5000);
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return window.Tesseract;
    }

    // Render first page of PDF to canvas for OCR
    async function pdfPageToCanvas(pdfUrl) {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        return canvas;
    }

    // Extract metadata using OCR (on canvas)
    async function extractWithOCR(pdfUrl) {
        const Tesseract = await loadTesseract();
        showToast('Gathering certificate information (may take 5–10 seconds)...', 8000);
        showOcrLoader();
        try {
            const canvas = await pdfPageToCanvas(pdfUrl);
            const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
                logger: m => console.log(m)
            });
            console.log('OCR extracted text:', text);
            return parseMetadataFromText(text);
        } finally {
            hideOcrLoader();
        }
    }

    // Parse metadata from plain text (same patterns used for PDF text)
    function parseMetadataFromText(fullText) {
        let issueDate = '—';
        let dateMatch = fullText.match(/Awarded\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
        if (!dateMatch) dateMatch = fullText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
        if (dateMatch) issueDate = dateMatch[1].replace(/,(\S)/, ', $1');

        let course = '—';
        let courseMatch = fullText.match(/completed\s+the\s+([A-Za-z\s&]+?)\s+course/i);
        if (courseMatch) course = courseMatch[1].trim();

        let level = '—';
        let levelMatch = fullText.match(/level\s+([A-Za-z0-9\/\+]+)/i);
        if (!levelMatch) levelMatch = fullText.match(/\b([ABC][12](?:\+|\/[ABC][12])?)\b/i);
        if (levelMatch) level = levelMatch[1].toUpperCase();

        let issuer = 'Lingo‑Ville Language Centre';
        let issuerMatch = fullText.match(/(Mr|Ms|Mrs)\.\s+([A-Za-z\s]+?)(?=\s+English|\s+Teacher|\s+Director|$)/i);
        if (issuerMatch) issuer = `${issuerMatch[1]}. ${issuerMatch[2].trim()}`;

        return { issueDate, course, level, issuer };
    }

    // Try PDF text extraction (normal method)
    async function extractPdfText(pdfUrl) {
        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent({ normalizeWhitespace: true });
                fullText += textContent.items.map(item => item.str).join(' ');
            }
            return fullText.trim();
        } catch (err) {
            console.warn('PDF text extraction error:', err);
            return '';
        }
    }

    async function extractPdfMetadata(pdfUrl, forceOCR = false) {
        let fullText = '';
        if (!forceOCR) {
            fullText = await extractPdfText(pdfUrl);
            console.log('PDF text length:', fullText.length);
        }
        if (fullText.length === 0 || forceOCR) {
            console.log('No selectable text – falling back to OCR.');
            return await extractWithOCR(pdfUrl);
        }
        return parseMetadataFromText(fullText);
    }

    async function pdfExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    async function loadCertificate(certid) {
        const normalizedId = certid.trim().toLowerCase();
        if (!/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i.test(normalizedId)) {
            showError('Invalid certificate ID format. Use format like encom-26ma1-b1');
            return;
        }

        document.title = `Certificate ${normalizedId} | Lingo-Ville Verification`;

        const currentHash = window.location.hash.replace(/^#\/?/, '');
        if (currentHash !== normalizedId) {
            window.location.hash = '#/' + normalizedId;
            return;
        }

        const certPdfUrl = CERTS_PATH + normalizedId + '.pdf';
        const reportPdfUrl = CERTS_PATH + 'rep-' + normalizedId + '.pdf';

        const certExists = await pdfExists(certPdfUrl);
        if (!certExists) {
            showError(`Certificate "${normalizedId}" not found.`);
            return;
        }

        certIdDisplay.textContent = normalizedId;
        certPdfLabel.textContent = normalizedId + '.pdf';
        reportPdfLabel.textContent = 'rep-' + normalizedId + '.pdf';
        certDownloadBtn.href = certPdfUrl;
        certDownloadBtn.setAttribute('download', normalizedId + '.pdf');
        reportDownloadBtn.href = reportPdfUrl;
        reportDownloadBtn.setAttribute('download', 'rep-' + normalizedId + '.pdf');

        // Reset
        pdfCourseName.textContent = '—';
        pdfLevel.textContent = '—';
        pdfIssueDate.textContent = '—';
        pdfIssuer.textContent = 'Lingo‑Ville Language Centre';

        // Try extraction (will auto-fallback to OCR if no text)
        const metadata = await extractPdfMetadata(certPdfUrl);
        if (metadata) {
            if (metadata.course !== '—') pdfCourseName.textContent = metadata.course;
            if (metadata.level !== '—') pdfLevel.textContent = metadata.level;
            if (metadata.issueDate !== '—') pdfIssueDate.textContent = metadata.issueDate;
            if (metadata.issuer) pdfIssuer.textContent = metadata.issuer;
        }

        if (pdfIssueDate.textContent === '—') {
            console.warn(`Could not extract date even with OCR for ${normalizedId}.`);
        }

        loadPdfPreview(certPdfUrl, certPdfContainer, pdfLoading);
        showState('certificate');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function loadPdfPreview(pdfUrl, container, loadingEl) {
        const existing = container.querySelector('iframe, embed');
        if (existing) existing.remove();
        if (loadingEl) loadingEl.style.display = 'flex';
        const iframe = document.createElement('iframe');
        iframe.src = pdfUrl + '#view=FitH&toolbar=0&navpanes=0';
        iframe.title = 'Certificate Preview';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.opacity = '0';
        iframe.onload = () => {
            if (loadingEl) loadingEl.style.display = 'none';
            iframe.style.opacity = '1';
        };
        iframe.onerror = () => {
            if (loadingEl) loadingEl.style.display = 'none';
            showPdfFallback(container, pdfUrl);
        };
        container.appendChild(iframe);
    }

    function showPdfFallback(container, pdfUrl) {
        const existing = container.querySelector('iframe, embed');
        if (existing) existing.remove();
        const fallback = document.createElement('div');
        fallback.className = 'absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 text-center';
        fallback.innerHTML = `<svg class="w-14 h-14 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg><p class="text-sm font-medium text-slate-500 mb-2">Preview unavailable</p><a href="${pdfUrl}" download class="px-4 py-2 bg-teal text-white rounded-lg">Download PDF</a>`;
        container.appendChild(fallback);
        const loadingSpinner = document.getElementById('pdfLoading');
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }

    function showError(msg) {
        errorMessageEl.textContent = msg || 'Certificate not found.';
        showState('error');
    }

    function navigateToCertId(certid) {
        if (!certid?.trim()) {
            if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
            showState('landing');
            return;
        }
        window.location.hash = '#/' + certid.trim().toLowerCase();
    }

    // Event listeners
    copyLinkBtn.addEventListener('click', copyVerificationLink);
    backBtn.addEventListener('click', () => {
        if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
        showState('landing');
        certIdInput.value = '';
        certIdInput.focus();
    });
    errorBackBtn.addEventListener('click', () => {
        if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
        showState('landing');
        certIdInput.value = '';
        certIdInput.focus();
    });
    searchBtn.addEventListener('click', () => {
        const val = certIdInput.value.trim();
        if (val) navigateToCertId(val);
        else showToast('Enter a certificate ID');
    });
    certIdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = certIdInput.value.trim();
            if (val) navigateToCertId(val);
            else showToast('Enter ID');
        }
    });

    window.addEventListener('hashchange', () => {
        const certid = getCertIdFromURL();
        if (certid) loadCertificate(certid);
        else showState('landing');
    });

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const initialCertId = getCertIdFromURL();
    if (initialCertId) loadCertificate(initialCertId);
    else showState('landing');
})();
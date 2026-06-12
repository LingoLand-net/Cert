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

    /**
     * Get certificate ID only from URL hash (#/certid)
     */
    function getCertIdFromURL() {
        const hash = window.location.hash.replace(/^#\/?/, '');
        if (hash && hash !== 'index.html' && hash !== '') {
            return hash.toLowerCase();
        }
        return null;
    }

    function showState(state) {
        landingState.classList.add('hidden');
        certificateState.classList.add('hidden');
        errorState.classList.add('hidden');
        if (state === 'landing') {
            landingState.classList.remove('hidden');
            document.title = 'Certificate Verification — Lingo-Ville';
            // Clear hash when on landing page
            if (window.location.hash) {
                window.history.replaceState({}, '', window.location.pathname);
            }
        } else if (state === 'certificate') {
            certificateState.classList.remove('hidden');
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
            document.title = 'Certificate Not Found — Lingo-Ville';
        }
    }

    function showToast(msg, dur = 2500) {
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

    // PDF text extraction (unchanged)
    async function extractPdfMetadata(pdfUrl) {
        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const textContent = await page.getTextContent();
            const fullText = textContent.items.map(item => item.str).join(' ');
            
            let issueDate = '—';
            const dateMatch = fullText.match(/Awarded on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i) ||
                              fullText.match(/(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i) ||
                              fullText.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
            if (dateMatch) issueDate = dateMatch[1];
            
            let course = '—';
            const courseMatch = fullText.match(/completed the\s+([A-Za-z\s&]+?)\s+course/i) ||
                                fullText.match(/course\s+([A-Za-z\s&]+?)(?=\s+level|\s+\(|$)/i);
            if (courseMatch) course = courseMatch[1].trim();
            
            let level = '—';
            const levelMatch = fullText.match(/level\s+([A-Za-z0-9\/\+]+)/i) ||
                               fullText.match(/\b([ABC][12])(?:\+|(?:\/[ABC][12]))?\b/i);
            if (levelMatch) level = levelMatch[1].toUpperCase();
            
            let issuer = 'Lingo‑Ville Language Centre';
            const issuerMatch = fullText.match(/Mr\.\s+([A-Za-z\s]+?)(?=\s+English|\s+Director|$)/i) ||
                                fullText.match(/Director of\s+([A-Za-z\s]+?)(?=\.|$)/i);
            if (issuerMatch) issuer = issuerMatch[1].trim();
            if (issuer !== 'Lingo‑Ville Language Centre') issuer = 'Mr. ' + issuer;
            
            return { issueDate, course, level, issuer };
        } catch (err) {
            console.warn('PDF text extraction failed', err);
            return null;
        }
    }

    async function loadCertificate(certid) {
        const normalizedId = certid.trim().toLowerCase();
        if (!/^[a-z]+-\d{2}[a-z]+\d?-[a-z][12]$/i.test(normalizedId)) {
            showError('Invalid certificate ID format. Use format like encom-26yk-b1');
            return;
        }

        document.title = `Certificate ${normalizedId} | Lingo-Ville Verification`;
        
        // Ensure hash is correct (in case called directly)
        const currentHash = window.location.hash.replace(/^#\/?/, '');
        if (currentHash !== normalizedId) {
            window.location.hash = '#/' + normalizedId;
            return; // hashchange will trigger again
        }

        certIdDisplay.textContent = normalizedId;
        certPdfLabel.textContent = normalizedId + '.pdf';
        reportPdfLabel.textContent = 'rep-' + normalizedId + '.pdf';

        const certPdfUrl = CERTS_PATH + normalizedId + '.pdf';
        const reportPdfUrl = CERTS_PATH + 'rep-' + normalizedId + '.pdf';

        certDownloadBtn.href = certPdfUrl;
        certDownloadBtn.setAttribute('download', normalizedId + '.pdf');
        reportDownloadBtn.href = reportPdfUrl;
        reportDownloadBtn.setAttribute('download', 'rep-' + normalizedId + '.pdf');

        pdfCourseName.textContent = '—';
        pdfLevel.textContent = '—';
        pdfIssueDate.textContent = '—';
        pdfIssuer.textContent = 'Lingo‑Ville Language Centre';

        const metadata = await extractPdfMetadata(certPdfUrl);
        if (metadata) {
            if (metadata.course !== '—') pdfCourseName.textContent = metadata.course;
            if (metadata.level !== '—') pdfLevel.textContent = metadata.level;
            if (metadata.issueDate !== '—') pdfIssueDate.textContent = metadata.issueDate;
            if (metadata.issuer) pdfIssuer.textContent = metadata.issuer;
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
        errorMessageEl.textContent = msg || 'Certificate ID not found.';
        showState('error');
    }

    function navigateToCertId(certid) {
        if (!certid?.trim()) {
            if (window.location.hash) {
                window.history.replaceState({}, '', window.location.pathname);
            }
            showState('landing');
            return;
        }
        // Set the hash – this triggers hashchange event
        window.location.hash = '#/' + certid.trim().toLowerCase();
    }

    // Event listeners
    copyLinkBtn.addEventListener('click', copyVerificationLink);
    backBtn.addEventListener('click', () => {
        if (window.location.hash) {
            window.history.replaceState({}, '', window.location.pathname);
        }
        showState('landing');
        certIdInput.value = '';
        certIdInput.focus();
    });
    errorBackBtn.addEventListener('click', () => {
        if (window.location.hash) {
            window.history.replaceState({}, '', window.location.pathname);
        }
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

    // Listen to hash changes (back/forward, manual URL edits)
    window.addEventListener('hashchange', () => {
        const certid = getCertIdFromURL();
        if (certid) {
            loadCertificate(certid);
        } else {
            showState('landing');
        }
    });

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // Initial load: only look at hash
    const initialCertId = getCertIdFromURL();
    if (initialCertId) {
        loadCertificate(initialCertId);
    } else {
        showState('landing');
    }
})();
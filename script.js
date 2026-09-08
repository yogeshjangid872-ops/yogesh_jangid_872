document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const API_URL = String(window.JAN_SAHAYATA_API || '').trim();
  const configured = API_URL && !API_URL.includes('PASTE_YOUR_APPS_SCRIPT');
  const WA = String(window.JAN_SAHAYATA_WHATSAPP || '918290987019').replace(/\D/g, '');
  const GOOGLE_FORM = String(window.JAN_SAHAYATA_GOOGLE_FORM || 'https://forms.gle/uwmgqdJRQSmZkPC88').trim();

  // Mobile menu
  const menu = document.querySelector('.menu');
  const nav = document.querySelector('.top nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  // Service cards
  document.querySelectorAll('.cards button[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const select = $('category');
      if (select) select.value = btn.dataset.cat;
      document.querySelector('#submit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function formBody(data) {
    const body = new URLSearchParams();
    Object.entries(data).forEach(([k, v]) => body.append(k, v));
    return body;
  }

  async function apiPost(data) {
    if (!configured) throw new Error('Backend is not connected yet. Please add your Apps Script /exec URL in config.js.');
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formBody(data),
      redirect: 'follow'
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { throw new Error('Backend returned an unexpected response.'); }
    if (!json.success) throw new Error(json.error || 'Request failed.');
    return json;
  }

  // Complaint submission
  const issueForm = $('issueForm');
  const saved = $('saved');
  if (issueForm) {
    issueForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!issueForm.checkValidity()) return issueForm.reportValidity();
      const submitBtn = issueForm.querySelector('button[type="submit"]');
      const original = submitBtn?.textContent || 'समस्या दर्ज करें';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'दर्ज हो रही है…'; }
      try {
        const result = await apiPost({
          action: 'complaint',
          name: $('name').value.trim(),
          phone: $('phone').value.trim(),
          area: $('area').value.trim(),
          category: $('category').value,
          description: $('description').value.trim()
        });
        saved.hidden = false;
        saved.innerHTML = `<strong>शिकायत सफलतापूर्वक दर्ज हो गई।</strong><br>आपकी शिकायत ID: <strong>${escapeHtml(result.complaintId)}</strong><br><small>इसे सुरक्षित रखें। इसी ID से स्थिति देखी जा सकती है।</small>`;
        issueForm.reset();
        saved.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {
        saved.hidden = false;
        saved.className = 'error-box';
        saved.innerHTML = `<strong>शिकायत दर्ज नहीं हो पाई।</strong><br>${escapeHtml(err.message)}<br><small>यदि आपने अभी Google Apps Script सेट नहीं किया है, तो SETUP_GUIDE.txt के चरण पूरे करें।</small>`;
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original; }
      }
    });
  }

  // Complaint tracking
  const trackForm = $('trackForm');
  const trackResult = $('trackResult');
  if (trackForm) {
    trackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('trackId').value.trim().toUpperCase();
      trackResult.hidden = false;
      trackResult.className = 'track-result loading';
      trackResult.textContent = 'स्थिति जाँची जा रही है…';
      try {
        const result = await apiPost({ action: 'track', id });
        if (!result.found) {
          trackResult.className = 'track-result error-box';
          trackResult.innerHTML = `<strong>शिकायत नहीं मिली।</strong><br>कृपया सही शिकायत ID डालें।`;
          return;
        }
        const c = result.complaint;
        trackResult.className = 'track-result';
        trackResult.innerHTML = `<strong>शिकायत ID:</strong> ${escapeHtml(c.id)}<br><strong>श्रेणी:</strong> ${escapeHtml(c.category)}<br><strong>क्षेत्र:</strong> ${escapeHtml(c.area)}<br><strong>स्थिति:</strong> <span class="status-pill">${escapeHtml(c.status)}</span><br><strong>दर्ज करने की तारीख:</strong> ${escapeHtml(c.date)}`;
      } catch (err) {
        trackResult.className = 'track-result error-box';
        trackResult.innerHTML = `<strong>ट्रैकिंग उपलब्ध नहीं है।</strong><br>${escapeHtml(err.message)}`;
      }
    });
  }

  // Real AI via Apps Script -> OpenAI. Falls back to local guidance only when backend isn't configured.
  const chat = $('chat');
  const question = $('question');
  const messages = $('messages');
  const quickPrompts = document.querySelectorAll('[data-ai-prompt]');

  function addMessage(text, type) {
    const div = document.createElement('div');
    div.className = `bubble ${type}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function localGuidance(q) {
    const text = q.toLowerCase();
    if (text.includes('पानी') || text.includes('जल') || text.includes('नल')) return 'यह जल एवं स्वच्छता श्रेणी की समस्या हो सकती है। ग्राम/वार्ड, समस्या कब से है और क्या परेशानी हो रही है—ये विवरण देकर शिकायत दर्ज करें।';
    if (text.includes('सड़क') || text.includes('गड्ढा') || text.includes('लाइट')) return 'स्थान और समस्या का स्पष्ट विवरण लिखकर सड़क एवं प्रकाश श्रेणी में शिकायत दर्ज करें।';
    if (text.includes('पेंशन') || text.includes('योजना')) return 'योजना या पेंशन का नाम, आवेदन की स्थिति और मुख्य समस्या लिखें। पात्रता/नियम की आधिकारिक जानकारी संबंधित विभाग से सत्यापित करें।';
    if (text.includes('स्वास्थ्य') || text.includes('अस्पताल') || text.includes('डॉक्टर')) return 'स्वास्थ्य संबंधी समस्या में स्थानीय स्वास्थ्य सुविधा और समस्या का विवरण लिखें। आपात स्थिति में तुरंत उचित आपात सेवा से संपर्क करें।';
    if (text.includes('शिक्षा') || text.includes('स्कूल') || text.includes('विद्यालय')) return 'विद्यालय का नाम/क्षेत्र और समस्या का स्पष्ट विवरण देकर शिक्षा श्रेणी में शिकायत दर्ज कर सकते हैं।';
    return 'कृपया अपनी समस्या का विषय, स्थान और मुख्य परेशानी बताएं। फिर जरूरत होने पर नीचे से शिकायत दर्ज करें।';
  }

  quickPrompts.forEach(btn => btn.addEventListener('click', () => {
    question.value = btn.dataset.aiPrompt || '';
    question.focus();
  }));

  if (chat && question) {
    chat.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = question.value.trim();
      if (!q) return;
      addMessage(q, 'user');
      question.value = '';
      const send = chat.querySelector('button');
      if (send) { send.disabled = true; send.textContent = '…'; }
      try {
        if (!configured) {
          setTimeout(() => addMessage(localGuidance(q), 'bot'), 250);
        } else {
          const result = await apiPost({ action: 'chat', message: q });
          addMessage(result.answer, 'bot');
        }
      } catch (err) {
        addMessage('AI अभी उपलब्ध नहीं है। आप समस्या का विवरण देकर शिकायत दर्ज कर सकते हैं।', 'bot');
        console.error(err);
      } finally {
        if (send) { send.disabled = false; send.textContent = 'भेजें'; }
      }
    });
  }

  // Google Form links
  document.querySelectorAll('[data-google-form]').forEach(a => { a.href = GOOGLE_FORM; });

  // WhatsApp links
  document.querySelectorAll('[data-whatsapp]').forEach(a => {
    const text = encodeURIComponent('नमस्कार, मुझे जनसहायता के बारे में जानकारी चाहिए।');
    a.href = `https://wa.me/${WA}?text=${text}`;
  });

  // Contact links
  const contact = document.querySelector('.contact-grid');
  if (contact) {
    contact.querySelectorAll('span').forEach(span => {
      const text = span.textContent.trim();
      if (/^\+91/.test(text)) {
        const a = document.createElement('a');
        a.href = 'tel:' + text.replace(/[^\d+]/g, '');
        a.textContent = text;
        a.className = 'contact-link';
        span.replaceWith(a);
      } else if (text.includes('@')) {
        const a = document.createElement('a');
        a.href = 'mailto:' + text;
        a.textContent = text;
        a.className = 'contact-link';
        span.replaceWith(a);
      }
    });
  }

  // Backend status badge
  const backendStatus = $('backendStatus');
  if (backendStatus) {
    backendStatus.textContent = configured ? '● ऑनलाइन सहायता कनेक्शन तैयार' : '● सेटअप बाकी';
    backendStatus.classList.toggle('ready', configured);
  }
});

const SHEET_NAME = 'Complaints';
const DEFAULT_MODEL = 'gpt-5.6-luna';

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';
  if (action === 'track') {
    return trackComplaint_(e.parameter.id || '');
  }
  return json_({ success: true, service: 'Jan Sahayata API', message: 'API is running.' });
}

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'complaint';

    if (action === 'complaint') return createComplaint_(params);
    if (action === 'track') return trackComplaint_(params.id || '');
    if (action === 'chat') return aiChat_(params.message || '');

    return json_({ success: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

function createComplaint_(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "Complaints" was not found.');

  const required = ['name', 'phone', 'area', 'category', 'description'];
  required.forEach(function(key) {
    if (!String(data[key] || '').trim()) throw new Error('Missing field: ' + key);
  });

  const complaintId = makeComplaintId_();
  sheet.appendRow([
    complaintId,
    new Date(),
    clean_(data.name),
    clean_(data.phone),
    clean_(data.area),
    clean_(data.category),
    clean_(data.description),
    'दर्ज'
  ]);

  return json_({ success: true, complaintId: complaintId, status: 'दर्ज' });
}

function trackComplaint_(id) {
  id = String(id || '').trim().toUpperCase();
  if (!id) return json_({ success: false, error: 'Complaint ID is required.' });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "Complaints" was not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_({ success: false, found: false, error: 'Complaint not found.' });

  const rows = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === id) {
      return json_({
        success: true,
        found: true,
        complaint: {
          id: rows[i][0],
          date: rows[i][1],
          name: rows[i][2],
          area: rows[i][4],
          category: rows[i][5],
          description: rows[i][6],
          status: rows[i][7] || 'दर्ज'
        }
      });
    }
  }
  return json_({ success: true, found: false, error: 'Complaint not found.' });
}

function aiChat_(message) {
  message = String(message || '').trim();
  if (!message) return json_({ success: false, error: 'Message is required.' });

  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('OPENAI_API_KEY');
  const model = props.getProperty('OPENAI_MODEL') || DEFAULT_MODEL;
  if (!apiKey) {
    return json_({ success: false, error: 'AI is not configured yet. Add OPENAI_API_KEY in Apps Script project settings.' });
  }

  const system = [
    'You are Jan Sahayata AI, a helpful civic guidance assistant for residents in Sikar, Rajasthan, India.',
    'Answer primarily in Hindi; if the user asks in English, answer in English.',
    'Give practical, concise, easy-to-understand guidance about local civic complaints such as water, sanitation, roads, street lights, health, education, agriculture, pensions, schemes and employment.',
    'You are not a government authority and must never claim to approve, guarantee, investigate, or resolve a complaint.',
    'Do not invent government rules, eligibility, deadlines, phone numbers, offices, or legal conclusions. If current official information is needed, tell the user to verify with the relevant official department.',
    'For emergencies or immediate danger, advise the user to contact the appropriate emergency service rather than waiting for this website.',
    'Never ask for passwords, OTPs, bank PINs, full identity-document numbers, or other highly sensitive credentials.',
    'When appropriate, suggest that the visitor submit a complaint on this website with their area, category and a clear description.'
  ].join(' ');

  const payload = {
    model: model,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: system }] },
      { role: 'user', content: [{ type: 'input_text', text: message }] }
    ],
    max_output_tokens: 500
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) {
    let detail = body;
    try { detail = JSON.parse(body).error.message || body; } catch (_) {}
    return json_({ success: false, error: 'AI request failed: ' + detail });
  }

  const result = JSON.parse(body);
  const text = extractOutputText_(result);
  if (!text) return json_({ success: false, error: 'AI returned an empty response.' });
  return json_({ success: true, answer: text });
}

function extractOutputText_(result) {
  if (result && typeof result.output_text === 'string') return result.output_text.trim();
  const out = result && result.output ? result.output : [];
  const parts = [];
  out.forEach(function(item) {
    (item.content || []).forEach(function(c) {
      if (typeof c.text === 'string') parts.push(c.text);
    });
  });
  return parts.join('\n').trim();
}

function makeComplaintId_() {
  const year = new Date().getFullYear();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    let id;
    do {
      id = 'JS-' + year + '-' + Math.floor(10000 + Math.random() * 90000);
    } while (sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext());
    return id;
  } finally {
    lock.releaseLock();
  }
}

function clean_(value) {
  return String(value || '').trim().slice(0, 5000);
}

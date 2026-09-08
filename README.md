# जनसहायता – Final Civic Assistance Website

A mobile-friendly GitHub Pages website for civic guidance with:

- Citizen complaint form
- Google Sheets complaint database
- Complaint ID generation
- Public complaint-status tracking by ID
- Real AI assistance through OpenAI via Google Apps Script
- WhatsApp and phone/email contact
- Responsive mobile navigation
- Campaign/update poster gallery
- Direct Google Form complaint/suggestion link
- Local ward-area options based on the supplied 2026 ward documents

## Architecture

Citizen browser → GitHub Pages frontend → Google Apps Script web app → Google Sheet / OpenAI API

The OpenAI API key is kept in Apps Script Project Settings, not in the frontend.

## Setup

Follow `SETUP_GUIDE.txt`.

## Important

Do not commit an OpenAI API key to GitHub. Keep the Google Sheet private and use the Apps Script web app only as the backend endpoint.


## Google Form
The complaint section links to the provided Google Form: https://forms.gle/uwmgqdJRQSmZkPC88


## PRODUCTION CHECKLIST
- Google Form link is configured in `config.js`.
- Do not publish individual voter names, ages, EPIC/voter IDs, phone numbers, or other personal data from electoral-roll documents.
- Keep OpenAI/API secrets inside Apps Script; never place them in frontend JavaScript.
- Test complaint submission, complaint tracking, Google Form, AI assistant, WhatsApp, phone/email, navigation, gallery, and mobile layout after deployment.
- GitHub Pages should serve `index.html` from the repository root.

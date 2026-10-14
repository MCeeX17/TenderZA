# TenderZA: Your Gateway to Procurement

Status: **in production (work in progress).**

Static site (HTML + ES modules, Tailwind via CDN) on Firebase project `tenderza-5db96`. No build step.

## Flow
- **Sector sign-up** (public or private): posts tenders with items, quantities, budget limit, work start/finish and application open/close dates.
- **Bidder sign-up**: logs in, browses tenders, opens one, applies (name, surname, phone, email), then prices each item and says where it was sourced.
- **Save for later**: a quotation draft is stored under `users/{uid}/drafts/{tenderId}` and resumed from *My bids*.
- After sending, the bidder sees the certified-documents checklist, a button that emails the tender's contact address, and the 3-month "wait to be contacted" rule.

## Firestore data
`users/{uid}`, `users/{uid}/drafts/{tenderId}`, `tenders/{id}`, `applications/{tenderId_uid}`. No mock data is shipped.

## Setup
1. Firebase console: enable **Authentication → Email/Password**, create **Firestore**, and (for the storage rules) enable **Storage**.
2. Add your domain (e.g. `username.github.io`) under **Authentication → Settings → Authorized domains**.
3. Deploy rules: `npm i -g firebase-tools && firebase login && firebase use tenderza-5db96 && firebase deploy --only firestore:rules,storage`
4. Run locally (ES modules need http): `python3 -m http.server 8000`
5. Host with `firebase deploy --only hosting`, or enable GitHub Pages on the `main` branch.

## Push to GitHub
```
git init && git add . && git commit -m "TenderZA first version"
git branch -M main && git remote add origin https://github.com/<you>/tenderza.git && git push -u origin main
```

## Before launch
- Restrict the web API key to your domains (Google Cloud console → Credentials) and turn on Firebase App Check.
- Test the rules in the Firebase emulator or Rules Playground.
- Have the privacy page reviewed against POPIA and add a contact email.
- Emails are `mailto:` links for now; automatic email needs a backend (Cloud Functions).

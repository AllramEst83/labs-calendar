App Specification: Secure Shared Calendar

1. Architecture Overview

Frontend: Single Page Application (SPA) using Vanilla HTML/CSS/JS.

Backend: Serverless functions (Netlify Functions or Edge Functions) to handle authentication, validation, and blob storage operations.

State Management: Client-side DOM manipulation and localized state arrays, synced with the server via REST/Fetch API.

2. Tech Stack

Frontend Core: HTML5, CSS3 (CSS Variables for theming), Vanilla JavaScript (ESM).

Calendar Library: FullCalendar (imported via ESM CDN like esm.sh/fullcalendar) for out-of-the-box Month, Week, and Agenda views.

Validation: Zod (shared schema for both client-side form validation and server-side request sanitization).

Storage: Netlify Blobs (No traditional database).

Storage Strategy: Keys formatted as events-YYYY-MM to allow fast fetching of specific months without loading all blob data at once.

Authentication: Single-tenant PIN-based auth using a .env variable, verified via an HTTP-only secure cookie or JWT after the initial check.

3. UI/UX Flow & Design

Theming: Native CSS variables (var(--bg-primary)) toggled via a data-theme="dark" attribute on the <html> tag. Colorful event indicators on a neutral (dark/light) background for contrast.

Initial Load (Auth):

Full-screen centered container.

6-digit input fields (auto-focusing to the next input upon entry). Auto-submits on the 6th digit.

Error State: A "harsh but polite" toast/message (e.g., "Access Denied. Kindly ensure you are authorized to be here and try again.")

Main View (Calendar):

Takes up 100vw and 100vh.

Shows minimal event data: Title, Time, and a color-coded dot for category/priority.

Interactions & Animations:

Add Event (Right-to-Left Pane): Triggered via a Floating Action Button (FAB). Pane slides in taking up 100% width on mobile, 400px width on desktop. Dimmed overlay behind it.

View Event (Left-to-Right Card): Triggered by clicking an event. Shows full description, location, and metadata. Includes Edit/Delete buttons.

4. Security & Data Integrity

CORS: Backend configured to strictly accept requests only from the production URL and localhost (during dev).

Rate Limiting: IP-based rate limiting on the /api/verify-pin endpoint to prevent brute-force attacks against the 6-digit PIN.

Input Sanitization: * Client strips HTML tags before sending.

Server runs data through the Zod schema. If extra fields or malicious scripts are detected, the request is rejected (HTTP 400) before ever touching Netlify Blobs.

Session Management: Upon successful PIN entry, the server issues an HttpOnly, Secure cookie with a session token. Subsequent API calls to fetch/add events validate this cookie, not the PIN itself, to prevent sending the PIN in plaintext repeatedly.

5. Implementation Phases

Phase 1: Setup & UI Shell. Build the HTML/CSS layout, implement dark/light mode toggle, and set up the slide-in panes with CSS transitions.

Phase 2: Calendar Integration. Wire up FullCalendar via ESM, configure the Week/Month/Agenda views.

Phase 3: Auth & Security. Create the Netlify Function for PIN verification, implement rate-limiting, and set up the HttpOnly cookie.

Phase 4: CRUD & Storage. Implement Zod schemas, wire up the form to the backend, and write functions to interact with Netlify Blobs using the YYYY-MM partitioning strategy.
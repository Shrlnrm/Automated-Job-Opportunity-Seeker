# AJOS (Automated Job Opportunity Seeker)

A powerful, secure Node.js web application for automated job hunting, lead generation, and cold outreach. AJOS searches for jobs (via Google Jobs) and companies (via Google Places), scrapes contact information directly from websites, and generates highly personalized cold emails using AI.

## Live Application

The application is deployed securely on Vercel and requires an authorized account to access.

👉 **[Launch AJOS on Vercel](https://automated-job-opportunity-seeker.vercel.app/)**

---

## Features
- **Job Search Engine**: Find relevant job listings using Google Jobs (powered by SerpAPI).
- **Company Lead Generation**: Search for businesses by industry and location to instantly build lead lists.
- **Real-time Scraping**: Automatically extracts emails, phone numbers, and social media links from company websites.
- **AI-Powered Drafts**: Generates highly effective, personalized cold emails tailored to specific jobs or companies using OpenRouter AI.
- **Secure Authentication**: Firebase Authentication with email verification, "Remember Me" functionality, and Cloudflare Turnstile bot protection.
- **Enterprise-Grade Security**: Strict CORS policies, per-user monthly search quotas, global daily rate limits, SSRF protection, and zero client-side API key exposure.
- **Modern UI**: Clean, high-density dark mode interface with premium animations and responsive design.

## Tech Stack
- **Backend**: Node.js, Express, Cheerio, Firebase Admin SDK
- **Security**: Helmet, express-rate-limit, Cloudflare Turnstile
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript, Firebase Auth
- **APIs**: SerpAPI (Jobs), Google Places API (Companies), OpenRouter (AI Drafts)

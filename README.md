# Automated Job Opportunity Seeker

A standalone Node.js web application for automated lead generation and cold outreach. This tool searches for companies using the Google Places API, scrapes contact information from their websites, and generates personalized cold emails using AI.

## Features
- **Secure Backend**: API keys are stored on the server side in a `.env` file, keeping them hidden from end users.
- **Real-time Scraping**: Automatically extracts emails, phone numbers, and social media links from company websites.
- **AI-Powered Drafts**: Generates highly effective, personalized cold emails using OpenRouter AI.
- **Premium UI**: Modern, glassmorphic dark-mode interface.

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Automated-Job-Opportunity-Seeker.git
   cd Automated-Job-Opportunity-Seeker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your API keys:
   ```env
   PLACES_API_KEY=your_google_places_key
   OPENROUTER_API_KEY=your_openrouter_key
   PORT=3000
   ```

4. **Start the server**:
   ```bash
   node server.js
   ```

5. **Open in Browser**:
   Navigate to `http://localhost:3000`

## Tech Stack
- **Backend**: Node.js, Express, Cheerio, Node-Fetch
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Glassmorphism), Vanilla JavaScript
- **APIs**: Google Places API (New), OpenRouter AI (Auto-model selection)

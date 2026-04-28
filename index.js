const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for the root and any other routes to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Scrape Helper
async function scrapeWebsite(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return { emails: [], phones: [], socials: [] };
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const emails = [];
    const phones = [];
    const socials = [];
    
    // Extract emails
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const matches = html.match(emailRegex) || [];
    const uniqueEmails = [...new Set(matches.map(e => e.toLowerCase()))];
    const filteredEmails = uniqueEmails.filter(e => {
      return !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.jpeg') && 
             !e.endsWith('.gif') && !e.endsWith('.webp') && !e.endsWith('.svg');
    });
    
    // Extract phones
    const telRegex = /href=["']tel:([^"']+)["']/gi;
    let match;
    while ((match = telRegex.exec(html)) !== null) {
      phones.push(match[1].trim());
    }
    
    // Extract socials
    const socialRegex = /href=["'](https?:\/\/(?:www\.)?(?:instagram\.com|twitter\.com|x\.com|facebook\.com|linkedin\.com)\/[^"']+)["']/gi;
    while ((match = socialRegex.exec(html)) !== null) {
      socials.push(match[1]);
    }
    
    return {
      emails: filteredEmails,
      phones: [...new Set(phones)],
      socials: [...new Set(socials)]
    };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return { emails: [], phones: [], socials: [] };
  }
}

// Route: Search Places
app.post('/api/search', async (req, res) => {
  const { query, pageToken } = req.body;
  
  if (!process.env.PLACES_API_KEY) {
    return res.status(500).json({ error: 'PLACES_API_KEY is not configured on the server.' });
  }

  const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
  const searchPayload = { textQuery: query, pageSize: 20 };
  if (pageToken) searchPayload.pageToken = pageToken;

  try {
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,nextPageToken'
      },
      body: JSON.stringify(searchPayload)
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: Scrape Website
app.post('/api/scrape', async (req, res) => {
  const { website } = req.body;
  if (!website) return res.json({ emails: [], phones: [], socials: [] });
  
  const scrapedData = await scrapeWebsite(website);
  res.json(scrapedData);
});

// Route: Draft Email
app.post('/api/draft', async (req, res) => {
  const { companyName, industry } = req.body;
  
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
  }
  
  const prompt = `You are writing a cold outreach email template for a job seeker.
Your job is to output EXACTLY this format. DO NOT make up fake job titles, names, current roles, or past projects. Leave the [brackets] exactly as they are so the user can fill them in later.
The ONLY part you should generate yourself is the "[1-2 specific reasons you actually care about this company]" based on the company name ("${companyName}") and their industry ("${industry}").

subject: quick question about opportunities at ${companyName}

body:
hi [first name],

i came across ${companyName} and wanted to reach out, not just to ask about open roles, but because [insert 1-2 specific reasons why someone would care about this company based on their industry].

i’m currently [your current role] and recently [insert a quick, relevant win or project you worked on].
i’d love to learn more about how i could bring that energy to your team.

if you’re the right person to chat with, i’d be super grateful for a quick convo or happy to be pointed to whoever handles hiring for this role.

thanks so much for the time,
[your name]
[your linkedin / portfolio link]

Rules:
1. Keep it short.
2. Follow the template exactly. Leave the user placeholders like [first name], [your current role], and [your name] EXACTLY as shown in brackets.
3. CRITICAL: You MUST actually write the 1-2 specific reasons yourself. DO NOT use brackets for this part. Generate a real, completed sentence praising the company's work in ${industry}. (e.g. "but because your recent work in AI-driven enterprise solutions is incredibly impressive.")
4. Be specific in your reason (no generic "i'm passionate about innovation lol").
5. Do NOT output anything else except the email text (no intro, no "Here is your email"). Keep the lowercase casual tone exactly as shown in the template.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      res.json({ draft: data.choices[0].message.content.trim() });
    } else {
      res.status(500).json({ error: data.error ? data.error.message : 'Unknown error from OpenRouter' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;

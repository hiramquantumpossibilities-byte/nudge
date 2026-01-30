// Vercel Serverless Function - Gemini API for Nudge
const GEMINI_API_KEY = 'AIzaSyBZv4ICB-mQV-v-KJUfc832fBfCzK6-szU';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { task, struggle, name, rewardMode } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    const buildPrompt = (mode) => {
      const base =
        'You are Nudge, a warm, understanding, never-preachy companion for ADHD brains. ' +
        'Break the task into 5-10 micro-steps. Keep each step under 12 words. Output only a numbered list.';
      if (mode === 'extra') {
        return `${base} Add a short, encouraging sentence after the list.`;
      }
      if (mode === 'celebration') {
        return `${base} Include a celebratory tone and reference ${name || 'friend'} once.`;
      }
      return base;
    };

    const systemPrompt = buildPrompt(rewardMode);
    const userMessage = `Task: ${task}\nParalysis: ${struggle || 'general overwhelm'}. Keep it gentle and tiny.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nUser request: ${userMessage}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: rewardMode === 'celebration' ? 0.7 : 0.5,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!content) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    return res.status(200).json({ content });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

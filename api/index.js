const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const cors = require('cors')
const mailer = require('../mailer')
require('dotenv').config()
const https = require('https')
const fs = require('fs')
const app = express()
const paypalService = require('../paypalService');
const OpenAI = require("openai");
const { v4: uuidv4 } = require('uuid');


const PORT = 5001
const TRANSLATION_CHAT_ID = '6569f069ebb4aaed1fe7988f'
// Initialize OpenAI client
const openai = new OpenAI({

  apiKey: process.env.CHAT_GPT_API_KEY,
});

// Enhance prompt function
const enhancePrompt = async (userPrompt) => {
const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You rewrite short, informal Serbian or English user prompts into clean, professional, high-quality image generation prompts in English.

          Your output must always be a single, polished prompt optimized for commercial print products (mugs, shirts, posters, canvases, gifts).

          Guidelines:
          - Fully understand the user’s intention, even if vague or written in Serbian slang.
          - Translate and rewrite the idea into natural, descriptive English.
          - Add only meaningful visual details: pose, setting, style, lighting, camera angle, clothing, mood, expression.
          - Keep the main subject visually clean and centered; avoid chaotic scenes.
          - Always ensure correct anatomy and proportions. Avoid distorted faces, mutated limbs, extra fingers, or surreal body shapes.
          - Prefer balanced, aesthetic compositions suitable for printed gifts.
          - Use a concise but vivid description (not too long, not too short).
          - Do NOT explain anything. Do NOT add commentary. Output ONLY the final improved image prompt.

          TEXT-IN-IMAGE RULE:
          - Detect when the user wants words/letters to appear inside the image (e.g., “natpis”, “napiši”, “da piše”, “tekst”, “slova”, “caption”, “quote”, “slogan”, “logo text”, “iznad/ispod da piše”, “na majici da piše”, or when the user provides a phrase intended to be written).
          - When text is requested, you MUST preserve the requested text EXACTLY as provided by the user (original language, spelling, diacritics, punctuation, casing). Do NOT translate it, do NOT paraphrase it, do NOT “fix” it.
          - Do NOT invent additional text. Include ONLY the exact text the user requested.
          - In the final prompt, explicitly specify: with the exact text: "..." and describe placement (above/below/on shirt/on a sign), typography style (clean, bold, readable), and high-contrast legibility suitable for print.
          - If the user provides multiple text fragments, preserve each exactly and specify each placement.
          - Only if the user explicitly asks to translate the text (e.g., “prevedi natpis”), then translate ONLY that text. Otherwise always keep it original.

          Return ONLY the improved English prompt ready for a diffusion image model.
        `,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.5,
    max_tokens: 160,
    top_p: 0.9,
    presence_penalty: 0,
    frequency_penalty: 0,
  });


  return response.choices[0].message.content.trim();
};

// Configure CORS FIRST - before bodyParser (order matters!)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    // Explicitly allow the frontend origin
    const allowedOrigins = [
      'https://www.kreiraj.rs',
      'https://kreiraj.rs',
      'http://localhost:3000',
      'http://localhost:3001'
    ]
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      // In development, allow all origins
      if (process.env.ENV !== 'production') {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token'],
  exposedHeaders: ['Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 200 // Some browsers expect 200 instead of 204
}

// Apply CORS middleware BEFORE bodyParser
app.use(cors(corsOptions))

// Explicitly handle OPTIONS preflight requests for all routes
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token')
  res.header('Access-Control-Allow-Credentials', 'true')
  res.sendStatus(200)
})

app.use(bodyParser.json())

if (process.env.ENV === 'production') {
  const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/nosistamislis.rs/privkey.pem'), // Replace with the path to your private key
    cert: fs.readFileSync(
      '/etc/letsencrypt/live/nosistamislis.rs/fullchain.pem'
    ), // Replace with the path to your certificate
  }

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Server is listening at https://localhost:${PORT} (https)`)
  })
} else {
  app.listen(PORT, () => {
    console.log(`Server is listening at http://localhost:${PORT}`)
  })
}

app.get('/api/', (req, res) => {
  res.send('Clothes design generator api successfully running')
})

app.post('/api/submitOrder', async (req, res) => {
  try {
    await mailer.sendMailToCustomer(req.body)
    await mailer.sendOrderMail(req.body)

    // Try to send the order to the external service, but ignore errors
    try {
      await axios.post('http://nosistamislis.rs:1337/api/orders', {
        data: {
          ...req.body,
        },
      });
    } catch (error) {
      // We don't throw here so it doesn't affect the main response
    }

    return res.status(200).send({ message: 'Order successfull' })
  } catch (error) {
    console.log('Error sending order mail ', error)
    return res
      .status(500)
      .send({ message: 'Order failed', error: error.message })
  }
})
app.post('/api/contactUs', async (req, res) => {
  try {
    const { email, message } = req.body;

    // Validate email and message
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).send({ message: 'Invalid email' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).send({ message: 'Invalid message' });
    }

    await mailer.sendContactUsEmail({
      text: `From: ${email}\n\nMessage:\n${message}`,
    });

    return res.status(200).send({ message: 'Message sent successfully' });
  } catch (error) {
    console.log('Error sending contact message: ', error);
    return res.status(500).send({ message: 'Message sending failed', error: error.message });
  }
});

app.post("/api/generateImage", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: "Prompt is required" });
  }

  try {
    // Enhance the prompt
    const enhancedPrompt = await enhancePrompt(prompt);

    const generateResponse = await generateImages(enhancedPrompt)
    res.status(200).send({
      message: 'Generating images initiated!',
      imageId: generateResponse.data.sdGenerationJob.generationId
    })} catch (error) {
    console.log("API Error:", error.message);
    res.status(500).json({
      message: "Server error,  " + error.message,
      error: error.message,
    });
  }
})

app.get('/api/getImageGenerationProgress/:task_id', async (req, res) => {
  const { task_id } = req.params
  try {
    const response = await axios.get(
      `https://cloud.leonardo.ai/api/rest/v1/generations/${task_id}`,
      {
        headers: {
          'authorization': `Bearer ${process.env.LEONARDO_API_TOKEN}`,
        },
      },
    )

    if (!response?.data?.generations_by_pk?.generated_images?.length) {
      return res
      .status(200)
      .send({ progress: 0, error: false, status: "pending" })
    }

    if (response?.data?.generations_by_pk?.generated_images) {
      return res.status(200).send({
        image_urls: response?.data?.generations_by_pk?.generated_images
      })
    }
  } catch (error) {
    return res
      .status(500)
      .send({ progress: 0, response: {}, message: error, error: true })
  }
})

app.post('/api/verify-captcha', async (req, res) => {
  const token = req.body.captchaValue
  const secretKey = process.env.CAPTCHA_SECRET_KEY
  const response = await axios.post(
    `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`
  )

  if (response.data.success) {
    res.send({ success: true, message: 'CAPTCHA verified successfully!' })
  } else {
    res.send({ success: false, message: 'CAPTCHA verification failed.' })
  }
})

const generateImages = async (prompt) => {
  try {
    const response = await axios.post(
      'https://cloud.leonardo.ai/api/rest/v1/generations/',
      {
        "modelId": "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
        "prompt": prompt,
        "num_images": 3,
        "width": 1024,
        "height": 1024,
        "ultra": false,
        "enhancePrompt": false
      },
      {
        headers: {
          'authorization': `Bearer ${process.env.LEONARDO_API_TOKEN}`,
        },
      }
    )
    console.log("Response images",response)
    return response
  } catch (error) {
    console.log(error)
    return false
  }
}

app.post("/api/token", async (req, res) => {
  try {
    const { jsonResponse, httpStatusCode } = await paypalService.generateClientToken();
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to generate client token:", error);
    res.status(500).send({ error: "Failed to generate client token." });
  }
});

app.post("/api/paypal/orders", async (req, res) => {
  try {
    const { price } = req.body;
    const { jsonResponse, httpStatusCode } = await paypalService.createOrder(price);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/paypal/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await paypalService.captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

module.exports = app

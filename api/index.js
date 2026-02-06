const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const cors = require('cors')
const mailer = require('../mailer')
require('dotenv').config()
const https = require('https')
const fs = require('fs')
const path = require('path')
const app = express()
const paypalService = require('../paypalService');
const cloudflareImagesService = require('../cloudflareImagesService');
const OpenAI = require("openai");
const { v4: uuidv4 } = require('uuid');
const { GoogleGenAI } = require("@google/genai");

const googleAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });



const PORT = 5001
const TRANSLATION_CHAT_ID = '6569f069ebb4aaed1fe7988f'
// Initialize OpenAI client
const openai = new OpenAI({

  apiKey: process.env.CHAT_GPT_API_KEY,
});

const getTokenUsageLogPath = () => {
  const configuredPath = process.env.TOKEN_USAGE_LOG_PATH
  if (configuredPath && configuredPath.trim()) {
    return configuredPath
  }

  // Vercel/serverless filesystems are often read-only except /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join('/tmp', 'tracking_token_usage.csv')
  }

  return path.join(process.cwd(), 'tracking_token_usage.csv')
}

const getGenerateRequestsLogPath = () =>
  path.join(process.cwd(), 'generate_requests.csv')

const csvEscape = (value) => {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/["\n\r,]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

const normalizeUsage = ({ enhanceUsage, modelUsage }) => {
  const enhancePromptTokens = Number(enhanceUsage?.prompt_tokens ?? 0)
  const enhanceCompletionTokens = Number(enhanceUsage?.completion_tokens ?? 0)
  const enhanceTotalTokens = Number(
    enhanceUsage?.total_tokens ?? (enhancePromptTokens + enhanceCompletionTokens)
  )

  // Support multiple usage shapes (Gemini + OpenAI)
  const modelPromptTokens = Number(
    modelUsage?.promptTokenCount ??
    modelUsage?.input_tokens ??
    modelUsage?.prompt_tokens ??
    0
  )
  const modelCompletionTokens = Number(
    modelUsage?.candidatesTokenCount ??
    modelUsage?.output_tokens ??
    modelUsage?.completion_tokens ??
    0
  )
  const modelTotalTokens = Number(
    modelUsage?.totalTokenCount ??
    modelUsage?.total_tokens ??
    (modelPromptTokens + modelCompletionTokens)
  )

  const promptTokens = enhancePromptTokens + modelPromptTokens
  const completionTokens = enhanceCompletionTokens + modelCompletionTokens
  const totalTokens = enhanceTotalTokens + modelTotalTokens

  return { promptTokens, completionTokens, totalTokens }
}

const estimateCostUsd = ({ model, totalTokens }) => {
  const modelName = String(model || '')
  const rateDefault = Number(process.env.TOKEN_COST_PER_1K_USD || 0)
  const rateOpenAI = Number(process.env.OPENAI_TOKEN_COST_PER_1K_USD || 0)
  const rateGemini = Number(process.env.GEMINI_TOKEN_COST_PER_1K_USD || 0)

  let rate = rateDefault
  if (modelName.toLowerCase().includes('gemini') && rateGemini) rate = rateGemini
  if (modelName.toLowerCase().startsWith('gpt') && rateOpenAI) rate = rateOpenAI

  const tokenCost = rate ? (Number(totalTokens || 0) / 1000) * rate : 0

  // If no rates set, keep it empty
  if (!rate) return ''
  return tokenCost.toFixed(6)
}

const appendTokenUsageCsv = async ({ originalPrompt, enhancedPrompt, model, enhanceUsage, modelUsage }) => {
  try {
    const logPath = getTokenUsageLogPath()
    const createdDate = new Date().toISOString()
    const { promptTokens, completionTokens, totalTokens } = normalizeUsage({ enhanceUsage, modelUsage })
    const estimatedCostUsd = estimateCostUsd({ model, totalTokens })

    const header = [
      'originalPrompt',
      'enhancedPrompt',
      'model',
      'estimatedCostUsd',
      'createdDate',
      'promptTokens',
      'completionTokens',
      'totalTokens',
    ].join(',') + '\n'

    const row = [
      csvEscape(originalPrompt),
      csvEscape(enhancedPrompt),
      csvEscape(model),
      csvEscape(estimatedCostUsd),
      csvEscape(createdDate),
      csvEscape(promptTokens),
      csvEscape(completionTokens),
      csvEscape(totalTokens),
    ].join(',') + '\n'

    if (!fs.existsSync(logPath)) {
      await fs.promises.writeFile(logPath, header + row, { encoding: 'utf8' })
      return
    }

    await fs.promises.appendFile(logPath, row, { encoding: 'utf8' })
  } catch (error) {
    console.error('Error writing token usage CSV:', error)
  }
}

const appendGenerateRequestCsv = async ({ originalPrompt, email, imageLinks }) => {
  try {
    const logPath = getGenerateRequestsLogPath()
    const createdDate = new Date().toISOString()
    const links = Array.isArray(imageLinks) ? imageLinks : []

    const header = [
      'originalPrompt',
      'email',
      'linkslike1',
      'linkslike2',
      'createdDateTime',
    ].join(',') + '\n'

    const row = [
      csvEscape(originalPrompt),
      csvEscape(email || ''),
      csvEscape(links[0] || ''),
      csvEscape(links[1] || ''),
      csvEscape(createdDate),
    ].join(',') + '\n'

    if (!fs.existsSync(logPath)) {
      await fs.promises.writeFile(logPath, header + row, { encoding: 'utf8' })
      return
    }

    await fs.promises.appendFile(logPath, row, { encoding: 'utf8' })
  } catch (error) {
    console.error('Error writing generate requests CSV:', error)
  }
}

// Validate prompt function
const validatePrompt = (rawPrompt) => {
  const prompt = (rawPrompt ?? "").trim();
  if (!prompt) return { allowed: false };

  const containsAny = (p, patterns) => patterns.some((re) => re.test(p));

  // HARD_BLOCK terms - most extreme and explicit content
  const HARD_BLOCK = [
    /\b(child\s*porn|cp)\b/i,
    /\b(underage|minor|barely\s*legal)\b/i,
    /\b(rape|raping|raped)\b/i,
    /\b(beastiality|bestiality|zoophilia)\b/i,
    /\b(necrophilia|necrophilia)\b/i,
    /\b(torture|torturing|tortured)\b/i,
    /\b(mutilation|mutilated|mutilating)\b/i,
    /\b(cannibalism|cannibal)\b/i,
    /\b(extreme\s*violence|gore|gory)\b/i,
  ];

  // HARD_BLOCK => deny
  if (containsAny(prompt, HARD_BLOCK)) {
    return { allowed: false };
  }

  // everything else => allow
  return { allowed: true };
};

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

  return {
    enhancedPrompt: response.choices[0].message.content.trim(),
    usage: response.usage,
    model: response.model,
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createLeonardoGeneration = async (prompt) => {
  const response = await axios.post(
    'https://cloud.leonardo.ai/api/rest/v1/generations/',
    {
      modelId: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
      prompt,
      num_images: 1,
      width: 1024,
      height: 1536,
      ultra: false,
      enhancePrompt: false,
    },
    {
      headers: {
        authorization: `Bearer ${process.env.LEONARDO_API_TOKEN}`,
      },
    }
  );

  return response?.data?.sdGenerationJob?.generationId || null;
};

const fetchLeonardoGeneratedImages = async (generationId) => {
  const response = await axios.get(
    `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
    {
      headers: {
        authorization: `Bearer ${process.env.LEONARDO_API_TOKEN}`,
      },
    }
  );

  return response?.data?.generations_by_pk?.generated_images || [];
};

const normalizeLeonardoImages = (generatedImages = []) =>
  generatedImages.map((image) => {
    const imageUrl = image?.url || image?.image_url || image?.imageUrl;
    return imageUrl ? { imageId: imageUrl } : { imageId: null, raw: image };
  });

const generateLeonardoImagesWithPolling = async (prompt) => {
  const generationId = await createLeonardoGeneration(prompt);
  if (!generationId) {
    throw new Error("LEONARDO_GENERATION_ID_MISSING");
  }

  const maxAttempts = Number(process.env.LEONARDO_POLL_ATTEMPTS || 12);
  const delayMs = Number(process.env.LEONARDO_POLL_DELAY_MS || 5000);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const images = await fetchLeonardoGeneratedImages(generationId);
    if (images.length) {
      return { images, generationId };
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  return { images: [], generationId };
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

// app.post("/api/generateImageGemini", async (req, res) => {
//   const { prompt } = req.body;
//   if (!prompt) {
//     return res.status(400).json({ message: "Prompt is required" });
//   }

//   try {
//     const { enhancedPrompt, usage: enhanceUsage } = await enhancePrompt(prompt);

//     const model = "gemini-2.0-flash-exp";

//     const response = await googleAI.models.generateContent({
//       model,
//       contents: enhancedPrompt,
//       config: {
//         tools: [{ googleSearch: {} }],
//         imageConfig: {
//           aspectRatio: "1:1",
//           imageSize: "1024x1024"
//         }
//       }
//     });

//     const images = [];
//     if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
//       for (const part of response.candidates[0].content.parts) {
//         if (part.inlineData) {
//           images.push(part.inlineData.data);
//         }
//       }
//     }

//     await appendTokenUsageCsv({
//       originalPrompt: prompt,
//       enhancedPrompt,
//       model,
//       enhanceUsage,
//       modelUsage: response.usageMetadata,
//     })

//     res.status(200).json({
//       message: "Image generated successfully",
//       images: images,
//       usage: response.usageMetadata
//     });

//   } catch (error) {
//     console.error("Gemini Error:", error);
//     res.status(500).json({
//       message: "Server error: " + error.message,
//       error: error.message,
//     });
//   }
// });

app.post("/api/generate", async (req, res) => {
  const { prompt, email } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: "Prompt is required" });
  }

  if (!process.env.CHAT_GPT_API_KEY) {
    return res.status(500).json({ message: "CHAT_GPT_API_KEY is not configured" });
  }

  // Validate prompt before processing
  const validation = validatePrompt(prompt);
  if (!validation.allowed) {
    return res.status(403).json({
      message: "Prompt contains prohibited content and cannot be processed",
      error: "PROMPT_NOT_ALLOWED"
    });
  }

  try {
    const { enhancedPrompt, usage: enhanceUsage } = await enhancePrompt(prompt);

    const model = "gpt-image-1.5";
    const quality = "medium";

    try {
      const imageResponse = await openai.images.generate({
        model,
        prompt: enhancedPrompt,
        size: "1024x1536",
        quality,
        n: 1
      });

      await appendTokenUsageCsv({
        originalPrompt: prompt,
        enhancedPrompt,
        model: `${model}:${quality}`,
        enhanceUsage,
        modelUsage: imageResponse.usage,
      })

      const images = (imageResponse.data || [])
        .map((item) => item.b64_json)
        .filter(Boolean);

      if (!images.length) {
        throw new Error("GPT_IMAGE_EMPTY");
      }

      // Upload images to S3
      const uploadedImages = [];
      for (let i = 0; i < images.length; i++) {
        const base64String = images[i];
        // Remove data URI prefix if present
        const base64Data = base64String.includes(',')
          ? base64String.split(',')[1]
          : base64String;

        const imageBuffer = Buffer.from(base64Data, 'base64');
        const filename = `kreiraj-${imageResponse.created}-${i + 1}.png`;

        const uploadResult = await cloudflareImagesService.uploadImageToS3(
          imageBuffer,
          filename,
          'image/png'
        );

        if (uploadResult.success) {
          uploadedImages.push({
            imageId: `https://img.kreiraj.rs/${uploadResult.data.key}`,
          });
        } else {
          console.error(`Failed to upload image ${i + 1} to S3:`, uploadResult.error);
          // Still include the base64 even if S3 upload fails
          uploadedImages.push({
            imageId: null,
            uploadError: uploadResult.error,
          });
        }
      }



      console.log("GPT GENERATED");
      await appendGenerateRequestCsv({
        originalPrompt: prompt,
        email,
        imageLinks: uploadedImages.map((img) => img.imageId).filter(Boolean),
      })
      return res.status(200).json({
        message: "Image generated successfully",
        images: uploadedImages,
        usage: enhanceUsage,
      });
    } catch (gptError) {
      console.error("ChatGPT Image Error:", gptError);

      if (!process.env.LEONARDO_API_TOKEN) {
        return res.status(500).json({
          message: "GPT image generation failed and LEONARDO_API_TOKEN is not configured",
          error: "LEONARDO_API_TOKEN_MISSING",
        });
      }

      const { images: leonardoImages } = await generateLeonardoImagesWithPolling(enhancedPrompt);
      const normalizedImages = normalizeLeonardoImages(leonardoImages).filter((image) => image.imageId);

      if (!normalizedImages.length) {
        return res.status(500).json({
          message: "Leonardo image generation did not return images",
          error: "LEONARDO_EMPTY",
        });
      }

      await appendTokenUsageCsv({
        originalPrompt: prompt,
        enhancedPrompt,
        model: "leonardo",
        enhanceUsage,
        modelUsage: null,
      })

      console.log("LEONARDO GENERATED");
      await appendGenerateRequestCsv({
        originalPrompt: prompt,
        email,
        imageLinks: normalizedImages.map((img) => img.imageId).filter(Boolean),
      })
      return res.status(200).json({
        message: "Image generated successfully",
        images: normalizedImages,
        usage: enhanceUsage,
      });
    }
  } catch (error) {
    console.error("Image Generation Error:", error);
    return res.status(500).json({
      message: "Server error: " + error.message,
      error: error.message,
    });
  }
});

// app.post("/api/generateImage", async (req, res) => {
//   const { prompt } = req.body;
//   if (!prompt) {
//     return res.status(400).json({ message: "Prompt is required" });
//   }

//   try {
//     // Enhance the prompt
//     const { enhancedPrompt } = await enhancePrompt(prompt);

//     const generateResponse = await generateImages(enhancedPrompt)
//     res.status(200).send({
//       message: 'Generating images initiated!',
//       imageId: generateResponse.data.sdGenerationJob.generationId
//     })
//   } catch (error) {
//     res.status(500).json({
//       message: "Server error,  " + error.message,
//       error: error.message,
//     });
//   }
// })

// app.get('/api/getImageGenerationProgress/:task_id', async (req, res) => {
//   const { task_id } = req.params
//   try {
//     const response = await axios.get(
//       `https://cloud.leonardo.ai/api/rest/v1/generations/${task_id}`,
//       {
//         headers: {
//           'authorization': `Bearer ${process.env.LEONARDO_API_TOKEN}`,
//         },
//       },
//     )

//     if (!response?.data?.generations_by_pk?.generated_images?.length) {
//       return res
//         .status(200)
//         .send({ progress: 0, error: false, status: "pending" })
//     }

//     if (response?.data?.generations_by_pk?.generated_images) {
//       return res.status(200).send({
//         image_urls: response?.data?.generations_by_pk?.generated_images
//       })
//     }
//   } catch (error) {
//     return res
//       .status(500)
//       .send({ progress: 0, response: {}, message: error, error: true })
//   }
// })

// app.post('/api/verify-captcha', async (req, res) => {
//   const token = req.body.captchaValue
//   const secretKey = process.env.CAPTCHA_SECRET_KEY
//   const response = await axios.post(
//     `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`
//   )

//   if (response.data.success) {
//     res.send({ success: true, message: 'CAPTCHA verified successfully!' })
//   } else {
//     res.send({ success: false, message: 'CAPTCHA verification failed.' })
//   }
// })

// const generateImages = async (prompt) => {
//   try {
//     const response = await axios.post(
//       'https://cloud.leonardo.ai/api/rest/v1/generations/',
//       {
//         "modelId": "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
//         "prompt": prompt,
//         "num_images": 3,
//         "width": 1024,
//         "height": 1024,
//         "ultra": false,
//         "enhancePrompt": false
//       },
//       {
//         headers: {
//           'authorization': `Bearer ${process.env.LEONARDO_API_TOKEN}`,
//         },
//       }
//     )
//     return response
//   } catch (error) {
//     console.log(error)
//     return false
//   }
// }

// app.post("/api/token", async (req, res) => {
//   try {
//     const { jsonResponse, httpStatusCode } = await paypalService.generateClientToken();
//     res.status(httpStatusCode).json(jsonResponse);
//   } catch (error) {
//     console.error("Failed to generate client token:", error);
//     res.status(500).send({ error: "Failed to generate client token." });
//   }
// });

// app.post("/api/paypal/orders", async (req, res) => {
//   try {
//     const { price } = req.body;
//     const { jsonResponse, httpStatusCode } = await paypalService.createOrder(price);
//     res.status(httpStatusCode).json(jsonResponse);
//   } catch (error) {
//     console.error("Failed to create order:", error);
//     res.status(500).json({ error: "Failed to create order." });
//   }
// });

// app.post("/api/paypal/orders/:orderID/capture", async (req, res) => {
//   try {
//     const { orderID } = req.params;
//     const { jsonResponse, httpStatusCode } = await paypalService.captureOrder(orderID);
//     res.status(httpStatusCode).json(jsonResponse);
//   } catch (error) {
//     console.error("Failed to capture order:", error);
//     res.status(500).json({ error: "Failed to capture order." });
//   }
// });


module.exports = app

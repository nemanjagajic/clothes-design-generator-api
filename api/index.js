const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios')
const cors = require('cors')
const mailer = require('../mailer')
require('dotenv').config()
const Filter = require('bad-words')
const https = require('https')
const fs = require('fs')
const filter = new Filter()
filter.addWords('suicide', 'suicidal')
filter.removeWords('hells', 'hell')
const app = express()
const paypalService = require('../paypalService');
const PORT = 5001
const TRANSLATION_CHAT_ID = '6569f069ebb4aaed1fe7988f'

app.use(bodyParser.json())
app.use(cors())

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

    await axios.post('http://nosistamislis.rs:1337/api/orders', {
      data: {
        ...req.body,
      },
    })
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

    await mailer.sendMail({
      to: 'nosistamislis@gmail.com',
      subject: 'New Contact Us Message',
      text: `From: ${email}\n\nMessage:\n${message}`,
    });

    return res.status(200).send({ message: 'Message sent successfully' });
  } catch (error) {
    console.log('Error sending contact message: ', error);
    return res.status(500).send({ message: 'Message sending failed', error: error.message });
  }
});

app.post('/api/generateImage', async (req, res) => {
  const { prompt } = req.body
  try {
    const response = await axios.post(
      'http://46.101.119.178:5000/api/messages',
      {
        chatId: TRANSLATION_CHAT_ID,
        text: prompt,
      },
      {
        headers: {
          Authorization: `${process.env.TRANSLATOR_AUTH_TOKEN}`,
        },
      }
    )
    const translatedPrompt = response?.data?.message?.textTranslated

    if (filter.isProfane(translatedPrompt)) {
      res.status(422).send({ message: 'Bad words' })
      return
    }
    const generateResponse = await generateImages(translatedPrompt)
    res.status(200).send({
      message: 'Generating images initiated!',
      imageId: generateResponse.data.sdGenerationJob.generationId,
    })
  } catch (error) {
    console.log("Error bato", error, error?.message)
    res.status(500).send({
      message: 'Server error sorry',
      error: error
    })
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
        "modelId": "6b645e3a-d64f-4341-a6d8-7a3690fbf042",
        "contrast": 3.5,
        "prompt": prompt,
        "num_images": 4,
        "width": 1080,
        "height": 1080,
        "ultra": false,
        "styleUUID": "111dc692-d470-4eec-b791-3475abac4c46",
        "enhancePrompt": false
      },
      {
        headers: {
          'authorization': `Bearer ${process.env.LEONARDO_API_TOKEN}`,
        },
      }
    )
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

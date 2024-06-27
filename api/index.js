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

app.post('/api/generateImage', async (req, res) => {
  const { description } = req.body
  try {
    const response = await axios.post(
      'http://46.101.119.178:5000/api/messages',
      {
        chatId: TRANSLATION_CHAT_ID,
        text: description,
      },
      {
        headers: {
          Authorization: `${process.env.TRANSLATOR_AUTH_TOKEN}`,
        },
      }
    )
    const translatedDescription = response?.data?.message?.textTranslated

    if (filter.isProfane(translatedDescription)) {
      res.status(422).send({ message: 'Bad words' })
      return
    }

    const generateResponse = await generateImages(translatedDescription)
    
    res.status(200).send({
      message: 'Generating images initiated!',
      imageId: generateResponse.data.task_id,
    })
  } catch (error) {
    res
      .status(400)
      .send({ message: 'Something went wrong, image creation not initiated' })
  }
})

app.get('/api/getImageGenerationProgress/:task_id', async (req, res) => {
  const { task_id } = req.params

  try {
    const response = await axios.post(
      `https://api.midjourneyapi.xyz/mj/fetch`,
      { task_id:task_id},
      {
        headers: {
          'X-API-KEY': `423f95cfb024d61c03775cba7ab1c83477b244188137de4494c1850c028db213`,
        },
      },
    )


    if (!response.data.task_result.image_url) {
      return res
      .status(200)
      .send({ progress: 0, error: false, status: "pending" })
    }

    if (response.data.task_result.image_url) {
      return res.status(200).send({
        image_url: response.data.task_result.image_url
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

const generateImages = async (description) => {
  try {
    const response = await axios.post(
      'https://api.midjourneyapi.xyz/mj/v2/imagine',
      {
        prompt: description,
        process_mode: 'fast'
      },
      {
        headers: {
          'X-API-KEY': `423f95cfb024d61c03775cba7ab1c83477b244188137de4494c1850c028db213`,
        },
      }
    )
    return response
  } catch (error) {
    console.log(error)
    return false
  }
}

module.exports = app

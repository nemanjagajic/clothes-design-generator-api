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
     res.status(200).send({
      message: 'Generating images initiated!',
      imageId: 'mocked_id_123',
    })
    return
    // const response = await axios.post(
    //   'http://46.101.119.178:5000/api/messages',
    //   {
    //     chatId: TRANSLATION_CHAT_ID,
    //     text: description,
    //   },
    //   {
    //     headers: {
    //       Authorization: `${process.env.TRANSLATOR_AUTH_TOKEN}`,
    //     },
    //   }
    // )
    // const translatedDescription = response?.data?.message?.textTranslated

    // if (filter.isProfane(translatedDescription)) {
    //   res.status(422).send({ message: 'Bad words' })
    //   return
    // }

    // const generateResponse = await generateImages(translatedDescription)
    
    // res.status(200).send({
    //   message: 'Generating images initiated!',
    //   imageId: 'mocked_id_123',
    // })
  } catch (error) {
    console.log("errorcina")
    res.status(200).send({
      message: 'Generating images initiated!',
      imageId: 'mocked_id_123',
    })
  }
})

app.get('/api/getImageGenerationProgress/:task_id', async (req, res) => {
  const { task_id } = req.params

  try {
    if (task_id === 'mocked_id_123') {
      return res.status(200).send({
        image_url: 'https://cdn.discordapp.com/attachments/990816889657778196/1258302571127242804/jerryam._A_close-up_image_in_stunning_4K_resolution_features_th_e066f190-b7d7-407b-a790-5dc7f4e77d22.png?ex=66878d17&is=66863b97&hm=63a29ce7161bf0a6cada3a073e1d5219f0f87e99edeb3443db4bfa5a92b95925&'
      })
    }
    const response = await axios.post(
      `https://api.midjourneyapi.xyz/mj/fetch`,
      { task_id:task_id},
      {
        headers: {
          'X-API-KEY': `${process.env.GO_API_TOKEN}`,
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
          'X-API-KEY': `${process.env.GO_API_TOKEN}`,
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

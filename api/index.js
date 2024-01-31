const express = require('express')
const bodyParser = require('body-parser')
const axios = require("axios")
const cors = require("cors")
const mailer = require("../mailer");
require('dotenv').config()
const Filter = require('bad-words')
const https = require('https');
const fs = require('fs');
const filter = new Filter()
filter.addWords('suicide', 'suicidal')
const app = express()
const PORT = 5001
const TRANSLATION_CHAT_ID = '6569f069ebb4aaed1fe7988f'

app.use(bodyParser.json())
app.use(cors())

if (process.env.ENV === 'production') {
  const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/nosistamislis.rs/privkey.pem'), // Replace with the path to your private key
    cert: fs.readFileSync('/etc/letsencrypt/live/nosistamislis.rs/fullchain.pem') // Replace with the path to your certificate
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Server is listening at https://localhost:${PORT} (https)`);
  });
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
    mailer.sendOrderMail(req.body)
  } catch (error) {
    console.log("Error sending order mail ", error)
  }
})

app.post('/api/generateImage', async (req, res) => {
  const { description } = req.body
  try {
    const response = await axios.post('http://46.101.119.178:5000/api/messages', {
      chatId: TRANSLATION_CHAT_ID,
      text: description
    }, {
      headers: {
        'Authorization': `${process.env.TRANSLATOR_AUTH_TOKEN}`
      }
    })
    const translatedDescription = response?.data?.message?.textTranslated

    if (filter.isProfane(translatedDescription)) {
      res.status(422).send({ message: "Bad words" })
      return
    }

    const generateResponse = await generateImages(translatedDescription)
    res.status(200).send({ message: 'Generating images initiated!', imageId: generateResponse.data.data.id });

  } catch (error) {
    res.status(400).send({ message: 'Something went wrong, image creation not initiated' });
  }
})

app.get('/api/getImageGenerationProgress/:index', async (req, res) => {
  const { index } = req.params

  try {
    const response = await axios.get(`https://cl.imagineapi.dev/items/images/${index}`, {
      headers: {
        'Authorization': `Bearer ${process.env.IMAGINE_API_TOKEN}`
      }
    })
    res.status(200).send({ progress: response.data.data.progress || 0, response: response.data.data })
  } catch (error) {
    return res.status(200).send({ progress: 0, response: {}, message: error, error: true })
  }
})

const generateImages = async (description) => {
  try {
    const response = await axios.post('https://cl.imagineapi.dev/items/images', {
      prompt: description,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.IMAGINE_API_TOKEN}`
      }
    })
    return response
  } catch (error) {
    console.log(error)
    return false
  }
}

module.exports = app

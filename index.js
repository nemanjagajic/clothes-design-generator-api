const express = require('express')
const bodyParser = require('body-parser')
const socketIo = require('socket.io')
const axios = require("axios")
const cors = require("cors")
const mailer = require("./mailer");
require('dotenv').config()

const app = express()
const PORT = 5001
const TRANSLATION_CHAT_ID = '6569f069ebb4aaed1fe7988f'

app.use(bodyParser.json())
app.use(cors())

const server = app.listen(PORT, () => {
  console.log(`Server is listening at http://localhost:${PORT}`)
})

const io = socketIo(server, { cors: { origin: '*' } })

let imageRequestsQueue = []
let requestBeingGenerated = null

setInterval(() => {
  if (imageRequestsQueue.length > 0 && !requestBeingGenerated) {
    generateImages(imageRequestsQueue[0])
  }
}, 5000)

app.post('/webhook', async (req, res) => {
  const eventData = req.body;
  io.emit(`generatedImages${eventData.ref}`, eventData.imageUrls)
  imageRequestsQueue = imageRequestsQueue.filter(irq => irq.ref !== eventData.ref)
  requestBeingGenerated = null
  try {

    const emailsData = await axios.get(`${process.env.STRAPI_BASE_URL}/api/email-refs`)
    if (emailsData?.data?.data) {

      const emails = emailsData.data.data
      const emailToSendTo = emails.find((emailData) => {
        return emailData.attributes.ref === eventData.ref
      })

      if (emailToSendTo?.attributes?.email) {
        mailer.sendMail(emailToSendTo.attributes.email, eventData.imageUrls)
      }
    }
    res.status(200).send('Webhook data received successfully');
  } catch (error) {
    console.log("Error receiving webhook data", error)
  }

});

app.post('/submitOrder', async (req, res) => {
  try {
    mailer.sendOrderMail(req.body)
  } catch (error) {
    console.log("Error sending order mail ", error)
  }
})

app.post('/generateImage', async (req, res) => {
  const { description, ref } = req.body
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
    imageRequestsQueue.push({ description: translatedDescription, ref, time: new Date() })
    res.status(200).send({ message: 'Generating images initiated', numberInQueue: imageRequestsQueue.length });
  } catch (error) {
    res.status(400).send({ message: 'Something went wrong, image creation not initiated' });
  }
})

app.get('/', (req, res) => {
  res.send('Clothes design generator api successfully running')
})

app.get('/imageRequestsQueue', (req, res) => {
  res.status(200).send({ imageRequestsQueue, requestBeingGenerated, queueLength: imageRequestsQueue.length })
})

app.get('/getImageGenerationProgress', async (req, res) => {
  if (!requestBeingGenerated) {
    return res.status(200).send({ progress: 0, message: 'No request being generated' })
  }

  try {
    const response = await axios.get(`https://api.thenextleg.io/v2/message/${requestBeingGenerated.messageId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.THE_NEXT_LEG_TOKEN}`
      }
    })
    res.status(200).send({ progress: response.data.progress })
  } catch (error) {
    return res.status(200).send({ progress: 0, message: error, error: true })
  }
})

app.delete('/removeFromQueueByIndex/:index', (req, res) => {
  const { index } = req.params
  imageRequestsQueue = imageRequestsQueue.filter((irq, i) => i !== parseInt(index))
  if (parseInt(index) === 0) {
    requestBeingGenerated = null
  }
  res.status(200).send({ imageRequestsQueue, requestBeingGenerated, queueLength: imageRequestsQueue.length })
})

const generateImages = async (imageRequest) => {
  try {
    const response = await axios.post('https://api.thenextleg.io', {
      cmd: "imagine",
      msg: imageRequest.description,
      ref: imageRequest.ref
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.THE_NEXT_LEG_TOKEN}`
      }
    })
    requestBeingGenerated = { ...imageRequest, messageId: response.data.messageId }
    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

module.exports = app

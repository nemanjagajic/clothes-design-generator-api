const express = require('express');
const bodyParser = require('body-parser');
const socketIo = require('socket.io')
const axios= require("axios")
const cors = require("cors")
require('dotenv').config()

const app = express();
const PORT = 5001;
const TRANSLATION_CHAT_ID = '6569f069ebb4aaed1fe7988f'

app.use(bodyParser.json());
app.use(cors());

const server = app.listen(PORT, () => {
  console.log(`Server is listening at http://localhost:${PORT}`);
});

const io = socketIo(server, { cors: { origin: '*' } });

let imageRequestsQueue = []
let requestBeingGenerated = null

setInterval(() => {
  if (imageRequestsQueue.length > 0 && !requestBeingGenerated) {
    const isRequestSuccessfullySent = generateImages(imageRequestsQueue[0])
    if (isRequestSuccessfullySent) {
      console.log(`Sending request to generate: "${imageRequestsQueue[0].description}"...`)
    } else {
      console.log('Something failed while sending request to generate images')
    }
  } else if (requestBeingGenerated) {
    console.log(`Currently generating "${requestBeingGenerated.description}"...`)
  }
}, 5000)

app.post('/webhook', (req, res) => {
  const eventData = req.body;

  console.log('Webhook data received:', {
    content: eventData.content,
    ref: eventData.ref,
    images: eventData.imageUrls
  });

  io.emit(`generatedImages${eventData.ref}`, eventData.imageUrls)
  imageRequestsQueue = imageRequestsQueue.filter(irq => irq.ref !== eventData.ref)
  requestBeingGenerated = null
  res.status(200).send('Webhook data received successfully');
});

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
    imageRequestsQueue.push({ description: translatedDescription, ref, time: new Date()})
    res.status(200).send({ message: 'Generating images initiated', numberInQueue: imageRequestsQueue.length });
  } catch (error) {
    res.status(400).send({ message: 'Something went wrong, image creation not initiated' });
  }
})

app.get('/imageRequestsQueue', (req, res) => {
  res.status(200).send({ imageRequestsQueue: imageRequestsQueue, number: imageRequestsQueue.length })
})

const generateImages = async (imageRequest) => {
  try {
    await axios.post('https://api.thenextleg.io', {
      cmd: "imagine",
      msg: imageRequest.description,
      ref: imageRequest.ref
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.THE_NEXT_LEG_TOKEN}`
      }
    })
    requestBeingGenerated = imageRequest
    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

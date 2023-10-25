const express = require('express');
const bodyParser = require('body-parser');
const socketIo = require('socket.io')
const axios= require("axios")
const cors = require("cors")
require('dotenv').config()

const app = express();
const PORT = 5000;

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
  } else {
    console.log('Image requests queue empty')
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
  imageRequestsQueue.push({ description, ref, time: new Date()})
  res.status(200).send({ message: 'Generating images initiated', numberInQueue: imageRequestsQueue.length });
})

app.get('/imageRequestsQueue', (req, res) => {
  res.status(200).send({ imageRequestsQueue: imageRequestsQueue, number: imageRequestsQueue.length })
})

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('message', (data) => {
    console.log('Message received:', data);
    io.emit('message', data); // Broadcast the message to all connected clients
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const generateImages = async (imageRequest) => {
  try {
    axios.defaults.headers.common = {'Authorization': `Bearer ${process.env.THE_NEXT_LEG_TOKEN}`}
    await axios.post('https://api.thenextleg.io', {
      cmd: "imagine",
      msg: imageRequest.description,
      ref: imageRequest.ref
    })
    requestBeingGenerated = imageRequest
    return true
  } catch (error) {
    console.log(error)
    return false
  }
}

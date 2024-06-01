require('dotenv').config()
const express = require('express')
const cors = require('cors')
const port = process.env.PORT || 5000;
const app = express()


app.use(express.json())
app.use(cors())

app.get('/', async (req, res) => {
    res.send('Snap Gig sever is running properly')
})
app.listen(port, (req, res) => {
    console.log(`listening to the port${port}`)
})
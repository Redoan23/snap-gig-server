require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express()


app.use(express.json())
app.use(cors({
    credentials: [
        'http://localhost:5173'
    ]
}))




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qlopamb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db('snapGigDB').collection('users')
        const taskCollection = client.db('snapGigDB').collection('tasks')

        // task related apis

        app.get('/taskCreatorTasks/:email', async (req, res) => {
            const email = req.params.email
            const query = { creatorEmail: email }
            const result = await taskCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/tasks', async (req, res) => {
            const data = req.body
            const result = await taskCollection.insertOne(data)
            res.send(result)
        })
        app.delete('/tasks/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const findUserTask = await taskCollection.findOne(query)
            const userEmail = findUserTask?.creatorEmail
            const userQuery = { email: userEmail }
            const user = await userCollection.findOne(userQuery)
            const addCoin = findUserTask.totalPayment
            const oldCoin = user.coin
            const newCoin = oldCoin + addCoin
            const updatedDoc = {
                $set: {
                    coin: newCoin
                }
            }
            const updateCoin = await userCollection.updateOne(userQuery, updatedDoc)
            if (!updateCoin) {
                return res.send({ message: "couldn't delete the task, failed" })
            }
            const result = await taskCollection.deleteOne(query)
            res.send(result)
        })


        // user related apis

        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })
        app.patch('/users/:email', async (req, res) => {
            const email = req.params.email
            const data = req.body
            const cost = data.totalPayment
            const query = { email: email }
            const userId = await userCollection.findOne(query)

            const newCoin = userId.coin - data.totalPayment
            const updatedDoc = {
                $set: {
                    coin: newCoin
                }
            }
            const result = userCollection.updateOne(query, updatedDoc)
            res.send(result)
        })


        app.post('/users', async (req, res) => {
            const data = req.body
            const query = { email: data.email }
            const role = data.role
            let coin = 0
            if (role === 'worker') {
                coin = 10
            }
            if (role === 'taskcreator') {
                coin = 50
            }
            data.coin = coin

            const checkAccount = await userCollection.findOne(query)

            if (!checkAccount) {
                const result = await userCollection.insertOne(data)
                res.send(result)
            }
            res.status(409).send({ message: 'An account already exists with this email' })

        })



        // JWT related APIs

        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.TOKEN_SECRET, { expiresIn: '8d' })
            res.send({ token })
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', async (req, res) => {
    res.send('Snap Gig sever is running properly')
})
app.listen(port, (req, res) => {
    console.log(`listening to the port${port}`)
})
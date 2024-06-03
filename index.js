require('dotenv').config()
const express = require('express')
const cors = require('cors')
const stripe = require("stripe")(process.env.STRIPE_PAYMENT_SECRET);
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
        const paymentCollection = client.db('snapGigDB').collection('payments')

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
        app.patch('/task/:id', async (req, res) => {
            const data = req.body
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    taskTitle: data?.taskTitle,
                    taskDetails: data?.taskDetails,
                    submissionInfo: data?.submissionInfo
                }
            }
            console.log(data)
            const result = await taskCollection.updateOne(query, updatedDoc)
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

        // user/worker related api

        app.delete('/worker/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const removedUser = await userCollection.deleteOne(query)
            res.send(removedUser)
        })

        app.patch('/worker/:id', async (req, res) => {
            const data = req.body
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: data.role
                }
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        // JWT related APIs

        app.post('/jwt', async (req, res) => {
            const email = req.body
            const token = jwt.sign(email, process.env.TOKEN_SECRET, { expiresIn: '8d' })
            res.send({ token })
        })

        // stripe related api


        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body
            const amount = parseInt(price * 100)
            console.log(amount, 'the total price to be paid by customer')
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.post('/payments', async (req, res) => {
            const data = req.body
            const amount = data?.price
            const email = data?.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const userCoin = user?.coin
            let newCoin = 0
            let showCoin = 0
            if (amount === 1) {
                newCoin = userCoin + 10
                showCoin = 10
            }
            if (amount === 9) {
                newCoin = userCoin + 100
                showCoin = 100
            }
            if (amount === 19) {
                newCoin = userCoin + 500
                showCoin = 500
            }
            if (amount === 39) {
                newCoin = userCoin + 1000
                showCoin = 1000
            }
            const updatedDoc = {
                $set: {
                    coin: newCoin
                }
            }
            if (newCoin === 0) {
                return res.send(`no changes occurs`)
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            result.coinMessage = showCoin
            const savePaymentHistory = await paymentCollection.insertOne(data)
            res.send(result)
        })

        app.get('/payment/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const findUserData = await paymentCollection.find(query).toArray()
            res.send(findUserData)
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
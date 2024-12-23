const express = require('express')
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const port = process.env.PORT || 5000

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://job-portal-447d9.web.app',
      'https://job-portal-447d9.firebaseapp.com'
    ],
    credentials: true
  })
)
app.use(express.json())
app.use(cookieParser())

// Create custom Middleware
const authenticateJWT = (req, res, next) => {
  const token = req?.cookies?.token
  if (!token) {
    return res.status(401).send({ message: 'Access Denied' })
  }

  const verified = jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET,
    (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: 'Access Denied' })
      }
      req.user = decoded
      next()
    }
  )
}

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0-shard-00-00.xk6aw.mongodb.net:27017,cluster0-shard-00-01.xk6aw.mongodb.net:27017,cluster0-shard-00-02.xk6aw.mongodb.net:27017/?ssl=true&replicaSet=atlas-hzc62o-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

async function run () {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect()
    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )

    //Job Related API's
    const jobCollection = client.db('jobPortal').collection('jobs')
    const jobApplicationCollection = client
      .db('jobPortal')
      .collection('jobApplications')

    // Auth Related API's
    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, {
        expiresIn: '5h'
      })
      console.log(token)
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        })
        .send({ success: true })
    })

    app.post('/logout', (req, res) => {
      res
        .clearCookie('token', {
          httpOnly: true,
          secure: true,
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        })
        .send({ success: true })
    })

    //Add new Job to Database
    app.post('/jobs', async (req, res) => {
      const job = req.body
      const result = await jobCollection.insertOne(job)
      res.json(result)
    })

    //Send Job Data from DB to Server
    app.get('/jobs', async (req, res) => {
      const cursor = jobCollection.find()
      const jobs = await cursor.toArray()
      res.send(jobs)
    })

    //Send Single Job Data from DB to Server
    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const job = await jobCollection.findOne(query)
      res.send(job)
    })

    // Send Job Application Data to Database
    app.post('/jobApplications', async (req, res) => {
      const jobApplication = req.body
      const result = await jobApplicationCollection.insertOne(jobApplication)
      res.json(result)
    })

    // Get Job Application Data from Database to Server by Email
    app.get('/jobApplications', authenticateJWT, async (req, res) => {
      const email = req.query.email
      const query = { applicantEmail: email }

      console.log('Cookies: ', req.cookies)

      if (req.user.email !== email) {
        return res.status(403).send({ message: 'Forbidden' })
      }

      const jobApplications = await jobApplicationCollection
        .find(query)
        .toArray()

      for (application of jobApplications) {
        const jobId = application.jobId
        const jobQuery = { _id: new ObjectId(jobId) }
        const job = await jobCollection.findOne(jobQuery)

        if (job) {
          application.title = job.title
          application.company = job.company
          application.location = job.location
          application.company_logo = job.company_logo
        }
      }
      res.send(jobApplications)
    })

    // Delete Job Application Data from Database
    app.delete('/jobApplications/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await jobApplicationCollection.deleteOne(query)
      res.json(result)
    })
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close()
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Job Portal Backend')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})

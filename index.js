const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

// middleware
app.use(cors());
app.use(express.json());
const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    !authorization &&
      res.status(401).send({ error: true, message: 'unauthorized user' });
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (err, decoded) => {
      if (err) {
        return res
          .status(403)
          .send({ error: true, message: 'unauthorized user' });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  };  

// Mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1yvmtut.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const userCollection = client
      .db('pencilPerfectionistDB')
      .collection('users');

    /* userCollection start*/
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.get('/users, async', async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
      });
    /* userCollection end*/
     /* Jwt start */
     app.post('/jwt', (req, res) => {
        const query = req.body;
        const token = jwt.sign(
          {
            query,
          },
          process.env.JWT_ACCESS_TOKEN,
          { expiresIn: '1h' }
        );
        res.send(token);
      });
      /* Jwt end */

    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  console.log('pencil perfectionist is running on ', port);
});
app.listen(port, () => {
  console.log(port);
});

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());
const verifyJwt = (req, res, next) => {
  const authorization = req?.headers?.authorization;
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
    const classCollection = client
      .db('pencilPerfectionistDB')
      .collection('classes');
    const bookedCollection = client
      .db('pencilPerfectionistDB')
      .collection('booked');
    const historyCollection = client
      .db('pencilPerfectionistDB')
      .collection('paymentHistory');
    const enrolledCollection = client
      .db('pencilPerfectionistDB')
      .collection('enrolled');
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
      res.send({ token });
    });
    const verifyAdmin = async (req, res, next) => {
      const email = req?.decoded?.query?.email;
      const user = await userCollection.findOne({ email: email });
      if (user?.role !== 'admin') {
        return res
          .status(403)
          .send({ error: true, message: 'unauthorized user' });
      } else {
        next();
      }
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req?.decoded?.query?.email;
      const user = await userCollection.findOne({ email: email });
      if (user?.role !== 'instructor') {
        return res
          .status(403)
          .send({ error: true, message: 'unauthorized user' });
      } else {
        next();
      }
    };
    const verifyUser = async (req, res, next) => {
      const email = req?.decoded?.query?.email;
      const user = await userCollection.findOne({ email: email });
      if (!user) {
        return res
          .status(403)
          .send({ error: true, message: 'unauthorized user' });
      } else {
        next();
      }
    };
    /* Jwt end */

    /* userCollection start*/
    app.post('/users', async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const userExist = await userCollection.findOne({ email: email });
      if (userExist) {
        return;
      }
      const countUser = await userCollection.countDocuments();

      req.body.count = countUser + 1;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.patch(
      '/users/adminUpdate/:id',
      verifyJwt,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const role = req.body.role;
        const query = { _id: new ObjectId(id) };
        const updateRole = {
          $set: {
            role: role,
          },
        };
        const result = await userCollection.updateOne(query, updateRole);
        res.send(result);
      }
    );
    app.get('/users', verifyJwt, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().sort({ count: -1 }).toArray();
      res.send(result);
    });
    app.get('/users/user/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email: email });
      if (result?.role === 'admin') {
        return res.send({ role: 'admin', _id: result?._id });
      } else if (result?.role === 'instructor') {
        return res.send({ role: 'instructor', _id: result?._id });
      } else if (result?.role === 'student') {
        return res.send({ role: 'student', _id: result?._id });
      }
      res.status(403).send({ error: true, message: 'Access Forbidden' });
    });
    //TODO: USER PATCH DOESN'T WORK
    app.patch('users/user/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          request: 'instructor',
        },
      };
      const result = await userCollection.updateOne(query, update);
      res.send(result);
    });

    app.get('/instructors', async (req, res) => {
      const result = await userCollection
        .find({ role: 'instructor' })
        .sort({ count: -1 })
        .toArray();
      res.send(result);
    });
    /* userCollection end*/

    /* Class collection start */
    app.get('/classes/popularClasses', async (req, res) => {
      const result = await classCollection
        .find({ status: 'approved' })
        .limit(6)
        .sort({ totalEnrolled: -1 })
        .toArray();
      res.send(result);
    });
    app.get('/class/:id', async (req, res) => {
      const id = req.params.id;
      const result = await classCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.get('/allClasses', async (req, res) => {
      const result = await classCollection
        .find({ status: 'approved' })
        .sort({ count: -1 })
        .toArray();
      res.send(result);
    });
    app.get('/allClasses/admin', verifyJwt, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().sort({ count: -1 }).toArray();
      res.send(result);
    });
    app.patch(
      '/allClasses/updateStatus/:id',
      verifyJwt,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const status = req.body.status;
        const query = { _id: new ObjectId(id) };
        const updateStatus = {
          $set: {
            status: status,
            request: 'none',
          },
        };
        const result = await classCollection.updateOne(query, updateStatus);
        res.send(result);
      }
    );
    app.delete('/allClasses/delete/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });
    app.post(
      '/adClass/instructor',
      verifyJwt,
      verifyInstructor,
      async (req, res) => {
        const newClass = req.body;
        req.body.totalEnrolled = 0;
        req.body.totalEarn = 0;
        req.request = 'none';
        const classCount = await classCollection.estimatedDocumentCount();
        req.body.count = classCount + 1;
        const result = await classCollection.insertOne(newClass);
        res.send(result);
      }
    );
    app.get(
      '/classes/instructorClasses/:email',
      verifyJwt,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const decodedEmail = req?.decoded?.query?.email;
        if (email !== decodedEmail) {
          return res.status(403).send({ error: true, message: 'Forbidden' });
        }
        const result = await classCollection
          .find({ instructor_mail: email })
          .sort({ count: -1 })
          .toArray();
        res.send(result);
      }
    );
    /* Class collection end */

    /* booked Collection start */
    app.post('/classes/booked', verifyJwt, verifyUser, async (req, res) => {
      const query = req.body;
      const count = await bookedCollection.estimatedDocumentCount();
      req.body.count = count + 1;
      const result = await bookedCollection.insertOne(query);
      res.send(result);
    });
    app.get(
      '/classes/booked/:email',
      verifyJwt,
      verifyUser,
      async (req, res) => {
        const email = req.params.email;
        const decodedEmail = req?.decoded?.query?.email;
        if (email !== decodedEmail) {
          return res.status(403).send({ error: true, message: 'Forbidden' });
        }
        const query = { email: email };
        const result = await bookedCollection
          .find(query)
          .sort({ count: -1 })
          .toArray();
        res.send(result);
      }
    );
    app.delete(
      '/classes/deleteBooked/:id',
      verifyJwt,
      verifyUser,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookedCollection.deleteOne(query);
        res.send(result);
      }
    );

    /* booked Collection end */
    /* stripe payment start */
    app.post('/create-payment-intent', verifyJwt, async (req, res) => {
      const { price } = req.body;
      if (price <= 0) {
        return res.send({});
      }
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.post('/enrolledMany', verifyJwt, async (req, res) => {
      const data = req.body;
      const result = await enrolledCollection.insertMany(data);
      res.send(result);
    });
    app.delete('/deleteBookedClass/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await bookedCollection.deleteMany(filter);

      res.send(result);
    });
    app.post('/paymentHistory', verifyJwt, async (req, res) => {
      const history = req.body;
      const result = await historyCollection.insertOne(history);
      res.send(result);
    });

    /* stripe payment end */

    /* Enrolled Classes start  */

    app.get('/classes/enrolled/:email', verifyJwt, async (req, res) => {
      const email = req.params.email;
      const result = await enrolledCollection.find({ email: email }).toArray();
      res.send(result);
    });
    /* Enrolled Classes end */
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('pencil perfectionist is running on ');
});
app.listen(port, () => {
  console.log(port);
});

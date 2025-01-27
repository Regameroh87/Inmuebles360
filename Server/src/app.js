require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes/index');
require('./scheduled tasks/sendEmailAtTheEndOfTheReservation.js')
const Stripe = require('stripe');
const MongoStore = require('connect-mongo');


const passport = require('passport');
require('../middlewares/authLocal');
require('../middlewares/google');
const Users = require('../src/models/user');
const flash = require('connect-flash');
const session = require('express-session');

const stripe = new Stripe(process.env.API_KEY_STRIPE); 

const multer = require('multer');
const storage = multer.memoryStorage(); // Almacenamiento en memoria (puedes cambiarlo para guardar en disco si lo prefieres)

const server = express();

const corsOptions = {
	origin: "https://inmuebles-360.vercel.app",
	methods: 'GET, POST, OPTIONS, PUT, DELETE',
	allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept', // Solo permite estos encabezados
	credentials: true, // Permite enviar cookies
	optionsSuccessStatus: 204,
	exposedHeaders: 'Access-Control-Allow-Credentials',
	
};



server.use(express.json());
server.use(cors(corsOptions));
server.options('*', cors(corsOptions));
server.use(bodyParser.json({ limit: '50mb' }));
server.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
server.use(cookieParser());
server.use(morgan('dev'));



//CONFIG DE EXPRESS-SESSION
server.use(
	session({
		secret: 'inmuebles', 
		resave: false, 
		saveUninitialized: false,
		store: MongoStore.create({
			mongoUrl: process.env.MONGODB_URI,
		  }),
		  cookie: {
			maxAge: 24 * 60 * 60 * 1000,
			secure: true,
			httpOnly: true,
			sameSite: 'None',
			domain: "inmuebles-360.vercel.app",
		  },
		logErrors: true,
	})
);

server.use((req, res, next) => {
	// console.log('Cabeceras de la solicitud:', req.headers);
	console.log('Cookies que llegan:', req.cookies);
	next(); 
});

server.use(passport.initialize());
server.use(passport.session());

passport.serializeUser((user, done) => {
	console.log('Serializando usuario:', user.email);
	return done(null, user._id);
});

passport.deserializeUser(async (_id, done) => {
	console.log('Deserializando usuario por ID:', _id);
	try {
		const user = await Users.findById(_id);
		if (!user) {
			console.log('Usuario no encontrado.');
			return done(null, false);
		}
		console.log('Usuario deserializado:', user.email);
		return done(null, user);
	} catch (err) {
		console.log('error en la deserializacion');
		return done(err, null);
	}
});

// CONFIGURA LOS MSJS QUE LLEGAN DE LA ESTRATEGIA
server.use(flash());

//back para pasarela de pagos
server.post('/api/checkout', async (req, res) => {
	try {
		const { id, amount } = req.body;

		const payment = await stripe.paymentIntents.create({
			amount,
			currency: 'USD',
			description: '',
			payment_method: id,
			confirm: true,
			return_url:  "https://inmuebles-360.vercel.app/",
		});

		res.status(200).send();
	} catch (error) {
		res.status(500).json({ message: error.message });
	}//Mandar mail que  hizo pago para verificar 
	//
});
//back para pasarela de pagos fin

server.use('/', routes);

server.use((err, req, res, next) => {
	const status = err.status || 500;
	const message = err.message || err;
	console.error(err);
	res.status(status).send(message);
});

module.exports = server;

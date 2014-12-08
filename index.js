var express = require('express'),
    exphbs = require('express-handlebars'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    session = require('express-session'),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    config = require('./config.js'),
    Redis = require('redis');

var redis = Redis.createClient(6379, config.redis, {})
redis.on("error", function (err) {
    console.log("Redis Error: " + err);
});

var kafka = require('kafka-node'),
    Consumer = kafka.Consumer,
    client = new kafka.Client(config.kafka),
    consumer = new Consumer(
        client,
        [
            { topic: 'results', partition: 0 }
        ],
        {
            autoCommit: true
        }
    );

var config = require('./config.js'), // config file contains all tokens and other private info
    funct = require('./functions.js'); // funct file contains our helper functions for our Passport and database work

var app = express();

//===============PASSPORT===============

// Passport session setup.
passport.serializeUser(function(user, done) {
  console.log("serializing " + user.username);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("deserializing " + obj);
  done(null, obj);
});

// Use the LocalStrategy within Passport to login/”signin” users.
passport.use('local-signin', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localAuth(username, password)
    .then(function (user) {
      if (user) {
        console.log("LOGGED IN AS: " + user.username);
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT LOG IN");
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));

// Use the LocalStrategy within Passport to register/"signup" users.
passport.use('local-signup', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localReg(username, password)
    .then(function (user) {
      if (user) {
        console.log("REGISTERED: " + user.username);
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT REGISTER");
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));

// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  req.session.error = 'Please sign in!';
  res.redirect('/signin');
}

//===============EXPRESS================

// Configure Express
app.use(logger('combined'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(session({secret: 'supernova', saveUninitialized: true, resave: true}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));

// Configure express to use handlebars templates
var hbs = exphbs.create({
    defaultLayout: 'main'
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

//===============ROUTES===============

//displays our homepage
app.get('/', function(req, res){
  res.render('home', {user: req.user});
});

//displays our signup page
app.get('/signin', function(req, res){
  res.render('signin');
});

//sends the request through our local signup strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/local-reg', passport.authenticate('local-signup', {
  successRedirect: '/',
  failureRedirect: '/signin'
  })
);

//sends the request through our local login/signin strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/login', passport.authenticate('local-signin', { 
  successRedirect: '/',
  failureRedirect: '/signin'
  })
);

//logs user out of site, deleting them from the session, and returns to homepage
app.get('/logout', function(req, res){
  var name = req.user.username;
  console.log("LOGGIN OUT " + req.user.username)
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out " + name + "!";
});

//===============PORT=================
var port = process.env.PORT || 5000; //select your port or let it pull from your .env file
var http = require('http').Server(app); 
http.listen(port);
console.log("Listening on port: " + port);

var writeMarkerToDB = function(request) {
  var key = request.id;
  var value = request.lat + "|" + request.lon + "|" + request.radius_km + "|" + request.feature;
  redis.set(key, value, redis.print);
  redis.sadd("fences", key, redis.print);
}

var io = require('socket.io')(http); 
io.on('connection', function (socket) { 
  // Read the DB and Send Marker Info to the Client
  redis.smembers("fences", function(err, markerUIDs) {
    if (markerUIDs != null && markerUIDs.length > 0) {
      markerUIDs.forEach(function (markerUID, i) {
        redis.get(markerUID, function(err, info) {
          var marker = {};
          var markerInfo = info.split('|');
          marker.lat = markerInfo[0];
          marker.lng = markerInfo[1];
          marker.radius = parseInt(markerInfo[2]) * 1000;
          marker.type = markerInfo[3];
          marker.id = markerUID;
          socket.emit('load marker', marker);
        });
      });
    }
  });
  // Listen to topics from Kafka and send it to the database
  consumer.on('message', function (data) {
    if (data.value) {
      var updates = JSON.parse(data.value);
      var markerUpdates = [];
      for (var markerUUID in updates) {
        var update = updates[markerUUID];
        var markerInfo = {}
        markerInfo.id = markerUUID;
        markerInfo.feature = update.feature;
        if (markerInfo.feature === "trend") {
          markerInfo.trends = update.trends;
        }
        if (markerInfo.feature === "count"){
          markerInfo.count = update.count;
        }
        markerUpdates.push(markerInfo);
      }
      socket.emit('load twitter data', markerUpdates);
    }
  });
  // Listen for marker removal requests
  socket.on('remove marker request', function(markerUUID) {
    redis.srem("fences", markerUUID, redis.print);
    redis.del(markerUUID, redis.print);
  })
  // Add marker to database with the count option
  socket.on('count request', function(request) {
    writeMarkerToDB(request);
  });
  // Add marker to database with the trend option
  socket.on('trend request', function(request) {
    writeMarkerToDB(request);
  });
});

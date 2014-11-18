var app = require('express')();
var http = require('http').Server(app); 

app.set('port', process.env.PORT || 3000);

http.listen(app.get('port'), function() {  
  console.log('Express server listening on port ' + app.get('port'));
});

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var Twit = require('twit');  
var T = new Twit({  
  consumer_key: 'fklWWQROAC69xJX337Z8Tpoas',
  consumer_secret: 'tfC8sodrY2G5ws5CHXscY4wFi8sB8o68E0FFCXeRSfFxN5m0A4',
  access_token: '1056098544-N42lVlU0OTQWw5S2CtvLZzJoplyrMCDNwl0lPZV',
  access_token_secret: 'O2f2Zu3xFuMK3Axk7GudKgqq2PFV8GCwDPLBYos3eht7O'
});

var io = require('socket.io')(http); 

// filter the public stream by english tweets containing `#apple`
var appleStream = T.stream('statuses/filter', { track: '#apple', language: 'en' });
// filter the public stream by english tweets containing `#apple`
var orangeStream = T.stream('statuses/filter', { track: '#orange', language: 'en' });

io.on('connection', function (socket) { 
  var appleTweetCount = 0;
  var orangeTweetCount = 0;
  appleStream.on('tweet', function(tweet) {
  	appleTweetCount += 1;
    socket.emit('appleTweet', { count: appleTweetCount});
  });
  orangeStream.on('tweet', function(tweet) {
    orangeTweetCount += 1;
    socket.emit('orangeTweet', { count: orangeTweetCount});
  });
});

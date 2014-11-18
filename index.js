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
  consumer_key: 'HbbEIcATMEM2SMVIWXbMefIyR',
  consumer_secret: 'cdQ2Wq54XbF08tZ7EUjw1tmQDtFVowRGszr86BD4JnGzBOLFyV',
  access_token: '1056098544-hQL3guqW6k6dqETspAYVrjDieJewzxTOqq73G5R',
  access_token_secret: 'YUSIqPcU9dpXuD16QeI4mjflh3xH7QZ4FhW3NbVDn9Plh'
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




var express = require('express');
var app = express();
var bodyParser = require('body-parser');

app.set('port', (process.env.PORT || 5000));

//app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.post('/', function(req, res) {
 res.send(JSON.stringify(req.body.results));
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

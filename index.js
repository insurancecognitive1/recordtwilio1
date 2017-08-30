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
    console.log(JSON.stringify(req.body));
 res.send(JSON.stringify(req.body.results));
});

app.get('/', function(req, res) {
    console.log("reached get");
    res.send("Thank you for visiting!");
 
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

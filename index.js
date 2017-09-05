var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const watson = require('watson-developer-cloud');
const request = require('request');
const cheerio = require('cheerio');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const AWS = require('aws-sdk');

AWS.config.update({ accessKeyId: 'AKIAJKLQ5CU7VO4MA2EA', secretAccessKey: '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' });

// Create an Polly client
const Polly = new AWS.Polly({
    signatureVersion: 'v4',
    region: 'us-east-1'
});

var conversation = watson.conversation({
  username: "3132dae2-65a7-4355-b2a8-9aa7d75b5021",
  password: "0FFcPwapKeYB",
  version: "v1",
  version_date: "2017-04-21"
});
var conv_workspace_id = "3fc1cda3-2523-45c8-9804-bff797b6f959";

var collife_faq_url = 'https://www.coloniallife.com/FAQ.aspx';

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


//get the request from Twilio and send the response
app.post('/twilio', function(req, res) {

    var twilio_content = "";
    if (req.body.hasOwnProperty("SpeechResult")) {
        twilio_content = req.body.SpeechResult;
    }
    const twiml = new VoiceResponse();
    const gather = twiml.gather({    
        input:   'speech'
    });
    
    //upload the audio to amazon s3 using polly
    function uploadaudio(rslt, done) {
        var chat_text = rslt;
        let params = {
            'Text': chat_text,
            'OutputFormat': 'mp3',
            'VoiceId': 'Salli',
            'SampleRate': '8000'
        }
        Polly.synthesizeSpeech(params, (err, data) => {
            if (err) {
                done(err);
                console.log("Error:" + err.code);
            } else if (data) {
                if (data.AudioStream instanceof Buffer) {
                        var s3 = new AWS.S3();
                        var s3Params = {
                            Bucket: 'twilioplay',
                            Key: 'chat_collife.mp3',
                            Body: data.AudioStream,
                            ACL: "public-read",
                            ContentType: "audio/mp3"
                        };
                        s3.putObject(s3Params, function(resp) {
                            done(null, resp);
                            //console.log(arguments);
                            //console.log('Successfully uploaded package.');
                        });

                    //});
                }
            }
        });
    }
    
    var url, rslt;
    var type = "Device";
    var callfaq = true;

    if (twilio_content == "") {
        rslt = "Hi! I am Claire. I can help with any questions you have on your Coloniallife policy, coverage, billing or claim";
        uploadaudio(rslt, function(err, data) {
            if (err) {
                gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
            } else {
                gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                res.writeHead(200, {
                    'Content-Type': 'text/xml'
                });
                res.end(twiml.toString());
            }
        });
    } else {
        var text = twilio_content;
        var context = {};
        conversation.message({
            workspace_id: conv_workspace_id,
            input: {
                text: text
            },
            context: context,
            alternate_intents: true
        }, function(err, response) {
            if (err) {
                console.log('error:', err);
                callfaq = false;
                rslt = "Sorry, I don't have a response for your question. Please ask questions on your Coloniallife policy, coverage, billing or claim";
                uploadaudio(rslt, function(err, data) {
                    if (err) {
                        gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                    } else {
                        gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                        res.writeHead(200, {
                            'Content-Type': 'text/xml'
                        });
                        res.end(twiml.toString());
                    }
                });
            } else {
                //console.log("Complete response" +JSON.stringify(response, null, 2));
                //res.send(JSON.stringify(response,null,2));
                var resp = JSON.parse('{"result":' + JSON.stringify(response, null, 2) + '}');
                if (!resp.result.hasOwnProperty("code")) {
                    //console.log("Conversation API response: " + resp.result.output.text);
                    //console.log("Context: " +resp.result.context);
                    var bot_text = resp.result.output.text;
                    context = resp.result.context;
                    var intents_length = resp.result.intents.length;
                    if (intents_length > 0) {
                        var intents = resp.result.intents[0].intent;
                        console.log("Intents Twilio: " + resp.result.intents[0].intent);
			if (intents == "accountsetup" || intents == "claimstatus" || intents == "policystatus" || intents == "policyholders_policypaper" || intents == "enrollcoverage" || intents == "fileclaim" || intents == "billing_quickpay" || intents == "billing_paypremium") {
                            url = collife_faq_url;
                        } else if (intents == "dialCSR") {
                            callfaq = false;
                            rslt = "Okay. We will transfer the call with our representative.";
                            uploadaudio(rslt, function(err, data) {
                                if (err) {
                                    gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                                } else {
                                    const dialcsr = new VoiceResponse();
                                    dialcsr.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
				    //dialcsr.dial('317-854-5164');
				    dialcsr.dial('+919994753161');

		                   /*const dial = dialcsr.dial({callerId: '+919840425569'});
				     dial.number('+12015629180');*/
		
		                    res.writeHead(200, {
		                          'Content-Type': 'text/xml'
		                    });
		                    res.end(dialcsr.toString());                                    
                                }
                            });                            
                        } else if (intents == "cs-hello") {
                            callfaq = false;
                            rslt = "Hi there! What can I do for you today?";
                            uploadaudio(rslt, function(err, data) {
                                if (err) {
                                    gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                                } else {
                                    gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                                    res.writeHead(200, {
                                        'Content-Type': 'text/xml'
                                    });
                                    res.end(twiml.toString());
                                }
                            });
                        } else if (intents == "cs-help") {
                            callfaq = false;
                            rslt = "Hello! I can help with any questions you have on your Coloniallife policy, coverage, billing or claim";
                            uploadaudio(rslt, function(err, data) {
                                if (err) {
                                    gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                                } else {
                                    gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                                    res.writeHead(200, {
                                        'Content-Type': 'text/xml'
                                    });
                                    res.end(twiml.toString());
                                }
                            });
                        } else if (intents == "cs-thankyou") {
                            callfaq = false;
                            rslt = "Thank you. Have a great day!";
                            uploadaudio(rslt, function(err, data) {
                            	if (err) {
                                    gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                                } else {
                                    const endprompt = new VoiceResponse();
                                    endprompt.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                                    res.writeHead(200, {
                                        'Content-Type': 'text/xml'
                                    });
                                    res.end(endprompt.toString());
                                }
                            });
                        } else {
                            callfaq = false;
                            rslt = "Sorry, I don't have a response for your question. Please ask questions on your Coloniallife policy, coverage, billing or claim";
                            uploadaudio(rslt, function(err, data) {
                                if (err) {
                                    gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                                } else {                                    
                                    gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                                    res.writeHead(200, {
                                        'Content-Type': 'text/xml'
                                    });
                                    res.end(twiml.toString());
                                }
                            });
                        }
                    } //end of intents length check

                    if (callfaq == true) { //This function is executed only if intents exist
                        get_faq_resp(url, intents, type, function(err, result) {
                            if (err) {
                                console.log(err);
                                uploadaudio(err, function(err, data) {
                                    if (err) {
                                       gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                                    } else {
                                        gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                                        res.writeHead(200, {
                                            'Content-Type': 'text/xml'
                                        });
                                        res.end(twiml.toString());
                                    }
                                });
                            } else {
                                if (intents == "cs-contact") {
                                    result = "Here's the Colonial claim's call center details: " + result;
                                }
                                result = result + "\n\nIs there anything else I may assist you with today?";
                                uploadaudio(result, function(err, data) {
                                    if (err) {
                                        gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                                    } else {
                                        gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                                        res.writeHead(200, {
                                            'Content-Type': 'text/xml'
                                        });
                                        res.end(twiml.toString());
                                    }
                                });
                            }
                        });
                    } //end of callfaq check

                } else {
                    callfaq = false;
                    rslt = "Sorry, I don't have a response for your question. Please ask again after some time.";
                    uploadaudio(rslt, function(err, data) {
                        if (err) {
                            gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
                        } else {
                            gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
                            res.writeHead(200, {
                                'Content-Type': 'text/xml'
                            });
                            res.end(twiml.toString());
                        }
                    });
                } //end of code property check
            }
        }); // end of Conversation API call
    }
});

//get faq response
function get_faq_resp(url, intent, type, done){
  request(url, function(error, response, html){
    if(!error){
      var $ = cheerio.load(html);
      var desc, count=0;
      var loadtype = "";
      if (intent == "cs-contact" || intent == "cscontact" ){
        $('.text').filter(function(){
          var data = $(this);
          desc = data.children().eq(3).html();
          loadtype = "html";
          //var test = $(desc).text();
          //console.log("Text only result: "+test);
          //var cleanText = desc.replace(/<\/?[^>]+(>|$)/g, "");
          //console.log("Text only result: "+cleanText);
        }); //end of text filter loop
      } else {
        $('.basicBox').filter(function(){
          var data = $(this);
          count++;
          if (intent == "accountsetup"){
            desc = data.children().eq(0).children().eq(1).text();
          }else if (intent == "claimstatus"){
            desc = data.children().eq(1).children().eq(1).text();
          }else if (intent == "policystatus"){
            desc = data.children().eq(2).children().eq(1).text();
          }else if (intent == "policyholders_policypaper"){
            desc = data.children().eq(3).children().eq(1).text();
          }else if (intent == "enrollcoverage"){
            desc = data.children().eq(4).children().eq(1).text();
          }else if (intent == "fileclaim"){
            desc = data.children().eq(6).children().eq(1).text();
          }else if (intent == "billing_quickpay"){
            desc = data.children().eq(7).children().eq(1).text();
          }else if (intent == "billing_paypremium"){
            desc = data.children().eq(9).children().eq(1).text();
          }	
        }); //end of basicBox filter loop
        count = 0;
      } //end of intent check
      //console.log("Web Scrap result: "+desc);
      if (type == "Device" && loadtype == "html"){
        if (intent != "cscontact"){  //In cscontact intent - Question is not exist in first line, So not required to remove the first line (i.e, question) from desc
          var startindex = desc.indexOf("</strong>");
          desc = desc.substring(startindex);
        }
        desc = $(desc).text();
      }
      done(null,desc);
    }else{
      done(error);
    }
  }); //end of request
}

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

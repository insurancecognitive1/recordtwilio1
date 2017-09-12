const express = require('express');
const app = express();
var bodyParser = require('body-parser');
var fs = require('fs');
const watson = require('watson-developer-cloud');
const request = require('request');
const cheerio = require('cheerio');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const AWS = require('aws-sdk');
var apiai = require('apiai');

//Set this before running
AWS.config.update({ accessKeyId: '', secretAccessKey: '' });

// Create an Polly client
const Polly = new AWS.Polly({
    signatureVersion: 'v4',
    region: 'us-east-1'
});

//colonial Life
var conversation = watson.conversation({
  username: "3132dae2-65a7-4355-b2a8-9aa7d75b5021",
  password: "0FFcPwapKeYB",
  version: "v1",
  version_date: "2017-04-21"
});
var conv_workspace_id = "3fc1cda3-2523-45c8-9804-bff797b6f959";
var collife_faq_url = 'https://www.coloniallife.com/FAQ.aspx';

//nationwide
var nw_conversation = watson.conversation({
  username: "b29162f5-68d4-4ffe-b02c-74aa067b046a",
  password: "QBKprxkGo3lt",
  version: "v1",
  version_date: "2017-04-21"
});
var nw_conv_workspace_id = "316c3ed9-6354-42fe-bec0-9c3c6ff64ba3";
var prop_url = 'https://www2.chubb.com/us-en/claims/faq-property.aspx';
var auto_url = 'https://www2.chubb.com/us-en/claims/faq-auto.aspx';
var contacts_url = 'https://www2.chubb.com/us-en/individuals-families/l-chubb-report-a-claim.aspx';
var billing_url = 'https://www2.chubb.com/us-en/individuals-families/about-billing.aspx';
var policyholders_url = 'https://www2.chubb.com/us-en/individuals-families/already-a-customer.aspx';

app.set('port', (process.env.PORT || 5000));

//app.use(express.static(__dirname + '/public'));
/*app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());*/
app.use(bodyParser());


app.post('/', function(req, res) {
    console.log(JSON.stringify(req.body));
// res.send(JSON.stringify({ "input": {"text":""},"context": req.body.context, "entities": [], "intents": [], "output": {"log_messages": [],"text": ["Hello world"],"nodes_visited":[]} })); 
});


app.post('/v1/workspaces/270132c6-0104-4509-a64f-a21ef33fb47f/message', function(req, res) {
        console.log('Reached post message conversation');
	console.log(JSON.stringify(req.body));
	console.log('Sending data back');
console.log(JSON.stringify({ "input": {"text":""},"context": {}, "entities": [], "intents": [], "output": {"log_messages": [],"text": ["Hello world"],"nodes_visited":[]} })); 	
 res.json({ "input": {"text":""},"context": {}, "entities": [], "intents": [], "output": {"log_messages": [],"text": ["Hello world"],"nodes_visited":[]} }); 
	console.log('sent message');
});

app.get('/', function(req, res) {
    console.log("reached get");
    res.send("Thank you for visiting!");
 
});


//get the request from Twilio and send the response
app.post('/twilio', function(req, res) {
    console.log(req.body);
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
        var params = {
            'Text': chat_text,
            'OutputFormat': 'mp3',
            'VoiceId': 'Salli',
            'SampleRate': '8000'
        };
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
        rslt = "Hi! I am Claire. I can help with any questions you have on your Colonial Life policy, coverage, billing or claim";
	console.log(rslt);
        uploadaudio(rslt, function(err, data) {
            if (err) {
		console.log("Error Polly: " +err);
                gather.play("https://s3.amazonaws.com/twilioplay/pollyerror.mp3");
            } else {
                gather.play("https://s3.amazonaws.com/twilioplay/chat_collife.mp3");
		//gather.say(rslt);
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
                rslt = "Sorry, I don't have a response for your question. Please ask questions on your Colonial Life policy, coverage, billing or claim";
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
                console.log("Complete response" +JSON.stringify(response, null, 2));
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
                            rslt = "Hello! I can help with any questions you have on your Colonial Life policy, coverage, billing or claim";
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
                            rslt = "Sorry, I don't have a response for your question. Please ask questions on your Colonial Life policy, coverage, billing or claim";
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
      //Adding FAQ url along with description
      desc = desc.replace("upper right corner of the page", "upper right corner of the page (https://www.coloniallife.com");
      desc = desc.replace("upper right hand corner of the screen", "upper right hand corner of the screen (https://www.coloniallife.com)");
      done(null,desc);
    }else{
      done(error);
    }
  }); //end of request
}


//get the request from Twilio and send the response
app.post('/nationwidetwilio', function(req, res) {

  var twilio_content = "";
  if (req.body.hasOwnProperty("SpeechResult")){
    twilio_content = req.body.SpeechResult;
  }
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    input:'speech'
  });

  //var twilio_content = "I need to speak with agent";
  var url, rslt;
  var type = "Device";
  var callfaq = true;

  if (twilio_content == ""){
    rslt = "Hi! I am Claire. I can help with any questions you have on your Nationwide policy, coverage, billing or claim";
    gather.say({voice:'alice', language: "en-US"},rslt);
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  }else{
    var text=twilio_content;
    var context={};
    nw_conversation.message({
      workspace_id: nw_conv_workspace_id,
      input: {text: text},
      context: context,
      alternate_intents: true
    }, function(err, response) {
      if (err){
        console.log('error:', err);
        //res.send(err)
        callfaq = false;
        rslt = "Sorry, I don't have an response for your question. Please ask questions on your Nationwide policy, coverage, billing or claim";
        gather.say({voice:'alice', language: "en-US"},rslt);
        res.writeHead(200, {'Content-Type': 'text/xml'});
        res.end(twiml.toString());
      }else{
        //console.log("Complete response" +JSON.stringify(response, null, 2));
        //res.send(JSON.stringify(response,null,2));
        var resp = JSON.parse('{"result":' + JSON.stringify(response,null,2) + '}');
        if (!resp.result.hasOwnProperty("code")){
          //console.log("Conversation API response: " + resp.result.output.text);
          //console.log("Context: " +resp.result.context);
          var bot_text = resp.result.output.text;
          context = resp.result.context;
          var intents_length = resp.result.intents.length;
          if (intents_length > 0) {
            var intents = resp.result.intents[0].intent;
            //console.log("Intents Twilio: " + resp.result.intents[0].intent);
            if (intents == "hometemp") {
              url = prop_url;
            }else if (intents == "carrepair" || intents == "carrent" || intents == "claimrequest"){
              url = auto_url;
            }else if (intents == "cs-contact"){
              url = contacts_url;
            }else if (intents == "billing_mail" || intents == "billing_paymentaddress" || intents == "billing_payelectronic" || intents == "billing_autopaysetup" || intents == "billing_quickpay" || intents == "billing_autopay" || intents == "billing_onetimepay" || intents == "billing_accountverify" || intents == "billing_anotheracc" || intents == "billing_paymentupdate" || intents == "billing_paymentverify" || intents == "billing_costverify"){
              url = billing_url;
            }else if (intents == "policyholders_policypaper" || intents == "policyholders_online" || intents == "policyholders_mailingaddress" || intents == "policyholders_billingaddress" || intents == "policyholders_wildfire" || intents == "policyholders_password" || intents == "policyholders_autoid"){
              url = policyholders_url;
            }else if (intents == "dialCSR"){
              callfaq = false;
              rslt = "Okay. We will transfer the call with our representative.";
              const dialcsr = new VoiceResponse();
              dialcsr.say({voice:'alice', language: "en-US"},rslt);
              dialcsr.dial('317-854-5164');
              /*const dial = dialcsr.dial({
    			       callerId: '+919840425569'
			          });
			        dial.number('+12015629180');*/
              res.writeHead(200, {'Content-Type': 'text/xml'});
              res.end(dialcsr.toString());
            }else if (intents == "cs-hello"){
              callfaq = false;
              rslt = "Hi there! What can I do for you today?";
              gather.say({voice:'alice', language: "en-US"},rslt);
              res.writeHead(200, {'Content-Type': 'text/xml'});
              res.end(twiml.toString());
            }else if (intents == "cs-help"){
              callfaq = false;
              rslt = "Hello! I can help with any questions you have on your Nationwide policy, coverage, billing or claim";
              gather.say({voice:'alice', language: "en-US"},rslt);
              res.writeHead(200, {'Content-Type': 'text/xml'});
              res.end(twiml.toString());
            }else if (intents == "cs-thankyou"){
              callfaq = false;
              rslt = "Thank you. Have a great day!";
              const endprompt = new VoiceResponse();
              endprompt.say({voice:'alice', language: "en-US"},rslt);
              res.writeHead(200, {'Content-Type': 'text/xml'});
              res.end(endprompt.toString());
            }else{
              callfaq = false;
              rslt = "Sorry, I don't have an response for your question. Please ask questions on your Nationwide policy, coverage, billing or claim";
              gather.say({voice:'alice', language: "en-US"},rslt);
              res.writeHead(200, {'Content-Type': 'text/xml'});
              res.end(twiml.toString());
            }
          } //end of intents length check

          if (callfaq == true){ //This function is executed only if intents exist
            nw_get_faq_resp(url, intents, type, function(err, result) {
              if (err) {
                console.log(err);
                gather.say({voice:'alice', language: "en-US"},err);
                res.writeHead(200, {'Content-Type': 'text/xml'});
                res.end(twiml.toString());
              }else{ 
		result = result.replace(/chubb/g,"nationwide");  //replace word chubb to nationwide
            	result = result.replace(/Chubb/g,"Nationwide");
                if (intents == "cs-contact"){
                  result = "Here's the Nationwide claim's call center details: " + result;
                }
                result = result + "\n\nIs there anything else I may assist you with today?";
                gather.say({voice:'alice', language: "en-US"},result);
                res.writeHead(200, {'Content-Type': 'text/xml'});
                res.end(twiml.toString());
              }
            });
          } //end of callfaq check

        }else{
          callfaq = false;
          rslt = "Sorry, I don't have an response for your question. Please ask again after some time.";
          gather.say({voice:'alice', language: "en-US"},rslt);
          res.writeHead(200, {'Content-Type': 'text/xml'});
          res.end(twiml.toString());
        } //end of code property check
      }
    });   // end of Conversation API call
  }
});

//get faq response
function nw_get_faq_resp(url, intent, type, done){
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
        }); //end of text filter loop
      } else {
        $('.expandCollapse').filter(function(){
          var data = $(this);
          count++;
          if (intent == "hometemp"){
            desc = data.children().eq(5).children().eq(1).text();
          }else if (intent == "carrepair"){
            desc = data.children().eq(4).children().eq(1).text();
          }else if (intent == "carrent"){
            desc = data.children().eq(5).children().eq(1).text();
          }else if (intent == "claimrequest"){
            var desc0 = data.children().eq(1).children().eq(1).text() + "|";
            for (var i = 0; i < data.children().eq(1).children().eq(2).children().length; i++);
            {
              var desc1 = "1. " + data.children().eq(1).children().eq(2).children().eq(0).text() + "|";
              var desc2 = "2. " + data.children().eq(1).children().eq(2).children().eq(1).text() + "|";
              var desc3 = "3. " + data.children().eq(1).children().eq(2).children().eq(2).text() + "|";
              var desc4 = "4. " + data.children().eq(1).children().eq(2).children().eq(3).text() + "|";
              var desc5 = "5. " + data.children().eq(1).children().eq(2).children().eq(4).text() + "|";
            }
            var desc6 = data.children().eq(1).children().eq(3).text();
            desc = desc0 + desc1 + desc2 + desc3 + desc4 + desc5 + desc6;
          }else if ((intent == "billing_mail" || intent == "billingmail") && count == 1){
            desc = data.children().eq(0).children().eq(1).text();
          }else if ((intent == "billing_paymentaddress" || intent == "billingpaymentaddress") && count == 1){
            desc = data.children().eq(2).html();
            loadtype = "html";
          }else if ((intent == "billing_payelectronic" || intent == "billingpayelectronic") && count == 1){
            desc = data.children().eq(3).html();
            loadtype = "html";
          }else if ((intent == "billing_autopaysetup" || intent == "billingautopaysetup") && count == 1){
            desc = data.children().eq(4).html();
            loadtype = "html";
          }else if ((intent == "billing_quickpay" || intent == "billingquickpay") && count == 1){
            desc = data.children().eq(5).html();
            loadtype = "html";
          }else if ((intent == "billing_autopay" || intent == "billingautopay") && count == 1){
            desc = data.children().eq(6).html();
            loadtype = "html";
          }else if ((intent == "billing_onetimepay" || intent == "billingonetimepay") && count == 1){
            desc = data.children().eq(7).html();
            loadtype = "html";
          }else if ((intent == "billing_accountverify" || intent == "billingaccountverify") && count == 1){
            desc = data.children().eq(9).children().eq(1).text();
          }else if ((intent == "billing_anotheracc" || intent == "billinganotheracc") && count == 1){
            desc = data.children().eq(10).children().eq(1).text();
          }else if ((intent == "billing_paymentupdate" || intent == "billingpaymentupdate") && count == 1){
            desc = data.children().eq(13).children().eq(1).text();
          }else if ((intent == "billing_paymentverify" || intent == "billingpaymentverify") && count == 1){
            desc = data.children().eq(14).children().eq(1).text();
          }else if ((intent == "billing_costverify" || intent == "billingcostverify") && count == 1){
            desc = data.children().eq(15).children().eq(1).text();
          }else if ((intent == "policyholders_policypaper" || intent == "policyholderspolicypaper") && count == 1){
            desc = data.children().eq(0).children().eq(1).text();
          }else if ((intent == "policyholders_online" || intent == "policyholdersonline") && count == 1){
            desc = data.children().eq(1).children().eq(1).text();
          }else if ((intent == "policyholders_mailingaddress" || intent == "policyholdersmailingaddress") && count == 1){
            desc = data.children().eq(2).children().eq(1).text();
          }else if ((intent == "policyholders_billingaddress" || intent == "policyholdersbillingaddress") && count == 1){
            desc = data.children().eq(3).children().eq(1).text();
          }else if ((intent == "policyholders_wildfire" || intent == "policyholderswildfire") && count == 1){
            desc = data.children().eq(5).html();
            loadtype = "html";
          }else if ((intent == "policyholders_password" || intent == "policyholderspassword") && count == 1){
            desc = data.children().eq(6).children().eq(1).text();
          }else if ((intent == "policyholders_autoid" || intent == "policyholdersautoid") && count == 1){
            desc = data.children().eq(7).html();
            loadtype = "html";
          }
        }); //end of expandCollapse filter loop
        count = 0;
      } //end of intent check
      //console.log("Web Scrap result: "+desc);
      if (type == "Device" && loadtype == "html"){
        if (intent != "cscontact"){  //In cscontact intent - Question is not exist in first line, So no required to remove the first line (i.e, question) from desc
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

//Calling the Google API services
app.post('/policyhelpdesktwilio',function(req, res){

  var twilio_content = "";
  if (req.body.hasOwnProperty("SpeechResult")){
    twilio_content = req.body.SpeechResult;
  }
  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    input:'speech'
  });

  //var twilio_content = "I need to speak with agent";
  var url, rslt;
  var type = "Device";
  var callfaq = true;

  if (twilio_content == ""){
    rslt = "Hi! I am Claire. I can help with any questions you have on your Nationwide policy, coverage, billing or claim";
    gather.say({voice:'alice', language: "en-US"},rslt);
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
  }else{
	
    var text=twilio_content;
    //console.log("Text Body: " +req.body.text);
    var app = apiai("e62b488f729b4420ad2a3387808b95a8");

    var request = app.textRequest(text, {
      sessionId: '786a322af4144c29ad90351cd091c92f11'
    });

    request.on('response', function(response) {
      console.log(response);
      //res.send(response);
      var intent = response.result.metadata.intentName;
      console.log("APIAI Result: " +JSON.stringify(response,0,2));
      console.log("APIAI Intent: " +response.result.metadata.intentName);
      console.log("APIAI Output Text: " +response.result.fulfillment.speech);
      var rslt = response.result.fulfillment.speech;
      gather.say({voice:'alice', language: "en-US"},rslt);
      res.writeHead(200, {'Content-Type': 'text/xml'});
      res.end(twiml.toString());	    
    });

    request.on('error', function(error) {
      console.log(error);
      res.send(error);
    });

    request.end();
  }
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

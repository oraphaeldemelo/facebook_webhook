'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const FACEBOOK_GRAPH_API_BASE_URL = 'https://graph.facebook.com/v2.6/';

const request = require('request');
const express = require('express');
const body_parser = require('body-parser');

const app = express().use(body_parser.json());

app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

app.post('/webhook',(req, res) => {

	//Return a '200 OK' response to all events
	res.status(200).send('EVENT_RECEIVED');

	const body = req.body;

	if(body.object === 'page'){
		//iterate over eac entry
		//There may be multiple if batched
		if(body.entry && body.entry.length <= 0){

			return;
		}

		body.entry.forEach((pageEntry) => {
			//Iterate over each messaging event and handle accordingly
			pageEntry.messaging.forEach((messagingEvent) => {
				console.log({messagingEvent})
				if(messagingEvent.postback){
					handlePostback(messagingEvent.sender.id, messagingEvent.postback);
				} else if(messagingEvent.message){
					if(messagingEvent.message.quick_reply){
						handlePostback(messagingEvent.sender.id, messagingEvent.message.quick_reply);
					} else {
						handleMessage(messagingEvent.sender.id, messagingEvent.message);
					}
				} else {
					console.log('Webhook received unknown messagingEvent: ', messagingEvent);
				}
			});
		});
	}
});


// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {

	//UPDATE YOUR VERIFY TOKEN 
	const VERIFY_TOKEN = process.env.VERIFICATION_TOKEN;

	//Parse params from the webhook verification request
	let mode = req.query['hub.mode'];
	let token = req.query['hub.verify_token'];
	let challenge = req.query['hub.challenge'];

	//Check if a token and mode were sent
	if(mode && token) {
		//check the mode and token sent are correct
		if(mode === 'subscribe' && token === VERIFY_TOKEN){
			
			//respond with 200 OK and challenge token from the request
			console.log('WEBHOOK_VERIFIED');
			res.status(200).send(challenge);

		} else {
			//Responds with '403 Forbidden' if verify tokens do not match
			res.sendStatus(403);
		}
	}
});

function handleMessage(sender_psid, received_message) {
	let response;

	//Checks if the message contains text
	if(received_message.text){
		//Create the payload for a basic text message, wich
		//will be added to the body od our request to te Send API

		response = {
			"text": `You sent the message: "${received_message.text}". Now send me an attachment`
		}
	} else if(received_message.attachments) {
		//Get the URL of the message attachment
		let attachment_url = received_message.attachments[0].payload.url;
		response = {
			"attachment": {
				"type": "template",
				"payload": {
					"template_type":"generic",
					"elements": [{
						"title": "is this the right picture?",
						"subtitle": "Tap a button to awnser",
						"image_url": attachment_url,
						"buttons": [
							{
								"type": "postback",
								"title": "Yes",
								"payload": "yes",
							},
							{
								"type": "postback",
								"title": "NO",
								"payload": "no",
							}
						],
					}]
				}
			}
		}
	}

	//Send the response message
	callSendAPI(sender_psid, response);

}

function handlePostback(sender_psid, received_postback){
	console.log('ok');
	let response;
	//Get the payload for the postback
	let payload = received_postback.payload;

	//Set the response based on the postback payload
	if(payload === 'yes'){
		response = {"text": "Thanks!"}
	} else if(payload === 'no'){
		response = {"text": "Oops, try sending another image."}
	}
	
	//Send the message to acknowledge the postback
	callSendAPI(sender_psid, response);
}

function callSendAPI(sender_psid, response){
	//construct the message body
	console.log('message to be sent: ', response);
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"message":response
	}

	//Send the HTTP request to the Messenger Platform
	request({
		"url": `${FACEBOOK_GRAPH_API_BASE_URL}me/messages`,
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
		}, (err, res, body) => {
			console.log("Message Sent Response body:", body);
			if(err) {
				console.error("unable to send message:", err);
			}
		});
}


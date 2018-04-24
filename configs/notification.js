var apn = require('apn');
var path = require('path');
var fs = require('fs');

var options = {
    key:  fs.readFileSync(path.resolve(__dirname+'/pushcert.pem')),
    cert: fs.readFileSync(path.resolve(__dirname+'/pushcert.pem')),
    production: false
};

var apnProvider = new apn.Provider(options);

// let deviceToken = "6DFFDE69BB84A9270FC78F6B09E16E3AFD4F9CD322D2ED920A270968A79C0C31";
//
// var note = new apn.Notification();
//
// note.expiry = Math.floor(Date.now() / 1000) + 7200; // Expires 1 hour from now.
// note.badge = 3;
// note.sound = "ping.aiff";
// note.alert = "\uD83D\uDCE7 \u2709 You have a new message from nodejs developer";
// note.payload = {'messageFrom': 'Abhinav Rajpurohit'};
//

exports.pushNotification = function(notificationDetails, callback) {

    // console.log(notificationDetails, "notificationDetails")
    var glyphUrl = notificationDetails.glyphThumbnail || '';
    var fromUserImageUrl = notificationDetails.fromUserImageUrl || '';
    var glyphType = notificationDetails.glyphType || '';
    let deviceToken = notificationDetails.device_token;

    var note = new apn.Notification();

    note.expiry = Math.floor(Date.now() / 1000) + 7200; // Expires 1 hour from now.
    note.badge = notificationDetails.badge;
    note.sound = "ping.aiff";
    note.alert = notificationDetails.message;
    // note.alert = "\uD83D\uDCE7 \u2709 "+notificationDetails.message;
    note.mutableContent = 1;
    note.payload = {'messageFrom': notificationDetails.name, "data": {
        "attachment-url": fromUserImageUrl
    }, 'type': notificationDetails.type,"mediaType": glyphType,"mediaUrl" : glyphUrl};

    // console.log(note, "note")

    apnProvider.send(note, deviceToken).then( (result) => {
        // console.log(result, "result");
        if(result) {
            callback(null, result);
        }
    });

}

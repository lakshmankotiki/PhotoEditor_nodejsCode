/**************************
 MODULE INITIALISATION
 **************************/
 var exp = require('express');
 var common = require('./configs/env/configs');
 var express = require('./configs/express');
 var mongoose = require('./configs/mongoose');
 var db = mongoose();
 var app = express();
 var config = common.config();

 app.use(bodyParser.urlencoded({
     extended: true
 }));

 app.use(exp.static(__dirname + '/uploads'));
 app.use('/static', exp.static(__dirname + '/public'));

 app.use(bodyParser.json());

/**************************
 LISTENING PORT
 **************************/
 app.listen(config.serverPort);
 console.log('Server running at http://localhost:' + config.serverPort + '/');

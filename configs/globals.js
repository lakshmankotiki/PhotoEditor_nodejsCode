/****************************
 MODULE INITIALISATION
 ****************************/
 var common = require('./env/configs');
 var config = common.config();
 var mongoose = require('mongoose');
 var Authentication = require('../app/models/users.server.model').Authentication;


/*************
Purpose: Grenerate Token using JWT
Parameter: {
	logindetails: It accept username and password of user
}
Return: String
****************/
exports.getToken = function(logindetails, callback) {

    // Generate Token
    var token = jwt.sign({
        id: logindetails.id,
        algorithm: "HS256",
        exp: Math.floor(new Date().getTime() / 1000) + config.tokenExpiry
    }, config.securityToken);

    var params = { userId: logindetails.id, token: token};

    // API call to find user and update the token in db
    Authentication.findOneAndUpdate({ userId: logindetails.id }, params, { upsert: true }, function (err, raw) {
        if (err) throw err;
        callback(null, token);
    });

}


/*************
Purpose: It check token expiration
Parameter: {
	token: Token generated for a user.
}
Return: Boolean
****************/
function checkExpiration(token) {

    // Check Expiration
    var decoded = jwt.decode(token);
    let now = parseInt(new Date().getTime() / 1000);
    let expTime = decoded.exp

    if (now > expTime) {
        return false;
    } else {
        return true;
    }
}


/*************
 Purpose: It check token expiration
 Parameter: {
	token: Token generated for a user.
}
 Return: Boolean
 ****************/
 function checkTokenInDB(token, callback) {

    // Initialisation of variables
    var decoded = jwt.decode(token);
    let userId = decoded.id

    // API call to find token user specific in db
    Authentication.findOne({userId:userId, token: token}, function(err, authenticate) {
        if (err) throw err;
        if (authenticate) {
            callback(null, true);
        } else {
            callback(null, false);
        }

    });

}


/*************
 Purpose: It is created to check the useris suthorised or not
 Parameter: {
	token: Token generated for a user.
}
 Return: Number/Object
 ******************/
 exports.isAuthorised = function(req, res, next) {

    // Initialisation of variables
    var tokenReq = req.headers.authorization || req.body.token || req.query.token || req.headers['x-access-token'];
    var decoded = jwt.decode(tokenReq);
    console.log("decoded",decoded)
    let userId = decoded.id
    


    // Validating token
    if(tokenReq) {

        checkTokenInDB(tokenReq, function(err, status) {
            if(status) {
                if (!checkExpiration(tokenReq)) {

                    // Generate Token and set on headers
                    module.exports.getToken({id: userId}, function(err, token) {
                        req.headers.authorization = token;
                        next();
                    });
                } else {
                    // Valid Token
                    next();
                }
            } else {
                res.status(401).json({status: 2, message: 'No token provided.', data: [] });
            }
        })

    } else {
        res.status(401).json({status: 2, message: 'No token provided.', data: [] });
    }

}
/**********************
 MODULE INITIALISTAION
 **********************/
 var globals = require('../../configs/globals');
 var Authentication = require('../models/users.server.model').Authentication;
 var ObjectId = require('mongodb').ObjectID;
 // const nodemailer = require('nodemailer');
 // var ses = require('nodemailer-ses-transport');
 var mongoose = require('mongoose'),
 bcrypt = require('bcrypt'),
 User = mongoose.model('users');
 var path = require('path');
 var crypto = require('crypto')
 var s3 = require('../../configs/aws').s3;
 var request = require('request');
 var fs = require('fs');
 var path = require('path');
 var im = require('imagemagick');

/**************************
 S3 UPLOAD
 **************************/
 exports.bucketUpload = function (requestObj, callback) {

    // console.log(requestObj, "amazon requestObj")

    fs.readFile(requestObj.newFilename, function (err, data) {
        if (err) { console.log(err, "read file error"); callback(null, false); }

        const params = {
            Bucket: 'glyphoto',
            Key: requestObj.fileNewName,
            ACL: "public-read",
            ContentType: requestObj.fileType,
            Body: data
        };

        s3.putObject(params, function(err, data) {
            // console.log("amazon error", err)

            if (err) {

                callback(null, false)

            } else {

                var thumbnailUrl = 'https://glyphoto.s3-us-west-1.amazonaws.com/'+ requestObj.fileNewName;
                // console.log("Successfully uploaded data to myBucket/myKey", thumbnailUrl);

                fs.unlink(requestObj.newFilename, function (err) {
                    if (err) {
                        callback(null, false)
                    }

                    // console.log(data, "dataaaa")

                    var thumbnailResponseObject = {
                        "thumbnailUrl": thumbnailUrl,
                        "etag": data.ETag
                    }
                    // console.log("removed")
                    callback(null, thumbnailResponseObject)
                });

            }

        });

    });

}

/**************************
 FETCH Glyph API METHOD
 **************************/
 exports.generateThumbnail = function (request, callback) {
    var fileNewName = '';
    var newFilename = '';

    console.log(request, "request")

    // Calling model to insert data
    if(request.files.originalname && request.files.location) {
        var nameImage = request.files.originalname.split(".");
        console.log(nameImage[0], "nameImage", nameImage[1])

        if(nameImage[0]) {
                // console.log("Processing")
                var appDir = path.dirname(require.main.filename);
                fileNewName = 'imageThumbnail' + Date.now().toString() + '.' + nameImage[1];
                newFilename = appDir + '/uploads/'+ fileNewName;

                var requestObject = {
                    "fileNewName": fileNewName,
                    "newFilename": newFilename,
                    "fileType": nameImage[1]
                }

                var thumbnailObject = {
                    "originalname": 'imageThumbnail.' + nameImage[1]
                }

                // console.log(thumbnailObject, "thumbnailObject", nameImage[1])

                im.convert([request.files.location, '-resize', '100x100', newFilename],
                    function(err, stdout, stderr) {
                        if (err) {console.log(err, "error in image download");callback(null, false);}

                        // console.log("s3 request", requestObject)

                        module.exports.bucketUpload(requestObject, function(err, thumbnailResponseObject) {
                            if(thumbnailResponseObject) {

                                thumbnailObject.location = thumbnailResponseObject.thumbnailUrl;
                                // console.log(thumbnailResponseObject, "thumbnailUrl", thumbnailObject)
                                callback(null, thumbnailObject)
                            } else {
                                callback(null, false)
                            }
                        });


                    });

            }
        }

    }


/**************
 SIGNIN MODULE
 **************/
 exports.signin = function(req, res) {

    // Validating and initialising fields
    var queryLoginObject = {};

    if(req.body.email || req.body.fb_id) {
        req.body.email ? (queryLoginObject.email = new RegExp('^'+req.body.email+'$', "i")) : delete queryLoginObject.email;
        // req.body.email ? (queryLoginObject.email = req.body.email) : delete queryLoginObject.email;
        req.body.fb_id ? (queryLoginObject.fb_id = req.body.fb_id) : delete queryLoginObject.fb_id;
    }

    if(Object.keys(queryLoginObject).length === 0) {
        res.status(400).json({status: 0, message: "Please enter credentials", data: [] });
        return false;
    }

    // if(queryLoginObject.email) {
    //     queryLoginObject.userVerified = true;
    // }

    // API call to find user
    User.findOne(queryLoginObject, function(err, user) {
        if (err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}
        if(!user) { res.status(404).json({status: 0, message: "User is not found.", data: [] }); return false; }
        if(!user.userVerified && req.body.email) { res.status(404).json({status: 0, message: "Please verify link sent to your email.", data: [] }); return false; }
        if (user) {

            // Validating password fields

            if(queryLoginObject.email && req.body.password) {
                bcrypt.compare(req.body.password, user.hash_password, function(err, response) {
                    if(!response) {
                        res.status(401).json({status: 0, message: "Authentication failed. Invalid password.",data: [] });
                        return false;
                    }
                    else{
                        // update token id
                        User.findByIdAndUpdate(user._id, {$set: {device_token: req.body.device_token}}, { new: true }, function (err, user) {
                            // Generate token and return in response
                            globals.getToken({ id: user._id }, function(err, token) {
                                user.hash_password = undefined;
                                res.status(200).json({
                                    status: 1,
                                    message: "User is authenticated successfully",
                                    data: {
                                        user: user,
                                        token: token
                                    }
                                });
                                return false;
                            })
                        });

                    }
                });
            }
            else if(!queryLoginObject.fb_id) {
                res.status(400).json({status: 0, message: "Bad Request. Please enter password.", data: [] });
                return false;
            }
            else{
                // update token id
                User.findByIdAndUpdate(user._id, {$set: {device_token: req.body.device_token}}, { new: true }, function (err, user) {
                    // Generate token and return in response
                    globals.getToken({id: user._id}, function (err, token) {
                        user.hash_password = undefined;
                        res.status(200).json({
                            status: 1,
                            message: "User is authenticated successfully",
                            data: {
                                user: user,
                                token: token
                            }
                        });
                        return false;
                    })
                })
            }
        }
    });
};

/**************
 SIGNUP MODULE
 **************/
 exports.signup = function(req, res, next) {

    // Validating and initialising fields
    var queryObject = {};
    var verificationToken;

    if(req.body.email || req.body.fb_id) {
        // req.body.email ? (queryObject.email = req.body.email) : delete queryObject.email;
        req.body.email ? (queryObject.email = new RegExp('^'+req.body.email+'$', "i")) : delete queryObject.email;
        req.body.fb_id ? (queryObject.fb_id = req.body.fb_id) : delete queryObject.fb_id;
    }

    if(Object.keys(queryObject).length === 0) {
        res.status(400).json({status: 0, message: "Please enter credentials",data: []});
        return false;
    }

    // API call to find user
    User.findOne(queryObject, function(err, user) {
        if (err) { res.status(500).json({status: 0, message: err, data: [] });return false; }
        if (user) {
            res.status(200).json({status: 0, message: "User already exists", data:{user:user} });
            return false;
        } else {

            // Initialising fields of user object to save
            var newUser = new User(req.body);

            if(req.body.password) {
                newUser.hash_password = bcrypt.hashSync(req.body.password, 10);
            }

            var push_notifications = [{type: "add", category: "glyph"},{type: "edit", category: "glyph"},
            {type: "share", category: "glyph"},{type: "trend", category: "glyph"},{type: "follow",
            category: "follow"}];

            newUser.set('followeeCount', 0);
            newUser.set('sharedCount', 0);
            newUser.set('trendingCount', 0);
            newUser.set('followerCount', 0);
            newUser.set('glyffCount', 0);
            newUser.set('isPublic', false)
            newUser.set('isContactSync', true)
            const nameCanonical = newUser.get("name").toLowerCase().replace(/ /g, "");
            newUser.set("nameCanonical", nameCanonical)
            console.log("check request",req)
            const imageUrl = req.file.location ? req.file.location : '';
            newUser.set("image", imageUrl)
            newUser.set("push_notifications", push_notifications)

            crypto.randomBytes(48, function(err, buffer) {
                verificationToken = buffer.toString('hex');

                if(!newUser.fb_id) {
                    newUser.set("userVerified", false)
                    newUser.set("verificationToken", verificationToken)
                }

                var requestObject = {
                    "files": req.file
                }


                module.exports.generateThumbnail(requestObject, function(err, thumbnailObject) {

                    if(thumbnailObject) {
                        newUser.set("imageThumbnail", thumbnailObject.location)
                    }


                    // API call to save user
                    newUser.save(function(err, user) {
                        if (err) { res.status(500).json({status: 0, message: err,data: []}); return false;}
                        if(!user) { res.status(400).json({status: 0, message: "Bad Request User is not saved",data: [] }); return false;}

                        // var appDir = path.dirname(require.main.filename);
                        var confirmlink = 'http://ec2-52-53-136-248.us-west-1.compute.amazonaws.com:3000/static/confirmation.html?id='+verificationToken;
                        // var confirmlink = 'http://10.2.2.52:3000/static/confirmation.html?id='+verificationToken;

                        var mail = require('nodemailer').mail;

                        mail({
                            from: '"Meme Mogul" <support@mememogul.com>', // sender address
                            to: req.body.email, // list of receivers
                            subject: "Meme Mogul Sign Up Confirmation", // Subject line
                            text: 'Please click on the link below to verify your account', // plain text body
                            html: "<b>Please click on the link below to verify your account</b><br><br><a href='"+confirmlink+"'>"+ confirmlink +"</a>" // html body
                        });

                        // Generate token and return in response
                        globals.getToken({ id: user._id }, function(err, token) {
                            user.hash_password = undefined;
                            res.status(200).json({
                                status: 1,
                                message: "User saved successfully",
                                data: {
                                    user: user,
                                    token: token
                                }
                            });
                            return false;
                        })

                    });

                });

            });

        }
    });
};

/**************
 SIGNUPFB MODULE
 **************/
 exports.signupfb = function(req, res) {

    // Validating and initialising fields
    var queryFbObject = {};

    if(!req.body.fb_id) {
        res.status(400).json({status: 0, message: "Please enter credentials",data: []});
        return false;
    }

    queryFbObject.fb_id = req.body.fb_id;

    // API call to find user
    User.findOne(queryFbObject, function(err, user) {
        // console.log(err, "errrr")
        if (err) { res.status(500).json({status: 0, message: err, data: [] }); return false; }
        if (user) {
            res.status(200).json({status: 0, message: "User already exists", data:{user:user} });
            return false;
        } else {

            // Initialising fields of user object to save
            var newUser = new User(req.body);
            var push_notifications = [{"type": "add", "category": "glyph"},{"type": "edit", "category": "glyph"},
            {"type": "share", "category": "glyph"},{"type": "trend", "category": "glyph"},{"type": "follow",
            "category": "follow"}];

            newUser.set('followeeCount', 0);
            newUser.set('sharedCount', 0);
            newUser.set('trendingCount', 0);
            newUser.set('followerCount', 0);
            newUser.set('glyffCount', 0);
            newUser.set('isPublic', false)
            newUser.set('isContactSync', true)
            const nameCanonical = newUser.get("name").toLowerCase().replace(/ /g, "");
            newUser.set("nameCanonical", nameCanonical)
            newUser.set("push_notifications", push_notifications)
            newUser.set("userVerified", true)

            // API call to save user
            newUser.save(function(err, user) {
                if (err) { res.status(500).json({status: 0, message: err,data: []}); return false; }
                if(!user) { res.status(400).json({status: 0, message: "Bad Request User is not saved",data: [] }); return false;}

                // Generate token and return in response
                globals.getToken({ id: user._id }, function(err, token) {
                    user.hash_password = undefined;
                    res.status(200).json({
                        status: 1,
                        message: "User saved successfully",
                        data: {
                            user: user,
                            token: token
                        }
                    });
                    return false;
                })

            });

        }
    });
};

/**************
 SIGNOUT MODULE
 **************/
 exports.signout = function(req, res) {

    // Validating and initialising fields
    if(!req.query.user_id) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id."});
        return false;
    }

    var userId = String(req.query.user_id);

    Authentication.remove({ userId: userId }, function(err) {
        if (err) { res.status(500).json({status: 0, message: err }); return false; }
        res.clearCookie("Authorization");

        // API call to find user and update the profile in db
        User.findByIdAndUpdate(userId, {$set: {device_token: ''}}, { new: true }, function (err, user) {

            res.status(200).json({status: 1, message: "User logout successfully"});
            return false;
        });
    });

};

/**************
 CHANGE PASSWORD MODULE
 **************/
 exports.changePassword = function(req, res) {

    // Validating and initialising fields
    if(!req.body.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.", code: 400});
        return false;
    }

    if(!req.body.oldpassword) {
        res.status(400).json({status: 0, message: "Bad Request. Please sent old password.", code: 400});
        return false;
    }

    if(!req.body.newpassword) {
        res.status(400).json({status: 0, message: "Bad Request. Please sent new password.", code: 400});
        return false;
    }

    // API call to find user
    var queryChangePasswordObject = {"_id": ObjectId(req.body.userId), "userVerified": true}
    User.findOne(queryChangePasswordObject, function(err, user) {

        if (err) { res.status(500).json({status: 0, message: err, data: [], code: 500 }); return false;}
        if(!user) { res.status(404).json({status: 0, message: "User is not found.", data: [], code: 404 }); return false; }

        bcrypt.compare(req.body.oldpassword, user.hash_password, function(err, response) {

            if(response) {
                bcrypt.compare(req.body.newpassword, user.hash_password, function(err, responseStatus) {

                    if(responseStatus) {
                        res.status(401).json({status: 0, message: "Authentication failed. New and old passwords are same.",data: [], code: 401 });
                        return false;
                    } else {
                        // update token id
                        var password = bcrypt.hashSync(req.body.newpassword, 10);
                        User.findByIdAndUpdate(req.body.userId, {$set: {hash_password: password, device_token: ''}}, { new: true }, function (err, userObj) {
                            if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [], code: 500 }); return false; }
                            if(!userObj) { res.status(404).json({status: 0, message: "User does not exists", code: 404, data: [] }); return false; }

                            // Authentication.remove({ userId: req.body.userId }, function(err) {
                            //     if (err) { res.status(500).json({status: 0, message: err }); return false; }
                            //     res.clearCookie("Authorization");
                            //     res.status(200).json({status: 1, message: "User has changed password successfully", code: 200, data:{ user: userObj } });
                            //     return false;
                            // });

                            res.status(200).json({status: 1, message: "User has changed password successfully", code: 200, data:{ user: userObj } });
                            return false;
                        });

                    }
                });
            } else {
                res.status(401).json({status: 0, message: "Old password does not match.",data: [], code: 401 });
                return false;
            }
        });
    });
};

/**************
 FORGOT PASSWORD MODULE
 **************/
 exports.forgotPassword = function(req, res) {

    // Validating and initialising fields
    if(!req.body.email) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid Email ID.", code: 400});
        return false;
    }
    
    var verificationToken;

    // API call to find user
    crypto.randomBytes(48, function(err, buffer) {
        verificationToken = buffer.toString('hex');

        var queryForgotPasswordObject = {"email": new RegExp('^'+req.body.email+'$', "i"),"userVerified": true}
        User.findOne(queryForgotPasswordObject, function(err, user) {
            if (err) { res.status(500).json({status: 0, message: err, data: [], code: 500 }); return false;}
            if(!user) { res.status(404).json({status: 0, message: "User is not found.", data: [], code: 404 }); return false; }

            var appDir = path.dirname(require.main.filename);
            // var currentDate = new Date();
            var passwordresetlink = 'http://ec2-52-53-136-248.us-west-1.compute.amazonaws.com:3000/static/password-reset.html?token='+verificationToken+'&id='+user._id;
            // var passwordresetlink = 'http://10.2.2.52:3000/static/password-reset.html';

            var mail = require('nodemailer').mail;

            mail({
                from: '"Meme Mogul" <support@mememogul.com>', // sender address
                to: req.body.email, // list of receivers
                subject: "Reset Password Link", // Subject line
                text: 'Please click on link to set your password', // plain text body
                html: "<b>Please click on below link to reset your password</b><br><br><a href='"+passwordresetlink+"'>"+ passwordresetlink +"</a>" // html body
                // text: 'Your new password is '+ randomstring, // plain text body
            });

            var queryUserObject = {"_id": ObjectId(user._id), "email": new RegExp('^'+req.body.email+'$', "i"),"userVerified": true};
            User.update(queryUserObject, {$set: {resetPasswordToken: verificationToken, updatedAt: new Date()}}, {"multi": true}, function(err, user) {
                if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

                res.status(200).json({status: 1, message: "Password has been sent to the registered email-id.", code: 200 });
                return false;
            });

            // res.status(200).json({status: 1, message: "Password has been sent to the registered email-id.", code: 200 });
            // return false;

        });

    });

};


/**************
 RESET PASSWORD MODULE
 **************/
 exports.resetPassword = function(req, res) {
    // console.log(req.body, "req.body")
    // Validating and initialising fields
    if(!req.body.token) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid Email ID.", code: 400});
        return false;
    }

    if(!req.body.password) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid Password.", code: 400});
        return false;
    }

    if(!req.body.id) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid ID.", code: 400});
        return false;
    }

    // console.log(req.body, "req.body")

    // API call to find user
    var password = bcrypt.hashSync(req.body.password, 10);
    var queryResetPasswordObject = {"_id": ObjectId(req.body.id), "userVerified": true};
    User.findOne(queryResetPasswordObject, function (err, userObj) {
        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: []}); return false; }
        if (!userObj) { res.status(404).json({status: 0, message: "User with this email does not exist", code: 404, data: []}); return false; }
        if (!userObj.resetPasswordToken) { res.status(404).json({status: 0, message: "Link is expired", code: 404, data: []}); return false; }

        var date1 = new Date();
        var date2 = userObj.updatedAt;
        var hours = Math.abs(date1 - date2) / 36e5;

        // console.log(hours, "hours")

        if(hours > 0.11) {
            res.status(404).json({status: 0, message: "Link is expired with actual date", code: 404, data: []}); return false;
        }

        // console.log(userObj, "userObj")
        User.update(queryResetPasswordObject, {$set: {hash_password: password,resetPasswordToken: ''}}, {"multi": true}, function(err, user) {
            if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

            res.status(200).json({status: 1, message: "Password has been set successfully"});
            return false;
        });

    });

};

/**************************
 EMAIL VALIDATION API
 **************************/
 exports.checkEmail = function (req, res) {

    if(!(req.query.email)){
        res.status(404).json({status: 0, message: "Bad Request Please enter email", data: [] });
        return false;
    }

    // API call to fetch user
    var email = new RegExp('^'+req.query.email+'$', "i");

    User.findOne({"email": email,"userVerified": true}, function(err, user) {
        if (err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}
        if(!user) { res.status(404).json({status: 0, message: "Email does not exist.", data: []}); return false; }

        res.status(200).json({status: 1, message: "Email already exist", data: { user: user } });
        return false;
    });

}

/**************************
 USERNAME VALIDATION API
 **************************/
 exports.checkUsername = function (req, res) {

    if(!(req.query.nickname)){
        res.status(404).json({status: 0, message: "Bad Request Please enter nickname", data: [] });
        return false;
    }

    var nickname = new RegExp('^'+req.query.nickname+'$', "i");

    if(req.query.userId) {
        var queryCondition = {"nickname": nickname,"userVerified": true,"_id": { $ne: ObjectId(req.query.userId) }};
    } else {
        var queryCondition = {"nickname": nickname,"userVerified": true};
    }

    // API call to fetch user
    User.findOne(queryCondition, function(err, user) {
        if (err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}
        if(!user) { res.status(404).json({status: 0, message: "Nickname does not exist.", data: [] }); return false; }

        res.status(200).json({status: 1, message: "Nickname already exist", data: { user: user }});
        return false;
    });

}

/**************
 CHECK VERIFICATION TOKEN MODULE
 **************/
 exports.checkVerificationToken = function(req, res) {
    // Validating and initialising fields
    if(!req.body.verificationToken) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid URL.", code: 400});
        return false;
    }

    var token = req.body.verificationToken.toString();
    var queryVerificationTokenObject = {"verificationToken": token};
    User.findOneAndUpdate(queryVerificationTokenObject, {$set: {userVerified: true, verificationToken: ''}}, { new: true }, function (err, userObj) {
        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: []}); return false; }
        if (!userObj) { res.status(404).json({status: 0, message: "Link is expired", code: 404, data: []}); return false; }

        res.status(200).json({status: 1, message: "Account is confirmed successfully"});
        return false;

    });

};
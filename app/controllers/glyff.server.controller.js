/**************************
 MODULE INITIALISATION
 **************************/
 var mongoose = require('mongoose');
 var Glyff = require('../models/glyff.server.model').Glyff;
 var ObjectId = require('mongodb').ObjectID;
 var GlyphModel = require('../models/glyff.server.model');
 // var Meme    = require('../models/glyff.server.model').Meme;
 var Follow = require('../models/users.server.model').follow;
 var User = require('../models/users.server.model').user;
 var FFmpeg = require('fluent-ffmpeg');
 var s3 = require('../../configs/aws').s3;
 var request = require('request');
 var fs = require('fs');
 var path = require('path');
 var im = require('imagemagick');
 var moment = require('moment');
 var async = require('async');
 
/**************************
 S3 UPLOAD
 **************************/
 function addDays (date, daysToAdd) {
  var _24HoursInMilliseconds = 86400000;
  return new Date(date.getTime() + daysToAdd * _24HoursInMilliseconds);
};
function unixTime(unixtime) {

    var u = new Date(unixtime*1000);

    return u.getUTCFullYear() +
    '-' + ('0' + u.getUTCMonth()).slice(-2) +
    '-' + ('0' + u.getUTCDate()).slice(-2) + 
    ' ' + ('0' + u.getUTCHours()).slice(-2) +
    ':' + ('0' + u.getUTCMinutes()).slice(-2) +
    ':' + ('0' + u.getUTCSeconds()).slice(-2) +
    '.' + (u.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5) 
};
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
    var gifNewName = '';
    var gifFilename = '';
    // console.log(request, "request")

    // Calling model to insert data
    request.files.filter(function(ele) {
        console.log("ele.originalname",ele.originalname,ele.location)
        if(ele.originalname && ele.location) {
            var nameImage = ele.originalname.split(".");
            console.log(nameImage[0], "nameImage", request.caption)

            if(nameImage[0] == request.caption) {
                // console.log("Processing")
                var appDir = path.dirname(require.main.filename);
                fileNewName = 'glyffThumbnail' + Date.now().toString() + '.' + nameImage[1];
                newFilename = appDir + '/uploads/'+ fileNewName;
                var requestObject = {
                    "fileNewName": fileNewName,
                    "newFilename": newFilename,
                    "fileType": nameImage[1]
                }
                var thumbnailObject = {
                    "originalname": 'glyffThumbnail.' + nameImage[1]
                }
                var gifObject = {
                    "originalname": 'glyffGif.' + "gif"
                }
                console.log("thumbnailObject",thumbnailObject)
                
                // console.log(thumbnailObject, "thumbnailObject", nameImage[1])

                if(nameImage[1] == 'jpeg' || nameImage[1] == 'JPEG' || nameImage[1] == 'jpg' || nameImage[1] == 'png' || nameImage[1] == 'gif' || nameImage[1] == 'JPG' || nameImage[1] == 'PNG' || nameImage[1] == 'GIF') {
                    // console.log("photosssssssssssssssssss")
                    console.log("5")
                    console.log("ele.location",ele.location)
                    console.log("newFilename",newFilename)
                    im.convert([ele.location, '-resize', '100x100', newFilename],
                        function(err, stdout, stderr) {

                            if (err) {console.log(err, "error in image download");callback(null, false);}

                            // console.log("s3 request", requestObject)

                            module.exports.bucketUpload(requestObject, function(err, thumbnailResponseObject) {
                                console.log("inside bucket",thumbnailResponseObject)
                                if(thumbnailResponseObject) {

                                    thumbnailObject.location = thumbnailResponseObject.thumbnailUrl;
                                    thumbnailObject.key = fileNewName;
                                    thumbnailObject.etag = thumbnailResponseObject.etag;
                                    // console.log(thumbnailResponseObject, "thumbnailUrl", thumbnailObject)

                                    callback(null, thumbnailObject)
                                } else {
                                    callback(null, false)
                                }
                            });


                        });

                } else {
                    var gifDir = path.dirname(require.main.filename);
                    gifNewName = 'gifThumbnail' + Date.now().toString() + '.gif';
                    gifFilename = gifDir + '/uploads/'+ gifNewName;
                    var gifrequestObject = {
                        "fileNewName": gifNewName,
                        "newFilename": gifFilename,
                        "fileType": "gif"
                    }
                    async.series([
                        function(newcallback) {
                            console.log("1",ele);
                            // var finalGifObtain = generateGif(ele.location,gifFilename,gifrequestObject,gifNewName);
                            async.series([
                                function(newcallback2) {
                                    FFmpeg(ele.location)
                                    .setStartTime('00:00:00')
                                    .setDuration('4')
                                    .withSize('100x100')
                                    .output(gifFilename)
                                    .on('end', function(err) {
                                        if(!err) {

                                // console.log("s3 request", requestObject)

                                module.exports.bucketUpload(gifrequestObject, function(err, thumbnailResponseObject) {
                                    console.log("thumbnailResponseObject:",thumbnailResponseObject)
                                    if(thumbnailResponseObject) {
                                        gifObject.location = thumbnailResponseObject.thumbnailUrl;
                                        gifObject.key = gifNewName;
                                        gifObject.etag = thumbnailResponseObject.etag;
                                        newcallback2(null, gifObject);
                                        

                                    }
                                });

                            }
                        })
                                    .on('error', function(err){
                            // console.log(err, "error in ffmpeg")
                            newcallback2(null, false);

                        }).run();
                                    

                                }
                                ],function(err,finalGifObtain){
                                    newcallback(null, finalGifObtain);
                                })
                            // newcallback(null, finalGifObtain);

                        },
                        function(newcallback) {
                            FFmpeg(ele.location)
                            .setStartTime('00:00:00')
                            .setDuration('3')
                            .withSize('100x100')
                            .output(newFilename)
                            .on('end', function(err) {
                                if(!err) {
                                    module.exports.bucketUpload(requestObject, function(err, thumbnailResponseObject) {
                                        if(thumbnailResponseObject) {
                                            thumbnailObject.location = thumbnailResponseObject.thumbnailUrl;
                                            thumbnailObject.key = fileNewName;
                                            thumbnailObject.etag = thumbnailResponseObject.etag;
                                        // console.log(thumbnailUrl, "thumbnailUrl", thumbnailObject)
                                        newcallback(null, thumbnailObject)
                                    } else {
                                        newcallback(null, false)
                                    }
                                });

                                }
                            })
                            .on('error', function(err){
                            // console.log(err, "error in ffmpeg")
                            callback(null, false);

                        }).run();

                        },
                        ],function(error,result){
                            callback(null,result)
                            // console.log("final result from both function",result[0])
                            // console.log("final result from both function",result[1])
                        })


                }

            }

        }
    })

}

var cron = require('node-cron');

cron.schedule('00 00 17 * * *', function(){
    sendTrendingNotification();    
});
function generateGif(location,gifFilename,gifrequestObject,gifNewName){

}

function sendTrendingNotification(){
    //console.log("expired call....");
    GlyphModel.getTopTrendingGlyph(function(err,glyph){
        if (err) { console.log("Error while fetching most Trending Glyph",err); return false;}
        if (glyph.status == 0 ) { console.log(glyph.message); return false;}
        // console.log("glyph",glyph);
        var glyphData = glyph.data[0];
        var userData = glyph.data[0].user;
        const pushMessage = " has created today's top trending meme";
        const type = "trend";
        const fromUserID = glyphData.creatorID;
        var requestNotificationObject = {
            "fromUserID": fromUserID,
            "fromMessage": pushMessage,
            "type": type,
            "fromUserImageUrl": userData.image,
            "glyphImageUrl": glyphData.glyffThumbnail,
            "isPublic": true,
            "fromName": userData.name,
            "glyphType": glyphData.type
        }
        GlyphModel.notificationModel(requestNotificationObject, function (err, notification) {
            if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

            User.find({'userVerified':true},function(e,userInfo){
                userInfo.map(function(v,k){
                    var checkStatusPushnotification = v.push_notifications.filter(function(push_notification) {
                        return ( push_notification.type === "trend" && push_notification.category === "glyph")
                    });

                    if(checkStatusPushnotification.length) {
                        User.findByIdAndUpdate({"_id": ObjectId(v._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData) {
                            var requestPushNotificationObj = {};
                            requestPushNotificationObj.name = userData.name;
                            requestPushNotificationObj.device_token = badgeData.device_token;
                            requestPushNotificationObj.message = userData.name + pushMessage;
                            if(badgeData._id.toString() == fromUserID.toString()) { requestPushNotificationObj.message = 'Your meme has been Top Trending meme for yesterday'; }
                            requestPushNotificationObj.type = type;
                            requestPushNotificationObj.badge = badgeData.badge + 1;
                            requestPushNotificationObj.imageUrl = glyphData.glyffThumbnail;
                            // requestPushNotificationObj.imageUrl = glyphData.glyffCustomised;
                            requestPushNotificationObj.glyphType = glyphData.type;
                            requestPushNotificationObj.fromUserImageUrl = userData.image; 

                            GlyphModel.pushNotificationModel(requestPushNotificationObj, function (err, pushNotification) {
                            });
                        });
                    }
                })
            })
        })
    })
}
/**************************
 SAVE GLYFF LIST API
 **************************/
 exports.saveGlyff = function (req, res, next) {

    // Validating the fields
    if(!req.body.creatorID) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }
    console.log("req.files",req.files)
    var caption = req.body.captionText ? "glyffCustomised" : "glyffOriginal";
    var glyffCustomisedName;
    var glyffCustomisedType;
    var glyffCustomisedEtag;
    var glyffCustomisedLocation;
    var requestObject = {
        "files": req.files,
        "caption": caption
    }

    if(caption == 'glyffOriginal') {

        req.files.filter(function(ele) {
            if (ele.originalname && ele.location) {
                var nameImage = ele.originalname.split(".");

                if (nameImage[0] == caption) {
                    glyffCustomisedName = 'glyffCustomised' + Date.now().toString() + '.' + nameImage[1];
                    glyffCustomisedType = nameImage[1];

                    var requestObject = {
                        "fileNewName": glyffCustomisedName,
                        "newFilename": ele.location,
                        "fileType": nameImage[1]
                    }

                    var options = {
                        uri: ele.location,
                        encoding: null
                    };
                    request(options, function(error, response, body) {
                        if (error || response.statusCode !== 200) {
                            console.log("failed to get image");
                            console.log(error);
                        } else {

                            const params = {
                                Bucket: 'glyphoto',
                                Key: requestObject.fileNewName,
                                ACL: "public-read",
                                ContentType: requestObject.fileType,
                                Body: body
                            };

                            s3.putObject(params, function(error, data) {
                                if (error) {
                                    console.log("error downloading image to s3");
                                } else {
                                    console.log("success uploading to s3");
                                    glyffCustomisedLocation = 'https://glyphoto.s3-us-west-1.amazonaws.com/'+ requestObject.fileNewName;
                                    glyffCustomisedEtag = data.etag;
                                }
                            });
                        }
                    });

                }
            }
        });

    }
    
    
    module.exports.generateThumbnail(requestObject, function(err, thumbnailObject) {
        console.log("thumbnailObject-3333",typeof thumbnailObject)
        
        var glyphObject = {};
        var length = req.files.length;
        glyphObject = req.body;
        glyphObject.files = req.files;
        var fileObject = Object.assign({}, glyphObject.files[length - 1]);
        var gifObject = Object.assign({}, glyphObject.files[length - 1]);
        if(caption == 'glyffOriginal') {
            var otherFileObject = Object.assign({}, glyphObject.files[length - 1]);
            otherFileObject.location = 'https://glyphoto.s3-us-west-1.amazonaws.com/'+ glyffCustomisedName;
            otherFileObject.originalname = 'glyffCustomised.' + glyffCustomisedType;
            otherFileObject.key = glyffCustomisedName;
            otherFileObject.etag = (glyffCustomisedEtag) ? glyffCustomisedEtag : '';
            glyphObject.files.push(otherFileObject);
        }
        console.log("otherFileObject:",otherFileObject)
        console.log("thumbnailObject-123",thumbnailObject.length)

        if(thumbnailObject.length){
            if(thumbnailObject[1].location){
                fileObject.location = thumbnailObject[1].location;
            }
            if(thumbnailObject[1].originalname){
                fileObject.originalname = thumbnailObject[1].originalname;    
            }
            if(thumbnailObject[1].key){
                fileObject.key = thumbnailObject[1].key;
            }
            if(thumbnailObject[1].etag){
                fileObject.etag = thumbnailObject[1].etag;
            }
            
            glyphObject.files.push(fileObject);
            if(thumbnailObject[0][0].location){
                gifObject.location =thumbnailObject[0][0].location;
            }
            if(thumbnailObject[0][0].originalname){
                gifObject.originalname = thumbnailObject[0][0].originalname;
            }
            if(thumbnailObject[0][0].key){
                gifObject.key = thumbnailObject[0][0].key;    
            }
            if(thumbnailObject[0][0].etag){
                gifObject.etag = thumbnailObject[0][0].etag;    
            }
            
            glyphObject.files.push(gifObject);    
        }
        else{
            fileObject.location = thumbnailObject.location;
            fileObject.originalname = thumbnailObject.originalname;  
            fileObject.key = thumbnailObject.key;  
            fileObject.etag = thumbnailObject.etag;
            glyphObject.files.push(fileObject);
        }
        
        console.log("glyphObject:",glyphObject)
        // Calling model to insert data
        GlyphModel.saveGlyphModel(glyphObject, function (err, glyph) {
            // console.log(err, "err", glyph)
            if (err) { res.status(500).json({status: 0, message: err, data: []}); return false;}
            if(glyph.status == 0){
                res.status(500).json({status: 0, message: glyph.message, data: [], code: 500 });return false;
            }

            // API call to fetch specific people details
            var queryUserObject = {"_id": ObjectId(req.body.creatorID)}
            User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
                if(!user) { res.status(404).json({status: 0, message: 'User not found , please provide correct creator ID of Glyff', data: [], code: 500 });return false; }
                if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                if(user.image) {var image = user.image} else {var image = user.fb_profile_pic_url}

                // Calling model to insert data
            const pushMessage = (glyph.category == 'new') ? user.name + " created a new meme" : user.name + " edited your meme";
            const message = (glyph.category == 'new') ? " created a new meme" : " edited your meme";
            const type = (glyph.category == 'new') ? "newGlyph" : "editGlyph";
            const fromUserID = (glyph.category == 'new') ? user._id : user.parentID;
            var requestNotificationObject = {
                "fromUserID": fromUserID,
                "fromMessage": message,
                "type": type,
                "fromUserImageUrl": image,
                "glyphImageUrl": glyph.glyffThumbnail,
                "isPublic": true,
                "fromName": user.name,
                "glyphType": glyph.type
            }
            GlyphModel.notificationModel(requestNotificationObject, function (err, notification) {
                if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                    // var push_notification = (glyph.category == 'new') ? { "category" : "glyph", "type" : "add" } : { "category" : "glyph", "type" : "edit" };
                    var requestFollowObject = {
                        "followeeId": ObjectId(user._id),
                        "push_notification": (glyph.category == 'new') ? { "category" : "glyph", "type" : "add" } : { "category" : "glyph", "type" : "edit" }
                    }

                    if(glyph.category == 'edit') {

                        GlyphModel.updateGlyphEditCountModel(req.body.glyffId, function (e, g) {
                            User.findByIdAndUpdate({"_id": ObjectId(req.body.parentID)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, parentuser) {
                                if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                                var checkStatusPushnotification = parentuser.push_notifications.filter(function(push_notification) {
                                    return ( push_notification.type === "edit" && push_notification.category === "glyph")
                                });

                                if(!checkStatusPushnotification.length) {
                                    res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph }, code: 201 });
                                    return false;
                                }

                                var requestPushNotificationObj = {};

                                requestPushNotificationObj.name = user.name;
                                requestPushNotificationObj.device_token = parentuser.device_token;
                                requestPushNotificationObj.message = pushMessage;
                                requestPushNotificationObj.type = type;
                                requestPushNotificationObj.badge = parentuser.badge + 1;
                                requestPushNotificationObj.imageUrl = glyph.glyffThumbnail;
                                // requestPushNotificationObj.imageUrl = glyph.glyffCustomised;
                                requestPushNotificationObj.glyphType = glyph.type;

                                GlyphModel.pushNotificationModel(requestPushNotificationObj, function (err, pushNotification) {
                                    res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph }, code: 201 });
                                    return false;
                                });
                            });
                        });

                    } else {

                        GlyphModel.fetchFolloweesModel(requestFollowObject, function (err, followers) {
                            if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }
                            var counter = 0;

                            if(followers.length > 0) {

                                followers.filter( function( item ) {
                                    User.findByIdAndUpdate({"_id": ObjectId(item.user._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData) {
                                        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                                        var checkStatusPushnotification = badgeData.push_notifications.filter(function(push_notification) {
                                            return ( push_notification.type === "add" && push_notification.category === "glyph")
                                        });

                                        if(checkStatusPushnotification.length) {

                                            var requestPushNotificationObj = {};

                                            requestPushNotificationObj.name = requestNotificationObject.fromName;
                                            requestPushNotificationObj.device_token = item.user.device_token;
                                            // requestPushNotificationObj.message = requestNotificationObject.fromMessage;
                                            requestPushNotificationObj.message = pushMessage;
                                            requestPushNotificationObj.type = glyphObject.type;
                                            requestPushNotificationObj.badge = badgeData.badge + 1;
                                            requestPushNotificationObj.imageUrl = glyph.glyffThumbnail;
                                            // requestPushNotificationObj.imageUrl = glyph.glyffCustomised;
                                            requestPushNotificationObj.glyphType = glyph.type;

                                            GlyphModel.pushNotificationModel(requestPushNotificationObj, function (err, pushNotification) {

                                                counter++;

                                                if(followers.length == counter) {
                                                    res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph }, code: 201 });
                                                    return false;
                                                }
                                            });

                                        } else {

                                            counter++;

                                            if(followers.length == counter) {
                                                res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph }, code: 201 });
                                                return false;
                                            }
                                        }

                                    });
                                });

                            } else {
                                res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph }, code: 201 });
                                return false;
                            }
                        });

                    }
                });
});
});

});


}

/**************************
 FETCH USER GLYFF LIST API
 **************************/
 exports.fetchUserGlyff = function (req, res) {

    // Validating user id
    if(!req.params.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data:[]});
        return false;
    }

    var limit = parseInt(req.query.limit);
    var offset = parseInt(req.query.offset);
    var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
    var queryCondition = {"creatorID": ObjectId(req.params.userId),"isDeleted":false}
    var userId = ObjectId(req.params.userId);
    var currentUserId = ObjectId(req.query.currentUserId);

    var requestObject = {
        "queryCondition": queryCondition,
        "pageSortQuery" : pageSortQuery,
        "userId": userId,
        "currentUserId": currentUserId
    }
    
    // Calling model to insert data
    GlyphModel.fetchAllGlyphModel(requestObject, function (err, glyffs) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(!glyffs) { res.status(404).json({status: 0, message: "Memes are not found",data: [] }); return false;}
        if(glyffs.status == 'Unfollow') { res.status(500).json({status: 0, message: glyffs.message ,data: [] }); return false; }

        GlyphModel.countGlyphModel(requestObject, function(err, count) {
            res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs:glyffs,user:glyffs[0].user, count: count, offset: offset }});
            return false;
        });
    });

}

/**************************
 FETCH Glyph API METHOD
 **************************/
 exports.fetchGlyphs = function (requestObj, callback) {
    console.log("2")
    // Calling model to insert data
    GlyphModel.fetchGlyphModel(requestObj, function (err, glyphs) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(!glyphs) { res.status(404).json({status: 0, message: "Memes are not found",data: [] }); return false;}

        GlyphModel.countGlyphModel(requestObj, function(err, count) {
            console.log("4")
            if(err) {
                callback(null, err)
            } else {
                glyphs.count = count;
                callback(null, glyphs)
            }
        });
    });

}

exports.checkFollow = function(item, callback) {

    item.types = item.types || "";

    if((item.user.isPublic || (String(item.creatorID) == String(item.userId))) && item.types == "All") {
        callback(null, item);
    } else  {

        Follow.findOne({followeeId: item.creatorID,followerId: item.userId,isValid: true }, function(err, follow) {
            if(err) {
                callback(null, err)
            } else if(follow) {
                callback(null, item)
            } else {
                callback(null, false)
            }
        });

    }

}

// exports.addIsFollowed = function (glyffs, callback) {
//
//     var cnt = 0;
//     glyffs.map(function(k,v){
//         var creatorId = String(k.user._id);
//         var parentId = String(k.user._id);
//         Follow.find({followerId:ObjectId(glyffs.userId),followeeId:ObjectId(creatorId)},function(err,creatorFollowers) {
//             Follow.find({followerId:ObjectId(glyffs.userId),followeeId:ObjectId(parentId)},function(err,parentFollowers) {
//                 Follow.count({followerId:ObjectId(creatorId),isValid:true},function(err,creatorFollowee_count) {
//                     Follow.count({followerId:ObjectId(parentId),isValid:true},function(err,parentFollowee_count) {
//                         Follow.count({followeeId:ObjectId(creatorId),isValid:true},function(err,creatorFollower_count) {
//                             Follow.count({followeeId:ObjectId(parentId),isValid:true},function(err,parentFollower_count) {
//                                 glyffs[v].user.followerCount = creatorFollower_count;
//                                 glyffs[v].parentUser.followerCount = parentFollower_count;
//                                 glyffs[v].user.followeeCount = creatorFollowee_count;
//                                 glyffs[v].parentUser.followeeCount = parentFollowee_count;
//
//                                 if(creatorFollowers.length > 0  && creatorFollowers[0].isValid == true){
//                                     glyffs[v].user.isFollowed = 2;
//                                 } else {
//                                     if(creatorFollowers.length > 0 && !creatorFollowers[0].isValid) {
//                                         glyffs[v].user.isFollowed = 1;
//                                     }
//                                 }
//
//                                 if(parentFollowers.length > 0  && parentFollowers[0].isValid == true){
//                                     glyffs[v].parentUser.isFollowed = 2;
//                                 } else {
//                                     if(parentFollowers.length > 0 && !parentFollowers[0].isValid) {
//                                         glyffs[v].parentUser.isFollowed = 1;
//                                     }
//                                 }
//
//                                 cnt = cnt + 1;
//                                 if(glyffs.length == cnt) {
//                                     callback(null, glyffs)
//                                 }
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
//
// }

exports.addIsFollowed = function (glyffs, callback) {

    var cnt = 0;
    var glyphLength = glyffs.glyphs.length;
    console.log( "glyffs.glyphs", glyffs.glyphs);
    glyffs.glyphs.map(function(k,v){
        if(k.user){
            var creatorId = String(k.user._id);
            console.log(creatorId, "creatorId");
        }
        if(k.parentUser){
            var parentId = String(k.parentUser._id);
            console.log("parentId", parentId);
        }
        
        Follow.find({followerId:ObjectId(glyffs.loggedinId),followeeId:ObjectId(creatorId)},function(err,creatorFollowers) {
            Follow.find({followerId:ObjectId(glyffs.loggedinId),followeeId:ObjectId(parentId)},function(err,parentFollowers) {

                if(creatorFollowers.length > 0  && creatorFollowers[0].isValid == true){
                    glyffs.glyphs[v].user.isFollowed = 2;
                } else {
                    if(creatorFollowers.length > 0 && !creatorFollowers[0].isValid) {
                        glyffs.glyphs[v].user.isFollowed = 1;
                    }
                }

                if(parentFollowers.length > 0  && parentFollowers[0].isValid == true){
                    glyffs.glyphs[v].parentUser.isFollowed = 2;
                } else {
                    if(parentFollowers.length > 0 && !parentFollowers[0].isValid) {
                        glyffs.glyphs[v].parentUser.isFollowed = 1;
                    }
                }

                cnt = cnt + 1;
                if(glyphLength == cnt) {
                    glyphList = glyffs.glyphs;
                    console.log(glyphList, "glyphList", cnt);
                    callback(null, glyphList)
                }
            });
        });
    });

}

/**************************
 Search Glyph API
 **************************/
 exports.searchCaptionBasedGlyphs = function (req, res) {

    if(!(req.query.user_id && req.query.limit && req.query.offset && req.query.type)){
        res.status(404).json({status: 0, message: "Bad Request Invalid Parameters", data: [] });
        return false;
    }

    var caption = String(req.query.captionText) || '';
    var limit = parseInt(req.query.limit);
    var offset = parseInt(req.query.offset);
    var userId = ObjectId(req.query.user_id);
    var glifId = ObjectId(req.query.glif_id);
    var glyphList = [];
    if(req.query.type == 'Recents') {
        var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
        var queryCondition = (caption.length > 0 && caption != undefined) ? {"captionText": { '$regex' : caption, '$options' : 'i' },"isDeleted": false} : {"isDeleted": false}

        var requestObject = {
            "queryCondition": queryCondition,
            "pageSortQuery" : pageSortQuery,
            "userId": userId,
        }

        GlyphModel.aggregrationViewedRecentGlyphModel(requestObject, function(err,glyphs) {
            if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
            if(!glyphs.length) { res.status(404).json({status: 0, message: "Memes are not found",data: [], code: 404 }); return false;}

            var count = glyphs.length;
            var glyphsList = glyphs.splice(offset, limit)

            var requestParam = {};
            requestParam.glyphs = glyphsList;
            requestParam.loggedinId = userId;

            console.log(requestParam, "requestParam", userId)

            module.exports.addIsFollowed(requestParam, function(err,glyphList) {
                console.log(glyphList, "glyphList")
                if(glyphList) {
                    res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphList, count: count, offset: offset } } );
                    return false;
                } else {
                    res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphsList, count: count, offset: offset } } );
                    return false;
                }
            });

            // res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphsList, count: count, offset: offset } } );
            // return false;

        });
    }

    if(req.query.type == 'Trending') {

        var now = new Date();
        var currentdate = now.setHours(17);
        currentdate = new Date(currentdate).setMinutes(30);
        currentdate = new Date(currentdate).setSeconds(00);
        var final = currentdate;
        var timeZoneOffset = -new Date().getTimezoneOffset()
        var utcStartTime = new Date(final + timeZoneOffset*60*1000)
        var finalDate = utcStartTime.getTime();
        console.log("finalDate:",finalDate)
        var previousDate = moment(utcStartTime).subtract(1,'days');
        var finalpreviousDate = new Date(previousDate).getTime();
        console.log("finalDate:",finalDate)
        console.log("finalpreviousDate:",finalpreviousDate)
        var start = new Date(finalDate - (24 * 60 * 60 * 1000));
        var pageSortQuery = { sort: { viewCount: -1 }, skip: offset, limit: limit };
        if(caption) {
            var searchArray = [];
            pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
            caption = decodeURI(caption);
            // console.log(caption, "Blank")
            searchArray.push({"captionText": { '$regex' : caption, '$options' : 'i' }})
            // console.log(searchArray, "caption")
            var captionSplitString = caption.split(" ");
            captionSplitString.filter(function (ele) {
                // console.log("operation", ele)
                if(ele == '' || ele == ' ') {
                    return false;
                }
                // searchArray.push({"captionText": { '$regex' : ele, '$options' : 'i' }})
                // searchArray.push({"captionText": { '$regex' : '^ '+ele+' $', '$options' : 'i' }})
                // searchArray.push({"captionText": { '$regex' : '^ '+ele, '$options' : 'i' }})
                // searchArray.push({"captionText": { '$regex' : ele+' $', '$options' : 'i' }})
                searchArray.push({"captionText": ele})
                // searchArray.push({"captionText": ele})
            })
            // var requestString =
            // console.log(searchArray, "Loaded")
        }

        // var queryCondition = (caption) ? {$or: searchArray, "updatedAt": { "$gte": start },"isDeleted": false} : {"updatedAt": { "$gte": start },"isDeleted": false}
        // var queryCondition = (caption) ? {$text: { $search: caption }, "updatedAt": { "$gte": start },"isDeleted": false} : {"updatedAt": { "$gte": start },"isDeleted": false}
        
        var queryCondition = (caption) ? {$text: { $search: caption },"isDeleted": false} : { updatedAt: { '$gte':new Date(finalpreviousDate),'$lte':new Date(finalDate) },"isDeleted": false}
        
        // var queryCondition = (caption) ? {  $or:[{    $text: {$search:caption}},{captionText:{ '$regex' : caption, '$options' : 'i' }}],"isDeleted": false} : { updatedAt: { '$gte':new Date(finalpreviousDate),'$lte':new Date(finalDate) },"isDeleted": false}
        console.log("queryCondition:",queryCondition)

        // console.log(queryCondition, "queryCondition")

        var requestObject = {
            "queryCondition": queryCondition,
            "pageSortQuery" : pageSortQuery,
            "userId": userId
        }
        console.log("requestObject",requestObject)
        module.exports.fetchGlyphs(requestObject, function(err,glyphs) {
            // console.log(glyphs, "glyphs", requestObject)
            if(glyphs.length) {

                var requestParam = {};
                requestParam.glyphs = glyphs;
                requestParam.loggedinId = userId;

                // console.log(requestParam, "requestParam", userId)    

                module.exports.addIsFollowed(requestParam, function(err,glyphList) {
                    // console.log(glyphList, "glyphList")
                    if(glyphList) {
                        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphList, count: glyphs.count, offset: offset } } );
                        return false;
                    } else {
                        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphs, count: glyphs.count, offset: offset } } );
                        return false;
                    }
                });

                // res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphs, count: glyphs.count, offset: offset } } );
                // return false;
            } else {
                res.status(500).json({status: 0, message: err, data: {  } } );
                return false;
            }
        });
    }

    if(req.query.type == 'Mine') {
        var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
        var queryCondition = (caption != '""') ? {"captionText": { '$regex' : caption, '$options' : 'i' }, "creatorID": userId,"isDeleted": false} : {"creatorID": userId,"isDeleted": false};

        var requestObject = {
            "queryCondition": queryCondition,
            "pageSortQuery" : pageSortQuery,
            "userId": userId
        }
        console.log("1");
        module.exports.fetchGlyphs(requestObject, function(err,glyphs) {
            console.log("5",glyphs.length,err)
            if(glyphs.length) {

                var requestParam = {};
                requestParam.glyphs = glyphs;
                requestParam.loggedinId = userId;

                // console.log(requestParam, "requestParam", userId)

                module.exports.addIsFollowed(requestParam, function(err,glyphList) {
                    // console.log(glyphList, "glyphList")
                    if(glyphList) {
                        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphList, count: glyphs.count, offset: offset } } );
                        return false;
                    } else {
                        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphs, count: glyphs.count, offset: offset } } );
                        return false;
                    }
                });

                // res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphs, count: glyphs.count, offset: offset } } );
                // return false;
            } else {
                res.status(500).json({status: 0, message: err, data: {  } } );
                return false;
            }
        });
    }

    if(req.query.type == 'All') {
        var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };;
        var queryCondition = (caption != '""') ? {"captionText": { '$regex' : caption, '$options' : 'i' },"isDeleted":false} : {"isDeleted":false};

        var requestObject = {
            "queryCondition": queryCondition,
            "pageSortQuery" : pageSortQuery,
            "userId": userId
        }

        // GlyphModel.aggregrationFetchGlyphModel(requestObject, function (err, glyphs) {
        //     if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        //     if(!glyphs.length) { res.status(404).json({status: 0, message: "Memes are not found",data: [], code: 404 }); return false;}
        //
        //     // GlyphModel.countGlyphModel(requestObject, function(err, count) {
        //     //     console.log(glyphs, "glyphs", offset)
        //         var count = glyphs.length;
        //         var glyphsFinal = [];
        //         var counter = offset;
        //         var innerCounter = 0;
        //         var newOffset;
        //         console.log(counter, "counter", count)
        //
        //         if(offset) {
        //             glyphs = glyphs.splice(0, offset)
        //         }
        //
        //         console.log("offset", offset)
        //
        //         var glyphsFinal = glyphs.filter( function( item ) {
        //
        //             var requestObj = {};
        //             requestObj= item;
        //             requestObj.userId = userId;
        //             requestObj.types = "All";
        //
        //             module.exports.checkFollow(requestObj, function (err, data) {
        //                 counter++;
        //                 if(data) {
        //                     innerCounter++;
        //                     delete data.userId;
        //                     delete data.types;
        //                     // glyphsFinal.push(data);
        //                 }
        //
        //                 console.log(innerCounter, "innerCounter", counter)
        //
        //                 if(innerCounter == limit || counter >= count) {
        //                     var newOffset = counter;
        //                     // if(!glyphsFinal.length) {
        //                     //     res.status(200).json({status: 1, message: "There are no memes", data: { glyffs: glyphsFinal, count: count, offset: newOffset } } );
        //                     //     return false;
        //                     // } else {
        //                     //     res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphsFinal, count: count, offset: newOffset } } );
        //                     //     return false;
        //                     // }
        //                     return false;
        //                 } else {
        //                     return data;
        //                 }
        //             })
        //         });
        //
        //
        //     if(!glyphsFinal.length) {
        //         res.status(200).json({status: 1, message: "There are no memes", data: { glyffs: glyphsFinal, count: count, offset: newOffset } } );
        //         return false;
        //     } else {
        //         res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphsFinal, count: count, offset: newOffset } } );
        //         return false;
        //     }
        //
        //
        //     // });
        // });
        
        GlyphModel.aggregrationFetchPublicGlyphModel(requestObject, function (err, publicGlyphs) {
            console.log(publicGlyphs, "publicGlyphs")
            if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}

            GlyphModel.aggregrationFetchPrivateGlyphModel(requestObject, function (err, privateGlyphs) {
                console.log(privateGlyphs, "privateGlyphs")
                if (err) { res.status(500).json({status: 0, message: err, data: []}); return false; }

                var glyphs = publicGlyphs.concat(privateGlyphs);

                glyphs.sort(function(a, b){
                    var dateA = new Date(a.createdAt), dateB = new Date(b.createdAt)
                    return dateB-dateA //sort by date descending
                })

                var count = glyphs.length;
                var newGlyph = glyphs.splice(offset, limit)

                if(!newGlyph.length) {
                    res.status(200).json({status: 1, message: "There are no memes", data: { glyffs: newGlyph, count: count, offset: offset } } );
                    return false;
                } else {

                    var requestParam = {};
                    requestParam.glyphs = newGlyph;
                    requestParam.loggedinId = userId;

                    console.log(requestParam, "requestParam", userId)

                    module.exports.addIsFollowed(requestParam, function(err,glyphList) {
                        console.log(glyphList, "glyphList")
                        if(glyphList) {
                            res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphList, count: count, offset: offset } } );
                            return false;
                        } else {
                            res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: newGlyph, count: count, offset: offset } } );
                            return false;
                        }
                    });

                    // res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: newGlyph, count: count, offset: offset } } );
                    // return false;
                }

            });
        });
    }

    if(req.query.type == 'Friends') {
        var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
        var queryCondition = (caption != '""') ? {"captionText": { '$regex' : caption, '$options' : 'i' },"isDeleted":false} : {"isDeleted":false};

        var requestObject = {
            "queryCondition": queryCondition,
            "pageSortQuery" : pageSortQuery,
            "userId": userId
        }
        console.log(requestObject, "requestObject")

        // GlyphModel.aggregrationFetchGlyphModel(requestObject, function (err, glyphs) {
        //     if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        //     if(!glyphs.length) { res.status(404).json({status: 0, message: "Memes are not found",data: [], code: 404 }); return false;}
        //
        //     GlyphModel.countGlyphModel(requestObject, function(err, count) {
        //         var glyphsFinal = [];
        //         var counter = 0;
        //
        //         glyphs.filter( function( item ) {
        //             var requestObj = {};
        //             requestObj= item;
        //             requestObj.userId = userId;
        //
        //             module.exports.checkFollow(requestObj, function (err, data) {
        //                 if(data) {
        //                     counter++;
        //                     delete data.userId;
        //                     glyphsFinal.push(data);
        //                 } else {
        //                     counter++;
        //                 }
        //
        //                 if(counter == glyphs.length) {
        //                     res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphsFinal, count: count, offset: offset } } );
        //                     return false;
        //                 }
        //             })
        //         });
        //
        //     });
        // });

        GlyphModel.aggregrationFetchPrivateFriendsGlyphModel(requestObject, function (err, privateGlyphs) {
            // console.log(privateGlyphs,"privateGlyphs");
            if (err) { res.status(500).json({status: 0, message: err, data: []}); return false; }
            if(!privateGlyphs.length) { res.status(404).json({status: 0, message: "Memes are not found",data: [], code: 404 }); return false;}

            // GlyphModel.aggregrationFetchPrivateFriendsGlyphModel(requestObject, function (err, countGlyphs) {


                var requestParam = {};
                requestParam.glyphs = privateGlyphs;
                requestParam.loggedinId = userId;

                console.log(requestParam, "requestParam", userId)

                module.exports.addIsFollowed(requestParam, function(err,glyphList) {
                    console.log(glyphList, "glyphList")
                    if(glyphList) {

                        var countPrivateGlyphs = glyphList.length;
                        var privateGlyphsList = glyphList.splice(offset, limit)

                        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: privateGlyphsList, count: countPrivateGlyphs, offset: offset } } );
                        return false;
                    }
                    // else {
                    //     res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: privateGlyphs, count: countGlyphs.count, offset: offset } } );
                    //     return false;
                    // }
                });


                // res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: privateGlyphs, count: countGlyphs.count, offset: offset } } );
                // return false;

            // });

        });

    }

    if(req.query.type == 'Favourites') {
        var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
        // var queryCondition = (caption != '""') ? {"captionText": caption, "userId": userId ,"isDeleted":false} : {"userId": userId,"isDeleted":false};
        var queryCondition = (caption != '""') ? {"captionText": { '$regex' : caption, '$options' : 'i' }, "userId": userId ,"isDeleted":false} : {"userId": userId,"isDeleted":false};

        var requestObject = {
            "queryCondition": queryCondition,
            "pageSortQuery" : pageSortQuery
        }

        GlyphModel.aggregrationFetchFavouriteGlyphModel(requestObject, function (err, glyphs) {
            if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
            if(!glyphs.length) { res.status(404).json({status: 0, message: "Memes are not found",data: [], code: 404 }); return false;}

            GlyphModel.countFavouriteGlyphModel(requestObject, function(err, count) {


                var requestParam = {};
                requestParam.glyphs = glyphs;
                requestParam.loggedinId = userId;

                console.log(requestParam, "requestParam", userId)

                module.exports.addIsFollowed(requestParam, function(err,glyphList) {
                    console.log(glyphList, "glyphList")
                    if(glyphList) {
                        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphList, favouriteCount: count, offset: offset } } );
                        return false;
                    } else {
                        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphs, favouriteCount: count, offset: offset } } );
                        return false;
                    }
                });

                // res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs: glyphs, count: count, offset: offset } } );
                // return false;
            });
        });
    }

}

/*****************
 EDIT GLYPH API
 *****************/
 exports.editGlyph = function (req, res) {

    var setObject = {};

    // Validating the fields
    if(!req.params.glyphId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.creatorID) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    req.body.type ? (setObject.type = req.body.type) : delete setObject.type;
    req.body.title ? (setObject.title = req.body.title) : delete setObject.title;
    req.body.creatorID ? (setObject.creatorID = req.body.creatorID) : delete setObject.creatorID;
    req.body.captionText ? (setObject.captionText = req.body.captionText) : delete setObject.captionText;
    req.body.isEditable ? (setObject.isEditable = req.body.isEditable) : delete setObject.isEditable;
    req.body.followeeCount ? (setObject.followeeCount = req.body.followeeCount) : delete setObject.followeeCount;
    req.body.sharedCount ? (setObject.sharedCount = req.body.sharedCount) : delete setObject.sharedCount;
    req.body.trendingCount ? (setObject.trendingCount = req.body.trendingCount) : delete setObject.trendingCount;
    req.body.followerCount ? (setObject.followerCount = req.body.followerCount) : delete setObject.followerCount;
    req.body.glyffCount ? (setObject.glyffCount = req.body.glyffCount) : delete setObject.glyffCount;
    req.body.isPublic ? (setObject.isPublic = req.body.isPublic) : delete setObject.isPublic;
    req.body.isTemplate ? (setObject.isTemplate = req.body.isTemplate) : delete setObject.isTemplate;

    if(!req.files.length) {

        var requestObject = {
            "glyphId": req.params.glyphId,
            "setObject" : setObject
        }

        // API call to find user and update the profile in db
        // comment count
        GlyphModel.updateGlyphModel(requestObject, function (err, glyph) {

            if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
            if(!glyph) { res.status(404).json({status: 0, message: "Meme does not exist", code: 404, data: [] }); return false; }

                // API call to fetch specific people details
                var queryUserObject = {"_id": ObjectId(req.body.creatorID)}
                User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
                    if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }
                    if(user.image) {var image = user.image} else {var image = user.fb_profile_pic_url}

                    // Calling model to insert data
                const pushMessage = user.name + " edited his meme";
                const message = " edited his meme";
                const type = "editGlyph";
                const fromUserID = user._id;

                var requestNotificationObject = {
                    "fromUserID": fromUserID,
                    "fromMessage": message,
                    "type": type,
                    "fromUserImageUrl": image,
                    "glyphImageUrl": glyph.glyffThumbnail,
                    "isPublic": true,
                    "fromName": user.name,
                    "glyphType": glyph.type
                }

                GlyphModel.notificationModel(requestNotificationObject, function (err, notification) {
                    if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                    var requestFollowObject = {
                        "followeeId": ObjectId(user._id),
                        "push_notification": { "category" : "glyph", "type" : "edit" }
                    }

                    GlyphModel.fetchFolloweesModel(requestFollowObject, function (err, followers) {
                        if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                        var counter = 0;
                        if(followers.length > 0) {

                            followers.filter( function( item ) {
                                User.findByIdAndUpdate({"_id": ObjectId(item.user._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData) {
                                    if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                                    var checkStatusPushnotification = badgeData.push_notifications.filter(function(push_notification) {
                                        return ( push_notification.type === "edit" && push_notification.category === "glyph")
                                    });

                                    if(!checkStatusPushnotification.length) {
                                        res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph } } );
                                        return false;
                                    }

                                    var requestPushNotificationObj = {};

                                    requestPushNotificationObj.name = requestNotificationObject.fromName;
                                    requestPushNotificationObj.device_token = item.user.device_token;
                                        // requestPushNotificationObj.message = requestNotificationObject.fromMessage;
                                        requestPushNotificationObj.message = pushMessage;
                                        requestPushNotificationObj.type = req.body.type;
                                        requestPushNotificationObj.badge = badgeData.badge + 1;
                                        requestPushNotificationObj.imageUrl = glyph.glyffThumbnail;
                                        // requestPushNotificationObj.imageUrl = glyph.glyffCustomised;
                                        requestPushNotificationObj.glyphType = glyph.type;

                                        GlyphModel.pushNotificationModel(requestPushNotificationObj, function (err, pushNotification) {

                                            counter++;

                                            if(followers.length == counter) {
                                                res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph } } );
                                                return false;
                                            }
                                        });
                                    });
                            });

                        } else {
                            res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph } } );
                            return false;
                        }
                    });
                });
            });
//         GlyphModel.updateGlyphEditCountModel(req.params.glyphId, function (error, data) {

// });
});

} else {

    var caption = req.body.captionText ? "glyffCustomised" : "glyffOriginal";
    var glyffCustomisedName;
    var glyffCustomisedType;
    var glyffCustomisedEtag;
    var glyffCustomisedLocation;
    var requestObject = {
        "files": req.files,
        "caption": caption
    }


    if(caption == 'glyffOriginal') {

        req.body.captionText = '';

        req.files.filter(function(ele) {
            if (ele.originalname && ele.location) {
                var nameImage = ele.originalname.split(".");

                if (nameImage[0] == caption) {
                    glyffCustomisedName = 'glyffCustomised' + Date.now().toString() + '.' + nameImage[1];
                    glyffCustomisedType = nameImage[1];

                    var requestObject = {
                        "fileNewName": glyffCustomisedName,
                        "newFilename": ele.location,
                        "fileType": nameImage[1]
                    }

                    var options = {
                        uri: ele.location,
                        encoding: null
                    };
                    request(options, function(error, response, body) {
                        if (error || response.statusCode !== 200) {
                            console.log("failed to get image");
                            console.log(error);
                        } else {

                            const params = {
                                Bucket: 'glyphoto',
                                Key: requestObject.fileNewName,
                                ACL: "public-read",
                                ContentType: requestObject.fileType,
                                Body: body
                            };

                            s3.putObject(params, function(error, data) {
                                if (error) {
                                    console.log("error downloading image to s3");
                                } else {
                                    console.log("success uploading to s3");
                                    glyffCustomisedLocation = 'https://glyphoto.s3-us-west-1.amazonaws.com/'+ requestObject.fileNewName;
                                    glyffCustomisedEtag = data.etag;
                                }
                            });
                        }
                    });

                }
            }
        });

    }


    module.exports.generateThumbnail(requestObject, function(err, thumbnailObject) {

        var glyphArray = [];
        var length = req.files.length;
        glyphArray = req.files;
        var fileObject = Object.assign({}, glyphArray[length - 1]);
        var gifObject = Object.assign({}, glyphArray[length - 1]);
        if(caption == 'glyffOriginal') {
            var otherFileObject = Object.assign({}, glyphArray[length - 1]);
            otherFileObject.location = 'https://glyphoto.s3-us-west-1.amazonaws.com/'+ glyffCustomisedName;
            otherFileObject.originalname = 'glyffCustomised.' + glyffCustomisedType;
            otherFileObject.key = glyffCustomisedName;
            otherFileObject.etag = (glyffCustomisedEtag) ? glyffCustomisedEtag : '';
            glyphArray.push(otherFileObject);
        }
        if(thumbnailObject.length){
            if(thumbnailObject[1].location){
                fileObject.location = thumbnailObject[1].location;
            }
            if(thumbnailObject[1].originalname){
                fileObject.originalname = thumbnailObject[1].originalname;    
            }
            if(thumbnailObject[1].key){
                fileObject.key = thumbnailObject[1].key;
            }
            if(thumbnailObject[1].etag){
                fileObject.etag = thumbnailObject[1].etag;
            }
            
            glyphArray.push(fileObject);
            if(thumbnailObject[0][0].location){
                gifObject.location =thumbnailObject[0][0].location;
            }
            if(thumbnailObject[0][0].originalname){
                gifObject.originalname = thumbnailObject[0][0].originalname;
            }
            if(thumbnailObject[0][0].key){
                gifObject.key = thumbnailObject[0][0].key;    
            }
            if(thumbnailObject[0][0].etag){
                gifObject.etag = thumbnailObject[0][0].etag;    
            }
            
            glyphArray.push(gifObject);   
        }
        else{
            fileObject.location = thumbnailObject.location;
            fileObject.originalname = thumbnailObject.originalname;  
            fileObject.key = thumbnailObject.key;  
            fileObject.etag = thumbnailObject.etag;
            glyphArray.push(fileObject);
        }
        // fileObject.location = thumbnailObject[1].location;
        // fileObject.originalname = thumbnailObject[1].originalname;
        // fileObject.key = thumbnailObject[1].key;
        // fileObject.etag = thumbnailObject[1].etag;
        // glyphArray.push(fileObject);
        // gifObject.location =thumbnailObject[0][0].location;
        // gifObject.originalname = thumbnailObject[0][0].originalname;
        // gifObject.key = thumbnailObject[0][0].key;
        // gifObject.etag = thumbnailObject[0][0].etag;
        // glyphArray.push(gifObject);
        
        glyphArray.filter(function(ele) {
            if(ele.originalname && ele.location) {
                var nameImage = ele.originalname.split(".");
                setObject[nameImage[0]] = ele.location;
            }
        })

        var requestObject = {
            "glyphId": req.params.glyphId,
            "setObject" : setObject
        }

        requestObject.setObject.glyffCustomised = requestObject.setObject.glyffCustomised ? requestObject.setObject.glyffCustomised : '';

            // API call to find user and update the profile in db
            GlyphModel.updateGlyphEditCountModel(req.params.glyphId, function (error, data) {
                GlyphModel.updateGlyphModel(requestObject, function (err, glyph) {

                    if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
                    if(!glyph) { res.status(404).json({status: 0, message: "Meme does not exist", code: 404, data: [] }); return false; }

                    // API call to fetch specific people details
                    var queryUserObject = {"_id": ObjectId(req.body.creatorID)}
                    User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
                        if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }
                        if(user.image) {var image = user.image} else {var image = user.fb_profile_pic_url}

                        // Calling model to insert data
                    const pushMessage = user.name + " edited his meme";
                    const message = " edited his meme";
                    const type = "editGlyph";
                    const fromUserID = user._id;

                    var requestNotificationObject = {
                        "fromUserID": fromUserID,
                        "fromMessage": message,
                        "type": type,
                        "fromUserImageUrl": image,
                        "glyphImageUrl": glyph.glyffThumbnail,
                        "isPublic": true,
                        "fromName": user.name,
                        "glyphType": glyph.type
                    }

                    GlyphModel.notificationModel(requestNotificationObject, function (err, notification) {
                        if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                        var requestFollowObject = {
                            "followeeId": ObjectId(user._id),
                            "push_notification": { "category" : "glyph", "type" : "edit" }
                        }

                        GlyphModel.fetchFolloweesModel(requestFollowObject, function (err, followers) {
                            if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                            var counter = 0;
                            if(followers.length > 0) {

                                followers.filter( function( item ) {
                                    User.findByIdAndUpdate({"_id": ObjectId(item.user._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData) {
                                        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                                        var checkStatusPushnotification = badgeData.push_notifications.filter(function(push_notification) {
                                            return ( push_notification.type === "edit" && push_notification.category === "glyph")
                                        });

                                        if(!checkStatusPushnotification.length) {
                                            res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph } } );
                                            return false;
                                        }

                                        var requestPushNotificationObj = {};

                                        requestPushNotificationObj.name = requestNotificationObject.fromName;
                                        requestPushNotificationObj.device_token = item.user.device_token;
                                            // requestPushNotificationObj.message = requestNotificationObject.fromMessage;
                                            requestPushNotificationObj.message = pushMessage;
                                            requestPushNotificationObj.type = req.body.type;
                                            requestPushNotificationObj.badge = badgeData.badge + 1;
                                            requestPushNotificationObj.imageUrl = glyph.glyffThumbnail;
                                            // requestPushNotificationObj.imageUrl = glyph.glyffCustomised;
                                            requestPushNotificationObj.glyphType = glyph.type;

                                            GlyphModel.pushNotificationModel(requestPushNotificationObj, function (err, pushNotification) {

                                                counter++;

                                                if(followers.length == counter) {
                                                    res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph } } );
                                                    return false;
                                                }
                                            });
                                        });
                                });

                            } else {
                                res.status(201).json({status: 1, message: "Meme has been saved", data: { glyph: glyph } } );
                                return false;
                            }
                        });
                    });
                });
});
});
});
}

}

/**************************
 SAVE FAVOURITE GLYPH API
 **************************/
 exports.saveGlyffFavourite = function (req, res, next) {

    // Validating the fields
    if(!req.body.userId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.glyphId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    var glyphFavouriteObject = {};
    glyphFavouriteObject = req.body;
    glyphFavouriteObject.isDeleted = false;

    // Calling model to insert data
    GlyphModel.findGlyphFavouriteModel(glyphFavouriteObject, function (err, glyphFavourite) {
        if(glyphFavourite.status == 'Report') {res.status(500).json({status: 0, message: glyphFavourite.message, data: []}); return false;}
        if(glyphFavourite.length > 0) { res.status(200).json({status: 0, message: "Glyph is already favourite for the user"}); return false;}
        if(err) { res.status(500).json({status: 0, message: err, data: []}); return false;}

        glyphFavouriteObject = req.body;
        GlyphModel.saveGlyphFavouriteModel(glyphFavouriteObject, function (err, data) {
            if (err) { res.status(500).json({status: 0, message: err, data: []}); return false;}

            res.status(201).json({status: 1, message: "Meme saved as an favourite successfully", code: 201 });
            return false;
        });
    });

}

/**************************
 REMOVE FAVOURITE GLYPH API
 **************************/
 exports.removeFavouriteGlyff = function (req, res, next) {

    // Validating the fields
    if(!req.body.userId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.glyphId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    var removeGlyphFavouriteObject = {};
    removeGlyphFavouriteObject = req.body;

    // Calling model to insert data
    GlyphModel.removeFavouriteGlyff(removeGlyphFavouriteObject, function (err, removeStatus) {
        if (err) { res.status(500).json({status: 0, message: err }); return false; }

        res.status(200).json({status: 1, message: "Meme removed from favourite successfully", code: 200 });
        return false;
    });

}

/**************************
 FETCH GLYPH API
 **************************/
 exports.fetchGlyffDetail = function (req, res, next) {

    // Validating the fields
    if(!req.params.glyphId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }
    var userId = ObjectId(req.query.user_id);
    var queryCondition = {"_id": ObjectId(req.params.glyphId)}

    var requestObject = {

        "queryCondition": queryCondition,
        "userId": userId,
        "flag":"fetchGlyffDetail"
    }

    var reqObj = {
        "id":userId,
        "glyffId":req.params.glyphId 
    }
    GlyphModel.fetchGlyphModel(requestObject, function (err, glyffs) { 

        if(glyffs[0].creatorID.toString() == req.query.user_id.toString()) {
            res.status(200).json({status: 1, message: "Meme found successfully", code: 200, data: { glyph: glyffs[0]} } );
            return false;
        }
        if(err) { res.status(500).json({status: 0, message: err,data: [], code: 404 }); return false;}
        if(!glyffs.length) { res.status(404).json({status: 0, message: "Meme is not found",data: [], code: 404 }); return false;}

        res.status(200).json({status: 1, message: "Meme found successfully", code: 200, data: { glyph: glyffs[0]} } );
        return false;    
        
        
        
        
        // GlyphModel.fetchGlyphModel(requestObject, function (err, glyffs) {


        // });
        // GlyphModel.updateGlyphViewCountModel(reqObj, function (error, data) {


        // });   
    });
}

/**************************
 SAVE SHARE GLYPH API
 **************************/
 exports.shareGlyff = function (req, res, next) {

    // Validating the fields
    if(!req.body.userId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.glyphId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    var userId = ObjectId(req.body.userId);
    var queryCondition = {"_id": ObjectId(req.body.glyphId),"isDeleted":false}
    var requestObject = {
        "queryCondition": queryCondition,
        "userId": userId
    }

    var shareGlyphObject = {};
    shareGlyphObject = req.body;

    var queryUserObject = {"_id": userId}
    console.log("1  queryUserObject  :",queryUserObject);
    User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
        if (err) { res.status(500).json({status: 0, message: err, data: []}); return false;}
        if (!user) { res.status(400).json({status: 0, message: "User doesn't exist", data: []}); return false;}

        // Calling model to insert data
        GlyphModel.updateGlyphShareCountModel({id:req.body.glyphId,userId:user._id}, function (error, data) {

            GlyphModel.shareGlyphModel(shareGlyphObject, function (err, shareGlyph) {
                if (err) { res.status(500).json({status: 0, message: err, data: []}); return false;}

                GlyphModel.fetchGlyphModel(requestObject, function (err, glyff) {
                    if (!(glyff.length > 0)) { res.status(404).json({status: 0, message: "Meme is not found", data: []}); return false;}

                    if(user.image) {var image = user.image} else {var image = user.fb_profile_pic_url}
                        const pushMessage = user.name + " shared your meme";
                    const message = " shared your meme";
                    const type = "shareGlyph";
                    const fromUserID = user._id;
                    const toUserID = glyff[0].user._id;

                    if(fromUserID.toString() == toUserID.toString()) { 
                        res.status(201).json({status: 1, message: "Meme has been shared successfully", code: 201 });
                        return false; 
                    }

                    var requestNotificationObject = {
                        "fromUserID": fromUserID,
                        "toUserID": toUserID,
                        "fromMessage": message,
                        "type": type,
                        "fromUserImageUrl": image,
                        "glyphImageUrl": glyff[0].glyffThumbnail,
                        "isPublic": true,
                        "fromName": user.name,
                        "glyphType": glyff[0].type
                    }

                    GlyphModel.notificationModel(requestNotificationObject, function (err, notification) {
                        if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                        User.findByIdAndUpdate({"_id": ObjectId(glyff[0].user._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData) {
                            if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                            var checkStatusPushnotification = badgeData.push_notifications.filter(function(push_notification) {
                                return ( push_notification.type === "share" && push_notification.category === "glyph")
                            });

                            if(!checkStatusPushnotification.length) {
                                res.status(201).json({status: 1, message: "Meme has been shared successfully", code: 201 });
                                return false;
                            }

                            var requestPushNotificationObj = {};
                            requestPushNotificationObj.name = requestNotificationObject.fromName;
                            requestPushNotificationObj.device_token = glyff[0].user.device_token;
                            // requestPushNotificationObj.message = requestNotificationObject.fromMessage;
                            requestPushNotificationObj.message = pushMessage;
                            requestPushNotificationObj.type = type;
                            requestPushNotificationObj.badge = badgeData.badge + 1;
                            requestPushNotificationObj.imageUrl = glyff[0].glyffThumbnail;
                            // requestPushNotificationObj.imageUrl = glyff[0].glyffCustomised;
                            requestPushNotificationObj.glyphType = glyff[0].type;

                            GlyphModel.pushNotificationModel(requestPushNotificationObj, function (err, pushNotification) {

                                if(pushNotification) {
                                    res.status(201).json({status: 1, message: "Meme has been shared successfully", code: 201 });
                                    return false;
                                }

                            });
                        });
                    });
                });
            });
        });
});

}

exports.removeGlyff = function (req, res, next) {

    // Validating the fields
    if(!req.body.userId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.glyphId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    var userId = ObjectId(req.body.userId);
    var glyphId = ObjectId(req.body.glyphId);
    var queryCondition = {"_id": glyphId,"creatorID": userId}

    GlyphModel.removeGlyff(queryCondition, function (err, deleteGlyff) {
        res.status(201).json({status: deleteGlyff.status, message: deleteGlyff.message, data: [], code: 201});
    })
}

/**************************
 FETCH USER GLYFF LIST API
 **************************/
 exports.fetchGlyffByUser = function (req, res) {
    console.log("i am here")
    // Validating user id
    if(!req.query.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data:[]});
        return false;
    }

    // var limit = parseInt(req.query.limit);
    // var offset = parseInt(req.query.offset);
    // var pageSortQuery = { sort: { createdAt: -1 }, skip: offset, limit: limit };
    // var queryCondition = {"creatorID": ObjectId(req.query.userId),"isDeleted":false}
    var queryCondition = {"creatorID": ObjectId(req.query.userId)}
    var requestObject = {
        "queryCondition": queryCondition
    }

    // Calling model to insert data
    // GlyphModel.fetchAllGlyphByUserModel(requestObject, function (err, glyphs) {
    //     if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
    //     if(!glyphs) { res.send({status: 1, message: "Memes are not found",data: { glyffs:[], count: 0 } }); return false;}

    //     res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs:glyphs, count: glyphs.length }});
    //     return false;
    // });
    GlyphModel.fetchAllGlifModel(req.query.userId, function (err, glyphs) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(!glyphs) { res.send({status: 1, message: "Memes are not found",data: { glyffs:[], count: 0 } }); return false;}

        res.status(200).json({status: 1, message: "Memes found successfully", data: { glyffs:glyphs, count: glyphs.length }});
        return false;
    });


}

exports.viewGlif = function(req,res){
 if(!req.body.userId) {
    res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
    return false;
}

if(!req.body.glyphId) {
    res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
    return false;
}

var userId = ObjectId(req.body.userId);
var queryCondition = {"_id": ObjectId(req.body.glyphId),"isDeleted":false}
var requestObject = {
    "queryCondition": queryCondition,
    "userId": userId
}

var shareGlyphObject = {};
shareGlyphObject = req.body;

var queryUserObject = {"_id": userId}
console.log("1  queryUserObject  :",queryUserObject);
User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
    if (err) { res.status(500).json({status: 0, message: err, data: []}); return false;}
    if (!user) { res.status(400).json({status: 0, message: "User doesn't exist", data: []}); return false;}
    var reqObj = {
        "id":user._id,
        "glyffId":req.body.glyphId 
    }
        // Calling model to insert data
        GlyphModel.updateGlyphViewCountModel(reqObj, function (error, data) {

            GlyphModel.viewGlyphModel(shareGlyphObject, function (err, shareGlyph) {
                if (err) { res.status(500).json({status: 0, message: err, data: []}); return false;}

                GlyphModel.fetchGlyphModel(requestObject, function (err, glyff) {
                    if (!(glyff.length > 0)) { res.status(404).json({status: 0, message: "Meme is not found", data: []}); return false;}

                    if(user.image) {var image = user.image} else {var image = user.fb_profile_pic_url}
                        const pushMessage = user.name + " viewed your meme";
                    const message = " viewed your meme";
                    const type = "shareGlyph";
                    const fromUserID = user._id;
                    const toUserID = glyff[0].user._id;

                    if(fromUserID.toString() == toUserID.toString()) { 
                        res.status(201).json({status: 1, message: "Meme has been View successfully", code: 201 });
                        return false; 
                    }

                    var requestNotificationObject = {
                        "fromUserID": fromUserID,
                        "toUserID": toUserID,
                        "fromMessage": message,
                        "type": type,
                        "fromUserImageUrl": image,
                        "glyphImageUrl": glyff[0].glyffThumbnail,
                        "isPublic": true,
                        "fromName": user.name,
                        "glyphType": glyff[0].type
                    }

                    GlyphModel.notificationModel(requestNotificationObject, function (err, notification) {
                        if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500 });return false; }

                        User.findByIdAndUpdate({"_id": ObjectId(glyff[0].user._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData) {
                            if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                            var checkStatusPushnotification = badgeData.push_notifications.filter(function(push_notification) {
                                return ( push_notification.type === "share" && push_notification.category === "glyph")
                            });

                            if(!checkStatusPushnotification.length) {
                                res.status(201).json({status: 1, message: "Meme has been View successfully", code: 201 });
                                return false;
                            }

                            var requestPushNotificationObj = {};
                            requestPushNotificationObj.name = requestNotificationObject.fromName;
                            requestPushNotificationObj.device_token = glyff[0].user.device_token;
                            // requestPushNotificationObj.message = requestNotificationObject.fromMessage;
                            requestPushNotificationObj.message = pushMessage;
                            requestPushNotificationObj.type = type;
                            requestPushNotificationObj.badge = badgeData.badge + 1;
                            requestPushNotificationObj.imageUrl = glyff[0].glyffThumbnail;
                            // requestPushNotificationObj.imageUrl = glyff[0].glyffCustomised;
                            requestPushNotificationObj.glyphType = glyff[0].type;

                            GlyphModel.pushNotificationModel(requestPushNotificationObj, function (err, pushNotification) {

                                if(pushNotification) {
                                    res.status(201).json({status: 1, message: "Meme has been View successfully", code: 201 });
                                    return false;
                                }

                            });
                        });
                    });
                });
            });
        });
});

}
exports.getFavouriteCountUser = function(req,res){
 var user_id = req.params.userId; 
 console.log("user_id  :",user_id)
 GlyphModel.getFavouriteCountOfParticularUser(user_id, function(err,glyphs) {
    if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
    if(!glyphs.length) { res.status(404).json({status: 0, message: "Memes are not found",data: [], code: 404 }); return false;}
    res.send({
        data:glyphs
    })
})
}
exports.fetchAllGlif = function(req,res){
    GlyphModel.fetchAllGlifModel(null,function(err, followers){
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(!followers.length) { res.status(404).json({status: 0, message: "Memes are not found",data: [], code: 404 }); return false;}
        res.send({
            result:followers
        })
    })
}




// function strtotime (text, now) {

//   var parsed
//   var match
//   var today
//   var year
//   var date
//   var days
//   var ranges
//   var len
//   var times
//   var regex
//   var i
//   var fail = false
//   if (!text) {
//     return fail
// }
//   // Unecessary spaces
//   text = text.replace(/^\s+|\s+$/g, '')
//   .replace(/\s{2,}/g, ' ')
//   .replace(/[\t\r\n]/g, '')
//   .toLowerCase()
//   // in contrast to php, js Date.parse function interprets:
//   // dates given as yyyy-mm-dd as in timezone: UTC,
//   // dates with "." or "-" as MDY instead of DMY
//   // dates with two-digit years differently
//   // etc...etc...
//   // ...therefore we manually parse lots of common date formats
//   var pattern = new RegExp([
//     '^(\\d{1,4})',
//     '([\\-\\.\\/:])',
//     '(\\d{1,2})',
//     '([\\-\\.\\/:])',
//     '(\\d{1,4})',
//     '(?:\\s(\\d{1,2}):(\\d{2})?:?(\\d{2})?)?',
//     '(?:\\s([A-Z]+)?)?$'
//     ].join(''))
//   match = text.match(pattern)
//   if (match && match[2] === match[4]) {
//     if (match[1] > 1901) {
//       switch (match[2]) {
//         case '-':
//           // YYYY-M-D
//           if (match[3] > 12 || match[5] > 31) {
//             return fail
//         }
//         return new Date(match[1], parseInt(match[3], 10) - 1, match[5],
//           match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//         case '.':
//           // YYYY.M.D is not parsed by strtotime()
//           return fail
//           case '/':
//           // YYYY/M/D
//           if (match[3] > 12 || match[5] > 31) {
//             return fail
//         }
//         return new Date(match[1], parseInt(match[3], 10) - 1, match[5],
//           match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//     }
// } else if (match[5] > 1901) {
//   switch (match[2]) {
//     case '-':
//           // D-M-YYYY
//           if (match[3] > 12 || match[1] > 31) {
//             return fail
//         }
//         return new Date(match[5], parseInt(match[3], 10) - 1, match[1],
//           match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//         case '.':
//           // D.M.YYYY
//           if (match[3] > 12 || match[1] > 31) {
//             return fail
//         }
//         return new Date(match[5], parseInt(match[3], 10) - 1, match[1],
//           match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//         case '/':
//           // M/D/YYYY
//           if (match[1] > 12 || match[3] > 31) {
//             return fail
//         }
//         return new Date(match[5], parseInt(match[1], 10) - 1, match[3],
//           match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//     }
// } else {
//   switch (match[2]) {
//     case '-':
//           // YY-M-D
//           if (match[3] > 12 || match[5] > 31 || (match[1] < 70 && match[1] > 38)) {
//             return fail
//         }
//         year = match[1] >= 0 && match[1] <= 38 ? +match[1] + 2000 : match[1]
//         return new Date(year, parseInt(match[3], 10) - 1, match[5],
//           match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//         case '.':
//           // D.M.YY or H.MM.SS
//           if (match[5] >= 70) {
//             // D.M.YY
//             if (match[3] > 12 || match[1] > 31) {
//               return fail
//           }
//           return new Date(match[5], parseInt(match[3], 10) - 1, match[1],
//             match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//       }
//       if (match[5] < 60 && !match[6]) {
//             // H.MM.SS
//             if (match[1] > 23 || match[3] > 59) {
//               return fail
//           }
//           today = new Date()
//           return new Date(today.getFullYear(), today.getMonth(), today.getDate(),
//             match[1] || 0, match[3] || 0, match[5] || 0, match[9] || 0) / 1000
//       }
//           // invalid format, cannot be parsed
//           return fail
//           case '/':
//           // M/D/YY
//           if (match[1] > 12 || match[3] > 31 || (match[5] < 70 && match[5] > 38)) {
//             return fail
//         }
//         year = match[5] >= 0 && match[5] <= 38 ? +match[5] + 2000 : match[5]
//         return new Date(year, parseInt(match[1], 10) - 1, match[3],
//           match[6] || 0, match[7] || 0, match[8] || 0, match[9] || 0) / 1000
//         case ':':
//           // HH:MM:SS
//           if (match[1] > 23 || match[3] > 59 || match[5] > 59) {
//             return fail
//         }
//         today = new Date()
//         return new Date(today.getFullYear(), today.getMonth(), today.getDate(),
//           match[1] || 0, match[3] || 0, match[5] || 0) / 1000
//     }
// }
// }
//   // other formats and "now" should be parsed by Date.parse()
//   if (text === 'now') {
//     return now === null || isNaN(now)
//     ? new Date().getTime() / 1000 | 0
//     : now | 0
// }
// if (!isNaN(parsed = Date.parse(text))) {
//     return parsed / 1000 | 0
// }
//   // Browsers !== Chrome have problems parsing ISO 8601 date strings, as they do
//   // not accept lower case characters, space, or shortened time zones.
//   // Therefore, fix these problems and try again.
//   // Examples:
//   //   2015-04-15 20:33:59+02
//   //   2015-04-15 20:33:59z
//   //   2015-04-15t20:33:59+02:00
//   pattern = new RegExp([
//     '^([0-9]{4}-[0-9]{2}-[0-9]{2})',
//     '[ t]',
//     '([0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?)',
//     '([\\+-][0-9]{2}(:[0-9]{2})?|z)'
//     ].join(''))
//   match = text.match(pattern)
//   if (match) {
//     // @todo: time zone information
//     if (match[4] === 'z') {
//       match[4] = 'Z'
//   } else if (match[4].match(/^([+-][0-9]{2})$/)) {
//       match[4] = match[4] + ':00'
//   }
//   if (!isNaN(parsed = Date.parse(match[1] + 'T' + match[2] + match[4]))) {
//       return parsed / 1000 | 0
//   }
// }
// date = now ? new Date(now * 1000) : new Date()
// days = {
//     'sun': 0,
//     'mon': 1,
//     'tue': 2,
//     'wed': 3,
//     'thu': 4,
//     'fri': 5,
//     'sat': 6
// }
// ranges = {
//     'yea': 'FullYear',
//     'mon': 'Month',
//     'day': 'Date',
//     'hou': 'Hours',
//     'min': 'Minutes',
//     'sec': 'Seconds'
// }
// function lastNext (type, range, modifier) {
//     var diff
//     var day = days[range]
//     if (typeof day !== 'undefined') {
//       diff = day - date.getDay()
//       if (diff === 0) {
//         diff = 7 * modifier
//     } else if (diff > 0 && type === 'last') {
//         diff -= 7
//     } else if (diff < 0 && type === 'next') {
//         diff += 7
//     }
//     date.setDate(date.getDate() + diff)
// }
// }
// function process (val) {
//     // @todo: Reconcile this with regex using \s, taking into account
//     // browser issues with split and regexes
//     var splt = val.split(' ')
//     var type = splt[0]
//     var range = splt[1].substring(0, 3)
//     var typeIsNumber = /\d+/.test(type)
//     var ago = splt[2] === 'ago'
//     var num = (type === 'last' ? -1 : 1) * (ago ? -1 : 1)
//     if (typeIsNumber) {
//       num *= parseInt(type, 10)
//   }
//   if (ranges.hasOwnProperty(range) && !splt[1].match(/^mon(day|\.)?$/i)) {
//       return date['set' + ranges[range]](date['get' + ranges[range]]() + num)
//   }
//   if (range === 'wee') {
//       return date.setDate(date.getDate() + (num * 7))
//   }
//   if (type === 'next' || type === 'last') {
//       lastNext(type, range, num)
//   } else if (!typeIsNumber) {
//       return false
//   }
//   return true
// }
// times = '(years?|months?|weeks?|days?|hours?|minutes?|min|seconds?|sec' +
// '|sunday|sun\\.?|monday|mon\\.?|tuesday|tue\\.?|wednesday|wed\\.?' +
// '|thursday|thu\\.?|friday|fri\\.?|saturday|sat\\.?)'
// regex = '([+-]?\\d+\\s' + times + '|' + '(last|next)\\s' + times + ')(\\sago)?'
// match = text.match(new RegExp(regex, 'gi'))
// if (!match) {
//     return fail
// }
// for (i = 0, len = match.length; i < len; i++) {
//     if (!process(match[i])) {
//       return fail
//   }
// }
// return (date.getTime() / 1000)
// }
exports.deleteMemeByAdmin = function(req,res){
    if(!req.params.id) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data:[]});
        return false;
    }
    var user_id = req.params.id; 
    GlyphModel.deleteMeme(user_id,function(err,data){
        if(err) { res.status(500).json({code: 0, message: err,data: [] }); return false;}
        res.send({
            message:"successfully deleted",
            code:1
        })
    })   
}
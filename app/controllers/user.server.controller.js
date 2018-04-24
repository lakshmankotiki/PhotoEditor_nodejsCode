/**************************
 MODULE INITIALISATION
 **************************/
 var mongoose = require('mongoose');
 var User = require('../models/users.server.model').user;
 var Follow = require('../models/users.server.model').follow;
 var ObjectId = require('mongodb').ObjectID;
 var Authentication = require('../models/users.server.model').Authentication;
 var Notifications = require('../models/notifications.server.model').notifications;
 var apn = require('apn');
 var Notification = require('../../configs/notification');
 var reportglyff    = require('../models/report.server.model').reportglyff;
 var GlyphModel = require('../models/glyff.server.model');
 function usersList (userId, queryCondition) {

    return new Promise((resolve, reject) => {

        queryCondition = queryCondition || {};

        User.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: queryCondition
                },

                // Stage 2
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "_id",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 3
                {
                    $sort: {
                        "createdAt" : -1
                    }
                },

                // Stage 4
                {
                    $project: {
                        "_id" : 1,
                        "userVerified" : 1,
                        "isPublic" : 1,
                        "device_token" : 1,
                        "gender" : 1,
                        "hash_password" : 1,
                        "fb_profile_pic_url" : 1,
                        "fb_id" : 1,
                        "sharedCount" : 1,
                        "trendingCount" : 1,
                        "image" : 1,
                        "glyffCount" : 1,
                        "isFollowed" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "mobile" : 1,
                        "language" : 1,
                        "name" : 1,
                        "email" : 1,
                        "nickname" : 1,
                        "username" : 1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "block" : 1
                    }
                },

                ], function(err, users) {
                    if (err) return reject(err)
                        if(!(users.length > 0)) return resolve(users);

                    var counter = 0;
                    var lengthOfUser = users.length;

                    var newusers = users.filter(function (user) {

                        if (String(user._id) == userId) {
                            counter++;
                            return;
                        }

                        if (user.block.length) {

                            var block = user.block.filter(function (block) {

                                if (String(block.blockedById) == userId) {
                                    counter++;
                                    return;
                                } else {
                                    return block;
                                }

                            })

                            if (block.length == user.block.length) {
                                counter++;
                                return user;
                            }

                        } else {
                            counter++;
                            return user;
                        }

                    })


                    if(lengthOfUser == counter) {

                        return resolve(newusers);
                    }

                });
    });
}

/**************************
 PEOPLE LIST API
 **************************/
 exports.peopleList = function (req, res) {

    // API call to fetch people list
    var login_id = String(req.query.user_id);
    var limit = parseInt(req.query.limit);
    // var originalLimit = parseInt(req.query.limit);
    var offset = parseInt(req.query.offset);
    var userId = ObjectId(login_id);
    var nameRegex = {userVerified: true};

    usersList(login_id,nameRegex).then((newusers) => {

       if(!newusers.length) {res.status(404).json({status: 0, message: "Users not found", data: [] }); return false;}

       var count = newusers.length;
       var users = newusers.splice(offset, limit)

       users.map(function(k,v){
           var id = String(k._id);
           Follow.find({followerId:ObjectId(login_id)},function(err,followers) {
               followers.map(function(data,key){
                   if(followers[key].followeeId == id && followers[key].isValid == true){
                       users[v].isFollowed = 2;
                   } else {
                       users[v].isFollowed = 1;
                   }
               });
               Follow.count({followerId:ObjectId(id),isValid:true},function(err,followee_count) {
                   Follow.count({followeeId:ObjectId(id),isValid:true},function(err,follower_count) {
                       users[v].followerCount = follower_count;
                       users[v].followeeCount = followee_count;
                       var al = v+1;
                       if(users.length == al){
                           res.status(200).json({status: 1, message: "Users found successfully", data: { users:users, count: count, offset: offset }});
                           return false;
                       }
                   });
               });
           });
       });

   }).catch((e)=>{res.status(500).json({status: 0, message: err, data: [] }); return false;});
}

/**************************
 USER PROFILE API
 **************************/
 exports.userProfile = function (req, res) {

    // Validating user id
    if(!req.params.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data: []});
        return false;
    }

    // API call to fetch specific people details
    var queryUserProfileObject = {"_id": req.params.userId}
    User.findOne(queryUserProfileObject, {hash_password: 0}, function(err, user) {
        if(err) { res.status(500).json({status: 0, message: err, data: [] });return false; }
        if(!user) { res.status(404).json({status: 0, message: "User is not found", data: [] }); return false;}

        res.status(200).json({status: 1, message: "User found successfully", data:{user:user}});
        return false;

    });
}

/**************************
 Follow/Unfollow User API
 **************************/
 exports.setFollow = function (req, res) {
    // API call to set follow status
    var followerId = req.body.followerId;
    var followeeId = req.body.followeeId;
    var status = req.body.status;

    if(followeeId == followerId){
        res.status(404).json({status: 0, message: "User can not "+ status +" by self.", data: [] }); 
        return false;
    } else if(status == "follow"){

        var queryUserObject = {"_id": followeeId, "userVerified": true}
        User.findOne({"_id": followerId}, {hash_password: 0}, function(error, followUser) {
            console.log("followUser",followUser);
            var followUserImageUrl = followUser.image;
            if(followUser.fb_id) { followUserImageUrl = followUser.fb_profile_pic_url; }
            console.log("followUserImageUrl",followUserImageUrl);
            
            if(error) { res.status(500).json({status: 0, message: error, data: [] });return false; }
            if(!followUser) { res.status(404).json({status: 0, message: "User is not found", data: [] }); return false;}

            if(followUser) { 
                User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
                    if(err) { res.status(500).json({status: 0, message: err, data: [] });return false; }
                    if(!user) { res.status(404).json({status: 0, message: "User is not found", data: [] }); return false;}

                    if(user) {

                        var followeeImage = (user.image != "") ? user.image : user.fb_profile_pic_url;

                        Follow.find({followeeId:followeeId,followerId:followerId},function(err, follow) {
                            if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

                            if(follow.length > 0) {
                                res.status(404).json({status: 0, message: "Already followed", data: [] });
                                return false;
                            } else {
                                // Initialising fields of follow object to save
                                var newFollow = new Follow();

                                newFollow.set('followeeId', followeeId);
                                newFollow.set('followerId', followerId);
                                (user.isPublic == true) ? newFollow.set('isValid', true) : newFollow.set('isValid', false);

                                // API call to save follow details
                                newFollow.save(function(err, followData) {
                                    if (err) { res.status(500).json({status: 0, message: err,data: []}); return false;}
                                    if(!followData) { res.status(400).json({status: 0, message: "Bad Request Follow User is not saved",data: [] }); return false;}

                                    var querySecondUserObject = {"_id": followerId, "userVerified": true}
                                    User.findOne(querySecondUserObject, {hash_password: 0}, function(err, seconduser) {

                                        if(!seconduser) {
                                            return false;
                                        }

                                        Follow.find({followeeId:followerId,followerId:followeeId,isValid:true},function(err, checkReverseFollower) {

                                            var newNotification = new Notifications();
                                            newNotification.set('isFromReverseFollowing', false);
                                            //check Followee is already follow//start
                                            if(checkReverseFollower.length > 0) {
                                                newNotification.set('isToReverseFollowing', true);
                                                if(user.isPublic == true) {
                                                    Notifications.findOneAndUpdate({toUserID:followerId,fromUserID:followeeId, type: "following"}, {$set: {isToReverseFollowing: true}}, { new: true }, function (err, notifications) {

                                                    });
                                                }
                                                Notifications.findOneAndUpdate({toUserID:followerId,fromUserID:followeeId, type: "following"}, {$set: {isFromReverseFollowing: true,isToAcceptedFollowRequest: true}}, { new: true }, function (err, notifications) {

                                                });
                                            } else {
                                                if(user.isPublic == true) { newNotification.set('isToReverseFollowing', false); newNotification.set('isFromReverseFollowing', true);}
                                            }
                                            //end
                                            //check Follower is public//start
                                            if(followUser.isPublic == true) {
                                                Notifications.findOneAndUpdate({toUserID:followeeId,fromUserID:followerId, type: "following"}, {$set: {isFromReverseFollowing: true}}, { new: true }, function (err, notifications) {

                                                });
                                            }
                                            //end

                                            var followerImage = (seconduser.image == "") ? seconduser.fb_profile_pic_url : seconduser.image;


                                            newNotification.set('toUserID', followeeId);
                                            newNotification.set('fromUserID', followerId);
                                            const fromMessage = (user.isPublic == true) ? 'You are following ' + user.name : 'You have sent follow request to ' + user.name;
                                            newNotification.set('fromMessage', fromMessage);
                                            const toMessage = (user.isPublic == true) ? seconduser.name + ' is following you' : seconduser.name + ' has sent you a follow request';
                                            newNotification.set('toMessage', toMessage);
                                            (user.isPublic == true) ? newNotification.set('type', 'following') : newNotification.set('type', 'follow');
                                            newNotification.set('isDenied', false);
                                            newNotification.set('toUserImageUrl', followeeImage);
                                            newNotification.set('fromUserImageUrl', followerImage);
                                            (user.isPublic == true) ? newNotification.set('isPublic', true) : newNotification.set('isPublic', false);
                                            newNotification.set('toName', user.name);
                                            newNotification.set('fromName', seconduser.name);
                                            newNotification.set('isFromAcceptedFollowRequest', true);
                                            newNotification.set('followUserImageUrl',followUserImageUrl);
                                            // (user.isPublic == true) ? newNotification.set('isAFollowingB', true) : newNotification.set('isAFollowingB', false);

                                            var typeFollow = (user.isPublic == true) ? 'following' : 'follow';

                                            var queryParam = {
                                                "toUserID": followeeId,
                                                "fromUserID": followerId,
                                                "type": typeFollow
                                            }

                                            User.findByIdAndUpdate({"_id": ObjectId(followeeId)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData) {
                                                if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                                                Notifications.findOne(queryParam, function (err, notifications) {
                                                    if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                                                    var checkStatusPushnotification = user.push_notifications.filter(function(push_notification) {
                                                        return ( push_notification.type === "follow" && push_notification.category === "follow")
                                                    });

                                                    if(notifications) {

                                                        if(!checkStatusPushnotification.length) {
                                                            res.status(200).json({status: 1, message: "Users is followed by you successfully", data:[] });
                                                            return false;
                                                        }

                                                        Notification.pushNotification({"type": typeFollow,"glyphThumbnail": followUserImageUrl, "glyphType": "image", "device_token": user.device_token, "message": toMessage, "name": user.name,"badge": badgeData.badge + 1}, function(err, firstNotification) {
                                                            res.status(200).json({status: 1, message: "Users is followed by you successfully", data:[] });
                                                            return false;
                                                        })

                                                    } else {
                                                        //set accept Follow request//start
                                                        Notifications.findOneAndUpdate({toUserID:followerId,fromUserID:followeeId, type: "following"}, {$set: {isToAcceptedFollowRequest: true}}, { new: true }, function (err, newFollow1) {
                                                            Notifications.findOneAndUpdate({toUserID:followerId,fromUserID:followeeId, type: "follow"}, {$set: {isToAcceptedFollowRequest: true}}, { new: true }, function (err, newFollow2) {
                                                                if(newFollow1 || newFollow2){
                                                                    newNotification.set('isToAcceptedFollowRequest', true);
                                                                }
                                                                newNotification.save(function(err, notification) {
                                                                    if(!notification) {
                                                                        return false;
                                                                    }

                                                                    if(!checkStatusPushnotification.length) {
                                                                        res.status(200).json({status: 1, message: "Users is followed by you successfully", data:[] });
                                                                        return false;
                                                                    }

                                                                    Notification.pushNotification({"type": typeFollow, "glyphThumbnail": followUserImageUrl, "glyphType": "image", "device_token": user.device_token, "message": toMessage, "name": user.name,"badge": badgeData.badge + 1}, function(err, firstNotification) {
                                                                        res.status(200).json({status: 1, message: "Users is followed by you successfully", data:[] });
                                                                        return false;
                                                                    })
                                                                })
                                                            });
                                                        });
                                                        //end
                                                    }
                                                });
});



});


})

});
}
});
}

});
}
});
} else if(status == 'unfollow'){

    Follow.find({followeeId:followeeId,followerId:followerId},function(err, follow) {
        if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

        if(follow.length > 0) {

            Follow.remove({followeeId:followeeId,followerId:followerId},function(err,data){
                if (err) { res.status(500).json({status: 0, message: err,data: []}); return false;}
                if(!data) { res.status(400).json({status: 0, message: "Bad Request unfollow User is not saved",data: [] }); return false;}

                Notifications.remove({$and: [
                    { toUserID:followeeId }, { fromUserID:followerId },
                    { $or: [{type: 'follow'}, {type: 'following'}] }
                    ]},function(err,data) {
                        if (err) { res.status(500).json({status: 0, message: err,data: []}); return false; }

                        res.status(200).json({status: 1, message: "Users is unfollowed by you successfully", data: [] });
                        return false;
                    })
            })
        } else {
            res.status(404).json({status: 0, message: "User is not followed by you", data: [] }); 
            return false;
        }
    });
}
}

function updateNotification(notification, callback) {

    if(notification.isPublic) { callback(null, false); }
    console.log("notification",notification);
    console.log("A");
    var queryUserObject = {"_id": notification.fromUserID, "userVerified": true}
    User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
        if(!user) { callback(null, false); }
        console.log("B");
        // Initialisation of variables
        var toMessage = notification.fromName + ' is following you';
        var fromMessage = 'You are following ' + notification.toName;

        Follow.findOneAndUpdate({followeeId:notification.toUserID, followerId:notification.fromUserID}, {$set: {isValid: true}}, { new: true }, function (err, follow) {
            console.log("C");
            Follow.find({followeeId:notification.fromUserID,followerId:notification.toUserID,isValid:true},function(err, checkReverseFollower) {

                var isReverseFollowing = (checkReverseFollower.length > 0) ? true : false;

                Notifications.findOneAndUpdate({toUserID:notification.fromUserID,fromUserID:notification.toUserID,type:"following"}, {$set: {isReverseFollowing: isReverseFollowing}}, { new: true }, function (err, notifications) {
                    console.log("D");
                });

                console.log("E");

                Notifications.findOneAndUpdate({toUserID:notification.toUserID,fromUserID:notification.fromUserID}, {$set: {toMessage:toMessage,fromMessage:fromMessage, toName: notification.toName, type: 'following', isPublic:true, updatedAt: new Date(), isReverseFollowing: isReverseFollowing}}, { new: true }, function (err, notifications) {
                    if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
                    console.log("F");
                    User.findByIdAndUpdate({"_id": ObjectId(user._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData1) {
                        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
                        console.log("G");
                        var checkStatusPushnotification = badgeData1.push_notifications.filter(function(push_notification) {
                            if(push_notification.type === "follow" && push_notification.category === "follow") {
                                console.log("H");
                                Notification.pushNotification({"type": "following", "device_token": user.device_token, "glyphType": "image", "glyphThumbnail": notification.toUserImageUrl, "message": fromMessage, "name": notification.fromName,"badge":badgeData1.badge + 1}, function(err, firstNotification) {
                                    console.log("firstNotification",firstNotification);
                                    console.log("I");
                                })
                            }
                        });

                        User.findByIdAndUpdate({"_id": ObjectId(notification.toUserID)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData2) {
                            if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
                            console.log("J");
                            var checkStatusPushSecondnotification = badgeData2.push_notifications.filter(function(push_notification) {
                                console.log("K");
                                return ( push_notification.type === "follow" && push_notification.category === "follow")
                            });

                            if(!checkStatusPushSecondnotification.length) {
                                console.log("L");
                                callback(null, true);
                            }

                            Notification.pushNotification({"type": "following", "device_token": notification.device_token, "glyphType": "image", "glyphThumbnail": notification.fromUserImageUrl, "message": toMessage, "name": notification.toName,"badge":badgeData2.badge + 1}, function(err, secondNotification) {
                                console.log("secondNotification",secondNotification);
                                if (secondNotification) {
                                    console.log("M");
                                    callback(null, true);
                                } else {
                                    console.log("N");
                                    callback(null, false);
                                }
                            })
                        });
                    });
                });

            });


        });
});
}

/*****************
 EDIT PROFILE API
 *****************/
 exports.editProfile = function (req, res) {

    var setObject = {};

    if(req.file != undefined) {
        setObject.image = req.file.location;
    }

    // Validating user id
    if(!req.params.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data: []});
        return false;
    }


    req.body.name ? (setObject.name = req.body.name) : delete setObject.name;
    req.body.nickname ? (setObject.nickname = req.body.nickname) : delete setObject.nickname;
    req.body.email ? (setObject.email = req.body.email) : delete setObject.email;
    req.body.isPublic ? (setObject.isPublic = req.body.isPublic) : delete setObject.isPublic;
    req.body.mobile ? (setObject.mobile = req.body.mobile) : delete setObject.mobile;
    req.body.instagram_id ? (setObject.instagram_id = req.body.instagram_id) : delete setObject.instagram_id;
    req.body.isContactSync ? (setObject.isContactSync = req.body.isContactSync) : delete setObject.isContactSync;
    req.body.fb_id ? (setObject.fb_id = req.body.fb_id) : delete setObject.fb_id;
    req.body.badge ? (setObject.badge = req.body.badge) : delete setObject.badge;

    // API call to find user and update the profile in db
    User.findByIdAndUpdate(req.params.userId, {$set: setObject}, { new: true }, function (err, user) {
        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
        if(!user) { res.status(404).json({status: 0, message: "User does not exists", code: 404, data: [] }); return false; }

        if(setObject.isPublic == 'true' || setObject.isPublic == true) {

            Notifications.find({toUserID:req.params.userId}, function (err, notifications) {
                if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
                if(notifications.length <= 0) { res.status(200).json({status: 1, message: "Users profile updated successfully", code: 200, data:{ user: user } }); return false; }

                var noticnt = 0;
                notifications.filter( function(notification) {

                    var notificationObject = notification;
                    notificationObject.device_token = req.body.device_token;
                    if(setObject.name) {
                        notification.toName = setObject.name;
                    }

                    updateNotification(notificationObject, function (err, result) {
                        if(result) {
                            noticnt++;
                            if(noticnt == notifications.length){
                                res.status(200).json({status: 1, message: "Users profile updated successfully", code: 200, data:{ user: user } });
                                return false;
                            }
                        }
                    })
                });
            });
        } else {
            res.status(200).json({status: 1, message: "Users profile updated successfully", code: 200, data:{ user: user } });
            return false;
        }
    });

}

/**************************
 Accept Follow Request User API
 **************************/
 exports.acceptFollowRequest = function (req, res) {
    // API call to set follow status
    var followerId = req.body.followerId;
    var followeeId = req.body.followeeId;

    console.log("followerId",followerId,"followeeId",followeeId);
    var toMessage = '';
    var fromMessage = '';


    if(followeeId == followerId){
        res.status(404).json({status: 0, message: "Bad Request Same User IDs", data: [] });
        return false;
    }

    // API call to find user and update the profile in db
    Follow.findOneAndUpdate({followeeId:followeeId, followerId:followerId}, {$set: {isValid: true,updatedAt: new Date()}}, { new: true }, function (err, follow) {
        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }
        if(!follow) { res.status(404).json({status: 0, message: "User does not exists", code: 404, data: [] }); return false; }

        var queryfirstUserObj = {"_id": followerId, "userVerified": true}
        console.log("queryfirstUserObj:",queryfirstUserObj)
        User.findOne(queryfirstUserObj, {hash_password: 0}, function(err, user) {
            if (err) {
                res.status(500).json({status: 0, message: err, data: []});
                return false;
            }

            if (!user) {
                res.status(404).json({status: 0, message: "User is not found", data: []});
                return false;
            }

            var querySecondUserObj = {"_id": followeeId, "userVerified": true}
            User.findOne(querySecondUserObj, {hash_password: 0}, function(err, userObj) {
                if (err) {
                    res.status(500).json({status: 0, message: err, data: []});
                    return false;
                }

                if (!userObj) {
                    res.status(404).json({status: 0, message: "User is not found", data: []});
                    return false;
                }

                var toMessage = user.name + ' is following you.' ;
                var fromMessage = userObj.name + ' has accepted your follow request.';
                var followUserImageUrl = userObj.image;
                if(userObj.fb_profile_pic_url) { followUserImageUrl = userObj.fb_profile_pic_url; }

                Follow.find({followeeId:followerId,followerId:followeeId,isValid:true},function(err, checkReverseFollower) {
                    var isReverseFollowing = (checkReverseFollower.length > 0) ? true : false;
                    
                    Notifications.findOneAndUpdate({toUserID:followerId,fromUserID:followeeId,type: "follow"}, {$set: {isFromReverseFollowing: isReverseFollowing,isToReverseFollowing : true}}, { new: true }, function (err, notifications) {

                        Notifications.findOneAndUpdate({toUserID:followerId,fromUserID:followeeId,type: "following"}, {$set: {isFromReverseFollowing: isReverseFollowing,isToReverseFollowing : true}}, { new: true }, function (err, notifications) {

                        });
                    });






                    // Follow.find({followerId:followerId,followeeId:followeeId,isValid:true},function(err, checkReverseFollower2) {

                    //     var isToReverseFollowing = (checkReverseFollower2.length > 0) ? true : false;

                    //     Notifications.findOneAndUpdate({toUserID:followerId,fromUserID:followeeId,type: "follow"}, {$set: {isToReverseFollowing: isToReverseFollowing}}, { new: true }, function (err, notifications) {

                    //     });

                    Notifications.findOneAndUpdate({toUserID:followeeId,fromUserID:followerId}, {$set: {toMessage:toMessage,fromMessage:fromMessage, type: 'following', updatedAt: new Date(), isFromReverseFollowing: true , isToReverseFollowing: isReverseFollowing}}, { new: true }, function (err, notifications) {
                        if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                        User.findByIdAndUpdate({"_id": ObjectId(user._id)},{$inc: { badge: 1 }},{hash_password: 0}, function(err, badgeData2) {
                            if (err) { res.status(500).json({status: 0, message: err, code: 500, data: [] }); return false; }

                            var checkStatusPushnotification = user.push_notifications.filter(function(push_notification) {
                                return ( push_notification.type === "follow" && push_notification.category === "follow")
                            });

                            if(!checkStatusPushnotification.length) {
                                res.status(200).json({status: 1, message: "Follow request has been accepted successfully", code: 200 });
                                return false;
                            }

                            Notification.pushNotification({"type": "following", "device_token": user.device_token, "glyphType": "image", "glyphThumbnail": followUserImageUrl, "message": fromMessage, "name": user.name}, function(err, firstNotification) {
                                console.log("1st notifications", firstNotification);

                            })

                            res.status(200).json({status: 1, message: "Follow request has been accepted successfully", code: 200 });
                            return false;
                        });
                    });
                    //});
                });

            });

        });

});
}

/**************************
 Deny Follow Request User API
 **************************/
 exports.denyFollowRequest = function (req, res) {
    // API call to set follow status
    var followerId = req.body.followerId;
    var followeeId = req.body.followeeId;

    if(followeeId == followerId){
        res.status(404).json({status: 0, message: "Bad Request Same User IDs", data: [] });
        return false;
    }

    Follow.remove({followeeId:followeeId,followerId:followerId},function(err,data){
        if (err) { res.status(500).json({status: 0, message: err,data: []}); return false; }

        Notifications.remove({toUserID:followeeId,fromUserID:followerId, type: 'follow'},function(err,data) {
            if (err) { res.status(500).json({status: 0, message: err,data: []}); return false; }

            res.status(200).json({status: 1, message: "Follow request has been rejected successfully", code: 200 });
            return false;
        })
    })

}

/**************************
 PEOPLE LIST API
 **************************/
 exports.searchPeople = function (req, res) {

    if(!(req.query.user_id && req.query.limit && req.query.offset)){
        res.status(404).json({status: 0, message: "Bad Request Invalid Parameters", data: [] });
        return false;
    }

    // API call to fetch people list
    var name = String(req.query.name);
    var limit = parseInt(req.query.limit);
    var offset = parseInt(req.query.offset);
    var userId = ObjectId(req.query.user_id);
    var login_id = req.query.user_id;

    // var nameRegex = {name : new RegExp(name, 'i'), userVerified: true};

    var nameRegex = {"name": { '$regex' : name, '$options' : 'i' }, "userVerified": true};

    usersList(login_id,nameRegex).then((newusers) => {

        if(!newusers.length) {res.status(404).json({status: 0, message: "Users not found", data: [] }); return false;}
        // console.log(newusers, "users", newusers.length)
        // if(req.query.type == 'followee') {
        //     Follow.find({followerId:userId,isValid:true},function(err, followees) {
        //         if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}
        //
        //         if(followees.length > 0) {
        //             followees.filter(function (followee) {
        //
        //             })
        //
        //         } else {
        //             res.status(404).json({status: 0, message: "User is not followed by you", data: [] });
        //             return false;
        //         }
        //     });
        // }


        var count = newusers.length;
        var users = newusers.splice(offset, limit);
        var follows = [];
        var unfollows = [];
        var cnt = 0;
        users.map(function(k,v){
         var id = String(k._id);
         Follow.find({followerId:ObjectId(login_id),followeeId:ObjectId(id)},function(err,followers) {
            Follow.count({followerId:ObjectId(id),isValid:true},function(err,followee_count) {
                Follow.count({followeeId:ObjectId(id),isValid:true},function(err,follower_count) {
                    users[v].followerCount = follower_count;
                    users[v].followeeCount = followee_count;
                    if(followers.length > 0  && followers[0].isValid == true){
                        users[v].isFollowed = 2;
                        follows.push(users[v]);
                    }
                    else{
                        if(followers.length > 0 && !followers[0].isValid) {
                            users[v].isFollowed = 1;
                        }

                        unfollows.push(users[v]);
                    }

                    cnt = cnt + 1;
                    if(users.length == cnt){
                        var finalUsers = follows.concat(unfollows);
                        res.status(200).json({status: 1, message: "Users found successfully", data: { users:finalUsers, count: count, offset: offset }});
                        return false;
                    }
                });
            });
        });
     });
    }).catch((e)=>{res.status(500).json({status: 0, message: err, data: [] }); return false;});

}

/**************************
 FOLLOWEE LIST API
 **************************/
 exports.fetchFollowees = function (req, res) {

    if(!(req.query.user_id && req.query.limit && req.query.offset)){
        res.status(404).json({status: 0, message: "Bad Request Invalid Parameters", data: [] });
        return false;
    }

    // API call to fetch followers list
    var limit = parseInt(req.query.limit);
    var offset = parseInt(req.query.offset);
    var userId = ObjectId(req.query.user_id);

    Follow.aggregate(

        // Pipeline
        [

             // Stage 1
            // {
            //     $sort: { userName : 1 }
            // },

            // Stage 2
            {
                $match: {
                 "followerId": userId,
                 "isValid": true
             }
         },

            // Stage 3
            {
                $skip: offset
            },

            // Stage 4
            {
             $limit: limit
         },

            // Stage 5
            {
                $lookup: {
                    "from" : "users",
                    "localField" : "followeeId",
                    "foreignField" : "_id",
                    "as" : "user"
                }
            },

            {
                $unwind: "$user"
            },
            // Stage 6
            {
                $project: {
                    _id: 1,
                    isValid : 1,
                    followerId : 1,
                    followeeId : 1,
                    createdAt : 1,
                    user : '$user',
                    userNameLowerCase: {$toLower: "$user.name"}
                }
            },
            
            {
                $sort: { userNameLowerCase : 1 }
            },

            ], function(err, follow) {
                if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500}); return false;}
                if(!follow.length) { res.status(404).json({status: 0, message: "You are not following to anyone.", data: [], code: 404 }); return false; }

                Follow.count({"followerId": userId}, function(err,count){
                    follow.map(function(data,key){
                        follow[key].user.isFollowed = 2;
                    });
                    res.status(200).json({status: 1, message: "Followee found successfully", data: { follow: follow, count: count, offset: offset } } );
                    return false;
                })
            });
}


/**************************
 FOLLOWER LIST API
 **************************/
 exports.fetchFollowers = function (req, res) {

    if(!(req.query.user_id && req.query.limit && req.query.offset)){
        res.status(404).json({status: 0, message: "Bad Request Invalid Parameters", data: [] });
        return false;
    }

    // API call to fetch followers list
    var limit = parseInt(req.query.limit);
    var offset = parseInt(req.query.offset);
    var userId = ObjectId(req.query.user_id);

    Follow.aggregate(

        // Pipeline
        [
            // Stage 1
            {
                $match: {
                    "followeeId": userId,
                    "isValid": true
                }
            },

            // Stage 2
            {
                $sort: {
                    "createdAt" : -1
                }
            },

            // Stage 3
            {
                $skip: offset
            },

            // Stage 4
            {
                $limit: limit
            },

            // Stage 5
            {
                $lookup: {
                    "from" : "users",
                    "localField" : "followerId",
                    "foreignField" : "_id",
                    "as" : "user"
                }
            },

            // Stage 6
            {
                $project: {
                    "_id" : 1,
                    "isValid" : 1,
                    "followerId" : 1,
                    "followeeId" : 1,
                    "createdAt" : 1,
                    "user" : { $arrayElemAt: [ "$user", 0 ] }
                }
            },

            ], function(err, follow) {
                if(err) { res.status(500).json({status: 0, message: err, data: [], code: 500}); return false;}
                if(!follow.length) { res.status(404).json({status: 0, message: "No one is following you.", data: [], code: 404 }); return false; }

                Follow.count({"followeeId": userId}, function(err,count){
                    res.status(200).json({status: 1, message: "Follower found successfully", data: { follow: follow, count: count, offset: offset } } );
                    return false;
                })
            });
}


/**************************
 USER LIST API
 **************************/
 exports.userList = function (req, res) {

    // Validating user id
    if(!req.query.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data: []});
        return false;
    }

    User.aggregate(

    // Pipeline
    [
        // Stage 1
        {
            $match: {
                _id: { $not: { $eq:ObjectId(req.query.userId)} }
            }
        },

        // Stage 3
        {
            $lookup: {
                "from" : "glyffs",
                "localField" : "_id",
                "foreignField" : "creatorID",
                "as" : "glyffsdata"
            }
        },
        {
            $lookup:{

                "from" : "follows",
                "localField" : "_id",
                "foreignField" : "followeeId",
                "as" : "follower"
                
            }
        },
        {
            $project:{

                "name":1,
                "nickname":1,
                "email":1,
                "username":1,
                "createdAt":1,
                "mobile":1,
                "isPublic":1,
                "fb_profile_pic_url":1,
                "imageThumbnail":1,
                "image":1,
                "glyffsdata":1,
                "follower":1,
                "glyffsCount": { "$size": "$glyffsdata" },
                
            }
        },
        // // Stage 4
        {
            $unwind: {
                path : "$glyffsdata",
                preserveNullAndEmptyArrays : true 

            }
        },

        // // Stage 5
        {
            $project: {

                "viewCounts" : "$glyffsdata.viewCount",
                "sharedCount" : "$glyffsdata.sharedCount",
                "name":1,
                "nickname":1,
                "email":1,
                "username":1,
                "createdAt":1,
                "mobile":1,
                "isPublic":1,
                "fb_profile_pic_url":1,
                "imageThumbnail":1,
                "image":1,
                "glyffsCount":1,
                "followerCount": { "$size": "$follower" }
            }
        },

        // Stage 6
        {
            $group: {
                _id:"$_id",
                totalView:{$sum:'$viewCounts'},
                totalShares:{$sum:'$sharedCount'},
                name:{ $first: '$name' },
                nickname:{ $first: '$nickname' },
                email:{ $first: '$email' },
                username:{ $first: '$username' },
                createdAt:{ $first: '$createdAt' },
                mobile:{ $first: '$mobile' },
                isPublic:{ $first: '$isPublic' },
                fb_profile_pic_url:{ $first: '$fb_profile_pic_url' },
                imageThumbnail:{ $first: '$imageThumbnail' },
                image:{ $first: '$image' },
                glyffsCount:{ $first: '$glyffsCount' },
                followerCount:{ $first: '$followerCount' }
            }
        },

        ],function(err,users){
            if(err) { res.status(500).json({status: 0, message: err, data: [] });return false; }
            if(!users) { res.status(404).json({status: 0, message: "Users are not found", data: [] }); return false;}
            console.log("users:",users)
            var userList = users.filter(function(user) {

                if(user.fb_profile_pic_url) {
                    user.image = user.fb_profile_pic_url
                    user.imageThumbnail = user.fb_profile_pic_url
                } else {
                    user.imageThumbnail = user.image
                }
                return user;
            });
            if(userList.length == users.length) {
                res.status(200).json({status: 1, message: "Users found successfully", data:{users:users}});
                return false;
            }
        }

    // Created with Studio 3T, the IDE for MongoDB - https://studio3t.com/

    );
    
    // var queryUserObject = {"_id": {$ne: ObjectId(req.params.userId)}, "userVerified": true}
    // User.find(queryUserObject, {email: 1, image: 1, fb_profile_pic_url: 1, name: 1, mobile: 1, nickname: 1, imageThumbnail: 1}, function(err, users) {
    //     if(err) { res.status(500).json({status: 0, message: err, data: [] });return false; }
    //     if(!users) { res.status(404).json({status: 0, message: "Users are not found", data: [] }); return false;}

    //     var userList = users.filter(function(user) {

    //         if(user.fb_profile_pic_url) {
    //             user.image = user.fb_profile_pic_url
    //             user.imageThumbnail = user.fb_profile_pic_url
    //         } else {
    //             user.imageThumbnail = user.image
    //         }
    //         return user;
    //     });

    //     if(userList.length == users.length) {
    //         res.status(200).json({status: 1, message: "Users found successfully", data:{users:users}});
    //         return false;
    //     }

    // });
}

exports.deleteUserByAdmin = function(req,res){

    User.findByIdAndRemove(
        req.params.id,
        function(err,data){
            if(err)
            {
                res.send({
                    "errMsg":err,
                    code:0
                })
            }
            else
            {
                Authentication.remove( {"userId":req.params.id},function(error){
                    if(!error){
                        res.json({
                            "msg": "User Deleted successfully..",
                            "code": 1
                        });        
                    }
                });
                
            }
        })
    
}
exports.blockMemeByAdmin = function(req,res){
    var glyph_Id = req.body.glyphId;
    if(!glyph_Id) { res.status(404).json({status: 0, message: "please enter user_id", data: [] }); return false;}
    reportglyff.find({"glyphId":glyph_Id},function(error,data){
        if(data.length){
            console.log("11111111111")
            reportglyff.updateMany({"glyphId":glyph_Id},{ $set: { reportApprovedByAdmin: true } },function(error){
                if(error) { res.status(500).json({status: 0, message: error, data: [] });return false; }
                if(!error){
                 res.json({
                    "msg": "Meme Blocked successfully..",
                    "status": 1
                });  
             }
         } );
        }
        else{

            GlyphModel.blockMemeByAdmin(glyph_Id,function(err,data){
                if(err) { res.status(500).json({code: 0, message: err,data: [] }); return false;}
                res.send({
                    message:"successfully Blocked",
                    status:1
                })
            })   

        }

    })

}
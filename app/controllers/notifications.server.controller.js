/**************************
 MODULE INITIALISATION
 **************************/
 var mongoose = require('mongoose');
 var Notifications = require('../models/notifications.server.model').notifications;
 var ObjectId = require('mongodb').ObjectID;
 var User = require('../models/users.server.model').user;
 var Follow = require('../models/users.server.model').follow;

/**************************
 FETCH USER NOTIFICATIONS LIST API
 **************************/
 exports.getNotifications = function (req, res) {

    // Validating user id
    if(!req.params.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data:[]});
        return false;
    }

    // API call to fetch specific user glyffs
    // var queryUserNotificationsObject = {"fromUserID": req.params.userId}
    // Notifications.find(queryUserNotificationsObject, null, { sort: { createdAt: -1 } }, function(err, notifications) {
    //     if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
    //     if(!notifications) { res.status(404).json({status: 0, message: "Notifications not found",data: [] }); return false;}
    //
    //     res.status(200).json({status: 1, message: "Notifications found successfully", data: { notifications:notifications }});
    //     return false;
    // });
    getFollowingNotificationIds(req.params.userId).then((followingNotification) => {
        getFolloweeNotificationIds(req.params.userId).then((glyffNotification) => {
            var notificationsIds = followingNotification.concat(glyffNotification);
            var query = {$and:[{"toUserID" : ObjectId(req.params.userId)},{"isSame": {$ne: 0}}]};
            if(notificationsIds.length > 0){
                var query = {$and:[{"isSame": {$ne: 0}},
                {$or:[{"toUserID" : ObjectId(req.params.userId)},{"type": "trend"},{"_id": {$in : notificationsIds}},{"fromUserID" : ObjectId(req.params.userId), "type": "editGlyph"}]}]};
            }               
            Notifications.aggregate(

                // Pipeline
                [

                    // Stage 1
                    {
                        $project: {
                            "isSame": { "$cmp": [ "$fromUserID", "$toUserID" ] },
                            "isPublic" : 1,
                            "isDenied" : 1,
                            "fromUserID" : 1,
                            "toUserID" : 1,
                            "toMessage" : 1,
                            "fromMessage" : 1,
                            "fromUserImageUrl" : 1,
                            "toUserImageUrl" : 1,
                            "fromName" : 1,
                            "toName" : 1,
                            "type" : 1,
                            "createdAt" :{ $dateToString: { format: "%Y-%m-%d", date: '$createdAt' }} ,
                            "updatedAt" : 1,
                            "glyphImageUrl" : 1,
                            "glyphType" : 1,
                            "isFromReverseFollowing" : 1,
                            "isToReverseFollowing" : 1,
                            "isFromAcceptedFollowRequest" : 1,
                            "isToAcceptedFollowRequest" : 1, 

                        }
                    },

                    // Stage 2
                    {
                        $match: query
                    },

                    // Stage 3
                    {
                        $group: {
                            _id:{createdAt:'$createdAt'},
                            info:{$addToSet:{_id:'$_id',fromName:'$fromName',toName:'$toName',isPublic:'$isPublic'
                            ,isDenied:'$isDenied',fromUserID:'$fromUserID',toUserID:'$toUserID',toMessage:'$toMessage'
                            ,fromMessage:'$fromMessage',fromUserImageUrl:'$fromUserImageUrl',toUserImageUrl:'$toUserImageUrl',
                            updatedAt:'$updatedAt',type:'$type',glyphImageUrl:'$glyphImageUrl',glyphType: '$glyphType',isFromReverseFollowing: '$isFromReverseFollowing',isToReverseFollowing: '$isToReverseFollowing',isFromAcceptedFollowRequest:'$isFromAcceptedFollowRequest',isToAcceptedFollowRequest:'$isToAcceptedFollowRequest' }}
                        }
                    },

                // Stage 4
                {
                    $sort: {
                        '_id.createdAt':-1
                    }
                },

                // Stage 5
                {
                    $unwind: {
                        path : "$info",
                    }
                },

                // Stage 6
                {
                    $sort: {
                        "info.updatedAt": -1
                    }
                },

                // Stage 7
                {
                    $group: {
                        _id:{createdAt:"$_id.createdAt"},
                        doc: { "$push" : "$info"}
                    }
                },

                // Stage 8
                {
                    $sort: {
                        "_id.createdAt":-1
                    }
                },

                // Stage 9
                {
                    $project: {
                        createdAt:'$_id.createdAt',
                        info:'$doc',
                        _id:0
                    }
                },

                ], function(err, notifications) {
                    if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
                    if(!notifications) { res.status(404).json({status: 0, message: "Notifications not found",data: [] }); return false;}
                    res.status(200).json({status: 1, message: "Notifications found successfully", data: { notifications:notifications }});
                    return false;
                }
                );
        }).catch((e)=>{console.log(e);});
}).catch((e)=>{console.log(e);});
}

function getFolloweeNotificationIds(id){
    return new Promise((resolve, reject) => {
        Follow.find({'followerId':id,'isValid':true},function(fe,fd){
            if(!(fd.length > 0)){ return resolve([]);}
            var notiIds = [];
            var cntFd = 0;
            fd.map(function(obj) {
                Notifications.find().and(
                    [{"fromUserID": obj.followeeId,"createdAt": {$gt: obj.updatedAt}},{ $or: [{"type": "newGlyph"}, {"type": "editGlyph"}] }]).exec(function(ne,nd){
                        cntNd = 0;
                        if(nd.length > 0){
                            nd.map(function(o){
                                cntNd = cntNd + 1;
                                notiIds.push(o._id);
                                if(cntNd >= nd.length){
                                    cntFd = cntFd + 1;
                                    if(cntFd >= fd.length){
                                        return resolve(notiIds);
                                    }
                                }   
                            })
                        }
                        else
                        {
                            cntFd = cntFd + 1;
                            if(cntFd >= fd.length){
                                return resolve(notiIds);
                            }
                        }                
                    })
                })
        })
    })
}

function getFollowingNotificationIds(id){
    return new Promise((resolve, reject) => {
        var notifications = [];
        Notifications.find({"fromUserID":id,"type":"following"},function(ne,nd){
            if(!(nd.length > 0)){return resolve(notifications);}
            var notiIds = nd.map(function(obj) { return obj._id; })
            return resolve(notiIds);
        })
    })
}


/************************************
 PUSH NOTIFICATIONS CHANGE STATUS API
 ************************************/
 exports.changePushNotificationsStatus = function (req, res) {

    // Validating user id
    if(!req.params.userId) {
        res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data:[]});
        return false;
    }

    if(req.body.action == "active") {
        var updateObject = { $addToSet: { push_notifications: {"type": req.body.type, "category":req.body.category} } };
    } else {
        var updateObject = { $pull: { push_notifications: {"type": req.body.type, "category":req.body.category} } };
    }

    var requestCondition = { _id: ObjectId(req.params.userId) };

    User.findOneAndUpdate(requestCondition, updateObject, {new:true}, function(err, user) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}

        res.status(200).json({status: 1, message: "User push notifications status updated successfully", data: { user:user }});
        return false;

    });
}
exports.glyphNotifications = function(req,res){
 if(!req.params.userId) {
    res.status(400).json({status: 0, message: "Bad Request. Invalid User Id.",data:[]});
    return false;
}
var limit = parseInt(req.query.limit);
var offset = parseInt(req.query.offset);   
var pageSortQuery = {skip: offset, limit: limit };
getFollowingNotificationIds(req.params.userId).then((followingNotification) => {
    getFolloweeNotificationIds(req.params.userId).then((glyffNotification) => {
        pageSortQuery = pageSortQuery || {};
        console.log("just for testing",pageSortQuery)
        console.log("just for testing",Object.keys(pageSortQuery).length)
        var notificationsIds = followingNotification.concat(glyffNotification);
        var query = {$and:[{"toUserID" : ObjectId(req.params.userId)},{"isSame": {$ne: 0}}]};
        if(notificationsIds.length > 0){
            var query = {$and:[{"isSame": {$ne: 0}},
            {$or:[{"toUserID" : ObjectId(req.params.userId)},{"type": "trend"},{"_id": {$in : notificationsIds}}]}]};
        }           
        if(Object.keys(pageSortQuery).length == 0) {
          Notifications.aggregate(

                // Pipeline
                [
                
                    // Stage 1
                    {
                        $match: query
                    },
                     // Stage 2
                     {
                        $sort: {
                            'createdAt':-1
                        }
                    },
                    
                    // Stage 3
                    {
                        $project: {
                            "isSame": { "$cmp": [ "$fromUserID", "$toUserID" ] },
                            "isPublic" : 1,
                            "isDenied" : 1,
                            "fromUserID" : 1,
                            "toUserID" : 1,
                            "toMessage" : 1,
                            "fromMessage" : 1,
                            "fromUserImageUrl" : 1,
                            "toUserImageUrl" : 1,
                            "fromName" : 1,
                            "toName" : 1,
                            "type" : 1,
                            "createdAt" :{ $dateToString: { format: "%Y-%m-%d", date: '$createdAt' }} ,
                            "updatedAt" : 1,
                            "glyphImageUrl" : 1,
                            "glyphType" : 1,
                            "isFromReverseFollowing" : 1,
                            "isToReverseFollowing" : 1,
                            "isFromAcceptedFollowRequest" : 1,
                            "isToAcceptedFollowRequest" : 1, 

                        }
                    },



                    

                    ], function(err, notifications) {
                        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
                        if(!notifications) { res.status(404).json({status: 0, message: "Notifications not found",data: [] }); return false;}
                        res.status(200).json({status: 1, message: "Notifications found successfully", data: { notifications:notifications }});
                        return false;
                    }
                    );
      }   
      else{
          Notifications.aggregate(

                // Pipeline
                [
                
                    // Stage 1
                    {
                        $match: query
                    },
                     // Stage 2
                     {
                        $sort: {
                            'createdAt':-1
                        }
                    },
                    // Stage 3
                    {
                        $skip:pageSortQuery.skip
                    },

                    // Stage 4
                    {
                        $limit:pageSortQuery.limit
                    },
                    // Stage 5  
                    {
                        $project: {
                            "isSame": { "$cmp": [ "$fromUserID", "$toUserID" ] },
                            "isPublic" : 1,
                            "isDenied" : 1,
                            "fromUserID" : 1,
                            "toUserID" : 1,
                            "toMessage" : 1,
                            "fromMessage" : 1,
                            "fromUserImageUrl" : 1,
                            "toUserImageUrl" : 1,
                            "fromName" : 1,
                            "toName" : 1,
                            "type" : 1,
                            "createdAt" :{ $dateToString: { format: "%Y-%m-%d", date: '$createdAt' }} ,
                            "updatedAt" : 1,
                            "glyphImageUrl" : 1,
                            "glyphType" : 1,
                            "isFromReverseFollowing" : 1,
                            "isToReverseFollowing" : 1,
                            "isFromAcceptedFollowRequest" : 1,
                            "isToAcceptedFollowRequest" : 1, 

                        }
                    },



                    

                    ], function(err, notifications) {
                        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
                        if(!notifications) { res.status(404).json({status: 0, message: "Notifications not found",data: [] }); return false;}
                        res.status(200).json({status: 1, message: "Notifications found successfully", data: { notifications:notifications }});
                        return false;
                    }
                    );
      } 

  }).catch((e)=>{console.log(e);});
}).catch((e)=>{console.log(e);});
}
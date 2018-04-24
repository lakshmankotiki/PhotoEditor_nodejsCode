/**************************
 MODULE INITIALISATION
 **************************/
 var Glyff = require('../models/glyff.server.model');
 // var Glyffs = require('../models/glyff.server.model').Glyffs;
 var ObjectId = require('mongodb').ObjectID;
 var Follow = require('../models/users.server.model').follow;
 var ReportGlyffModel    = require('../models/report.server.model');
 var User = require('../models/users.server.model').user;

/**************************
 REPORT COUNT API
 **************************/
 exports.reportOfCount = function (req, res, next) {

    // Validating the fields
    if(!req.params.userId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    var queryCondition = {"creatorID": ObjectId(req.params.userId), "category": "new","isDeleted":false}
    var requestObject = {
        "queryCondition": queryCondition,
    }

    Glyff.countGlyphModel(requestObject, function (err, count) {
        console.log("3  count",count);
        if(err) { res.status(500).json({status: 0, message: err,data: [], code: 404 }); return false;}

        var countObject = { memes: count };

        // Glyff.countShareGlyphModel({"userId": ObjectId(req.params.userId)}, function (err, shareCount) {

           var queryUserObject = {"_id": ObjectId(req.params.userId), "userVerified": true}
           User.findOne(queryUserObject, {hash_password: 0}, function(err, user) {
            // console.log(user, "user")
            if(err) { res.status(500).json({status: 0, message: err,data: [], code: 404 }); return false;}
            if(user){
                countObject.shares = user.sharedCount;
            }
            // countObject.shares = shareCount;
            
            Glyff.countView(req.params.userId,function(err,count){

                if(err) { res.status(500).json({status: 0, message: err,data: [], code: 404 }); return false;}
                if(count.length){
                    countObject.views = count[0].total;    
                }
                else{
                   countObject.views = 0;   
               }

           })
            Follow.count({followeeId:ObjectId(req.params.userId), isValid: true},function(err, follower_count) {
                countObject.Followers = follower_count;

                res.status(200).json({status: 1, message: "Different counts found successfully", code: 200, data: { count: countObject} } );
                return false;
            });
        });
       });

}

/**************************
 BLOCK USER LIST API
 **************************/
 exports.reportGlyff = function (req, res, next) {

    // Validating the fields
    if(!req.body.userId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if(!req.body.glyphId) {
        res.status(400).json({status: 0, message: "Bad Request", data: [], code: 400});
        return false;
    }

    if (String(req.body.userId) == String(req.body.glyphId)) {
        res.status(400).json({status: 0, message: "Bad Request.", data: [], code: 400});
        return false;
    }

    var requestObject = {
        userId: ObjectId(req.body.userId),
        glyphId: ObjectId(req.body.glyphId)

    }

    // Calling model to insert data
    ReportGlyffModel.findReportGlyffModel(requestObject, function (err, reportGlyff) {
        if(err) { res.status(500).json({status: 0, message: err,data: [] }); return false;}
        if(reportGlyff.length) { res.status(400).json({status: 0, message: "Meme is already reported.",data: [] }); return false;}

        ReportGlyffModel.reportGlyffModel(requestObject, function(err, reportGlyff) {
            if(err) { res.status(500).json({status: 0, message: err, data: [] }); return false;}

            if(reportGlyff) {
                res.status(200).json({status: 1, message: "Meme is reported successfully"});
                return false;
            }
        });
    });

}
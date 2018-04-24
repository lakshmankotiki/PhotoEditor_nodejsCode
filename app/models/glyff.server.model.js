/**********************
 SCHEMA INITIALISTAION
 **********************/
 var Schema = require('mongoose').Schema;
 var Notifications = require('./notifications.server.model').notifications;
 var apn = require('apn');
 var Notification = require('../../configs/notification');
 var Follow = require('./users.server.model').follow;
 var User = require('../models/users.server.model').user;
 var reportglyff = require('./report.server.model').reportglyff;
 var ObjectId = require('mongodb').ObjectID;
/************
 GLYFF SCHEMA
 ************/
 var glyffSchema = new Schema({
    updatedAt:          {
        type: Date,
        default: Date.now
    },
    createdAt:          {
        type: Date,
        default: Date.now
    },
    glyffOriginal:      {type: String, default: ''},
    glyffCustomised:    {type: String, default: ''},
    glyffThumbnail:     {type: String, default: ''},
    type:               {type: String, default: ''},
    creatorID:          {type: Schema.Types.ObjectId, ref: 'users' },
    parentID:           {type: Schema.Types.ObjectId, ref: 'users' },
    parentGlyffId:      {type: Schema.Types.ObjectId, ref: 'glyffs' },
    creator:            {type: String, default: ''},
    category:           {type: String, default: ''},
    title:              {type: String, default: ''},
    sharedCount:        {type: Number, default: 0},
    trendingCount:      {type: Number, default: 0},
    popularity:         {type: Number, default: 0},
    trendingDirty:      Boolean,
    followerCount:      {type: Number, default: 0},
    followeeCount:      {type: Number, default: 0},
    isPublic:           Boolean,
    isTemplate:         {type: Number, default: 0},
    captionText:        {type: String, default: ''},
    isEditable:         {type: Boolean, default: true},
    editCount:          {type: Number, default: 0},
    viewCount:          {type: Number, default: 0},
    isDeleted:          {type: Boolean, default: false},
    glyffGif:           {type: String, default: ''}

    
});

 var glyff = mongoose.model('glyff', glyffSchema);
//  module.exports = {
//     Meme:glyff
// }
// module.exports = {
//     Glyffs:glyff
// }
/*********************
 FAVOURITES GLYPH SCHEMA
 *********************/
 var favouriteGlyphsSchema = new Schema({
    userId:   { type: Schema.Types.ObjectId, ref: 'users' },
    glyphId:   { type: Schema.Types.ObjectId, ref: 'glyffs' },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

 var favouriteGlyphs = mongoose.model('favouriteGlyphs', favouriteGlyphsSchema);


/*********************
 SHARE GLYPH SCHEMA
 *********************/
 var shareGlyphsSchema = new Schema({
    userId:   { type: Schema.Types.ObjectId, ref: 'users' },
    glyphId:   { type: Schema.Types.ObjectId, ref: 'glyffs' },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

 var shareGlyphs = mongoose.model('shareGlyphs', shareGlyphsSchema);
 var viewGlyphsSchema = new Schema({
    userId:   { type: Schema.Types.ObjectId, ref: 'users' },
    glyphId:   { type: Schema.Types.ObjectId, ref: 'glyffs' },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

 var viewGlyphs = mongoose.model('viewGlyphs', viewGlyphsSchema);

/**************
 EXPORT SCHEMA
 *************/
//  module.exports = {
//     glyff:      glyff
// }

exports.viewGlyphModel = function(data, callback) {

    var viewGlyp = new viewGlyphs(data);

    // API call to save glyff favourite
    viewGlyp.save(function(err, shareGlyph) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, shareGlyph)
        }
    });

}
/*****************
 SAVE GLYPH MODEL
 *****************/
 exports.saveGlyphModel = function(data, callback) {
    console.log("hello from saveGlyphModel")
    if(data.category == 'edit'){
        console.log("hello from edit")
        var parentID = data.parentID;
        var creatorID = data.creatorID;
        var glyffId = data.glyffId;
        console.log(glyffId, "glyffId")
        checkEditAccess(glyffId,creatorID,parentID).then((status) => {               
            if(status == 'Allow'){
                addGlyffData(data).then((updateStatus) => {
                    console.log("updateStatus",updateStatus);
                    updateStatus.save(function(err, glyph) {
                        if(err) {
                            callback(null, err)
                        } else {
                            callback(null, glyph)
                        }
                    });
                }).catch((e)=>{console.log(e);});
            }
            else if(status == 'Disallow'){
                callback(null, {message:'You are unable to update this Meme , As Meme is private and you must follow meme creator.',status:0})
            }
            else if(status == 'Error'){
                callback(null, {message:'Opps something went wrong',status:0})
            }
            else if(status == 'Report'){
                callback(null, {message:'This meme has been reported by you.',status:0})
            }
        }).catch((e)=>{console.log(e);});
    }
    else if(data.category == "new"){
        console.log("hello from new")
        addGlyffData(data).then((updateStatus) => {
            console.log("updateStatus",updateStatus);
            updateStatus.save(function(err, glyph) {
                if(err) {
                    callback(null, err)
                } else {
                    callback(null, glyph)
                }
            });
        }).catch((e)=>{console.log(e);});   
    }    
}

/*****************
 CHECK EDIT ACCESS OF USER TOWARDS GLYFF
 *****************/

 function checkEditAccess(id,cID,pID) {
    return new Promise((resolve, reject) => {
        console.log(id, "id", cID,"cID", pID, "pID")
        checkReportGlyffId(cID,id).then((status) => {
            if(!(status)) return resolve('Report');
            glyff.find({"_id":id},function(e,d){
                if(!(d.length > 0)) return resolve('Error');
                var data = d[0];
                if(pID.toString() != data.creatorID.toString()) return resolve('Error');
                if(data.isPublic && pID.toString() == data.parentID.toString()) return resolve('Allow');
                console.log("A");
                if(data.isPublic){
                    checkEditAccess(data.parentGlyffId,cID,data.parentID).then((status) => resolve(status));           
                }
                console.log("B");
                if(!data.isPublic){
                    console.log("C");
                    Follow.find({"followeeId":cID,"followerId":pID,"isValid":true},function(err,fdata){
                        if(!(fdata.length > 0)) return resolve('Disallow');
                        if(pID.toString() == data.parentID.toString()) return resolve('Allow');
                        console.log("D");
                        checkEditAccess(data.parentGlyffId,cID,data.parentID).then((status) => resolve(status));
                    })
                }
            });
        }).catch((e)=>{console.log(e);});
    });
}

/*****************
 SET GLYFF SAVE DATA OBJECT
 *****************/

 function addGlyffData(data){
    return new Promise((resolve, reject) => {
        var newGlyff = new glyff(data);

        var isEditable = (data.isEditable) ? data.isEditable : true;

        newGlyff.set('followeeCount', 0);
        newGlyff.set('sharedCount', 0);
        newGlyff.set('trendingCount', 0);
        newGlyff.set('followerCount', 0);
        newGlyff.set('glyffCount', 0);
        newGlyff.set('isPublic', true);
        newGlyff.set('isTemplate', 0);
        newGlyff.set('captionText', data.captionText);
        newGlyff.set('isEditable', isEditable);
        if(data.glyffId != undefined && data.glyffId != ''){
            newGlyff.set('parentGlyffId',data.glyffId);    
        }

        data.files.filter(function(ele) {
            if(ele.originalname && ele.location) {
                var nameImage = ele.originalname.split(".");
                newGlyff.set(nameImage[0], ele.location);
            }
        })
        console.log("newGlyff with gif:",newGlyff)
        return resolve(newGlyff);
    });
}

/*****************
 Fetch GLYPH MODEL
 *****************/
 exports.fetchGlyphModel = function(data, callback) {
    console.log("3");
    checkReportGlyff(data.userId).then((glyffIds) => {

        data.queryCondition = data.queryCondition || {};
        data.pageSortQuery = data.pageSortQuery || {};
        if(glyffIds.length > 0 && !data.flag){
            console.log("hello world",data.flag)
            data.queryCondition._id = {$nin : glyffIds};
        }
        if(Object.keys(data.pageSortQuery).length == 0) {
            // console.log("data without pagination")
            glyff.aggregate(

                // Pipeline
                [
                    // Stage 1
                    {
                        $match: data.queryCondition
                    },

                    // Stage 2
                    {
                        $lookup: {
                            "from" : "favouriteglyphs",
                            "localField" : "_id",
                            "foreignField" : "glyphId",
                            "as" : "favourite"
                        }
                    },

                    // Stage 3
                    {
                        $lookup: {
                            "from" : "blocks",
                            "localField" : "creatorID",
                            "foreignField" : "blockedId",
                            "as" : "block"
                        }
                    },

                    // Stage 4
                    {
                        $lookup: {
                            "from" : "users",
                            "localField" : "creatorID",
                            "foreignField" : "_id",
                            "as" : "user"
                        }
                    },

                    // Stage 5
                    {
                        $lookup: {
                            "from" : "users",
                            "localField" : "parentID",
                            "foreignField" : "_id",
                            "as" : "parentUser"
                        }
                    },
                    {
                        $lookup: {
                           "from" : "follows",
                           "localField" : "creatorID",
                           "foreignField" : "followeeId",
                           "as" : "checkFollower"
                       }
                   },

                    // Stage 6
                    {
                        $project: {
                            "_id" : 1,
                            "isPublic" : 1,
                            "creatorID" : 1,
                            "parentID" : 1,
                            "isEditable" : 1,
                            "captionText" : 1,
                            "isTemplate" : 1,
                            "followeeCount" : 1,
                            "followerCount" : 1,
                            "popularity" : 1,
                            "trendingCount" : 1,
                            "sharedCount" : 1,
                            "title" : 1,
                            "creator" : 1,
                            "type" : 1,
                            "glyffThumbnail" : 1,
                            "glyffCustomised" : 1,
                            "glyffOriginal" : 1,
                            "createdAt" : 1,
                            "updatedAt" : 1,
                            "editCount" : 1,
                            "viewCount" : 1,
                            "favouriteCount": { "$size": "$favourite" },
                            "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                            "block" : { $arrayElemAt: [ "$block", 0 ] },
                            "user" : { $arrayElemAt: [ "$user", 0 ] },
                            "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] },
                            "isFollow": {
                                $cond: {
                                    if: {
                                      $and:[{
                                        $eq: [{
                                            $arrayElemAt: ["$checkFollower.followeeId", 0]
                                        }, "$creatorID"]},{$eq: [{
                                            $arrayElemAt: ["$checkFollower.followerId", 0]
                                        }, data.userId]}]
                                    },
                                    then: true,
                                    else: false
                                }
                        }
                    }
                },
                    // Stage 5
                    {
                        $match: {"block.blockedById": {$nin: [data.userId]}}
                    },

                    ], function(err, glyffs) {
                        if(err) {
                            callback(null, err)
                        } else {
                            callback(null, glyffs)
                        }
                    });
} else {
            // console.log("data with pagination")
            glyff.aggregate(

                // Pipeline
                [
                    // Stage 1
                    {
                        $match: data.queryCondition
                    },

                    // Stage 2
                    {
                        $lookup: {
                            "from" : "favouriteglyphs",
                            "localField" : "_id",
                            "foreignField" : "glyphId",
                            "as" : "favourite"
                        }
                    },

                    // Stage 3
                    {
                        $lookup: {
                            "from" : "blocks",
                            "localField" : "creatorID",
                            "foreignField" : "blockedId",
                            "as" : "block"
                        }
                    },

                    // Stage 4
                    {
                        $lookup: {
                            "from" : "users",
                            "localField" : "creatorID",
                            "foreignField" : "_id",
                            "as" : "user"
                        }
                    },

                    // Stage 5
                    {
                        $lookup: {
                            "from" : "users",
                            "localField" : "parentID",
                            "foreignField" : "_id",
                            "as" : "parentUser"
                        }
                    },

                    // Stage 6
                    {
                        $sort: data.pageSortQuery.sort
                    },

                    // Stage 7
                    {
                        $skip: data.pageSortQuery.skip
                    },

                    // Stage 8
                    {
                        $limit: data.pageSortQuery.limit
                    },

                    // Stage 9
                    {
                        $project: {
                            "_id" : 1,
                            "isPublic" : 1,
                            "creatorID" : 1,
                            "parentID" : 1,
                            "isEditable" : 1,
                            "captionText" : 1,
                            "isTemplate" : 1,
                            "followeeCount" : 1,
                            "followerCount" : 1,
                            "popularity" : 1,
                            "trendingCount" : 1,
                            "sharedCount" : 1,
                            "title" : 1,
                            "creator" : 1,
                            "type" : 1,
                            "glyffThumbnail" : 1,
                            "glyffCustomised" : 1,
                            "glyffOriginal" : 1,
                            "createdAt" : 1,
                            "updatedAt" : 1,
                            "editCount" : 1,
                            "viewCount" : 1,
                            "favouriteCount": { "$size": "$favourite" },
                            "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                            "block" : { $arrayElemAt: [ "$block", 0 ] },
                            "user" : { $arrayElemAt: [ "$user", 0 ] },
                            "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                        }
                    },

                    // Stage 10
                    {
                        $match: {"block.blockedById": {$nin: [data.userId]}}
                    },

                    ], function(err, glyffs) {
                        if(err) {
                            callback(null, err)
                        } else {
                        // console.log("glyffs", glyffs)
                        callback(null, glyffs)
                    }
                });
        }
    }).catch((e)=>{console.log(e);});
}

/*****************
 Fetch ALL GLYPH MODEL
 *****************/
 
 exports.fetchAllGlyphModel = function(data, callback){
    console.log("data userr id",data.userId)
    isFollow(data.userId,data.currentUserId).then((status) => {
        console.log("status:",status)
        
        if(status == false && data.userId != data.currentUserId){
            callback(null, {message:"People is private , So you should follow him to see his glyff",status:'Unfollow'})
            return false;
        }
        checkReportGlyff(data.userId).then((glyffIds) => {
            data.queryCondition = data.queryCondition || {};
            data.pageSortQuery = data.pageSortQuery || {};
            if(glyffIds.length > 0){
                data.queryCondition._id = {$nin : glyffIds};
            }
            console.log("fetch all glyph model",data.userId)
            if(Object.keys(data.pageSortQuery).length == 0) {
                // console.log("data without pagination")
                glyff.aggregate(

                    // Pipeline
                    [
                        // Stage 1
                        {
                            $match: data.queryCondition
                        },

                        // Stage 2
                        {
                            $lookup: {
                                "from" : "favouriteglyphs",
                                "localField" : "_id",
                                "foreignField" : "glyphId",
                                "as" : "favourite"
                            }
                        },

                        // Stage 3
                        {
                            $lookup: {
                                "from" : "blocks",
                                "localField" : "creatorID",
                                "foreignField" : "blockedId",
                                "as" : "block"
                            }
                        },

                        // Stage 4
                        {
                            $lookup: {
                                "from" : "users",
                                "localField" : "creatorID",
                                "foreignField" : "_id",
                                "as" : "user"
                            }
                        },

                        // Stage 5
                        {
                            $lookup: {
                                "from" : "users",
                                "localField" : "parentID",
                                "foreignField" : "_id",
                                "as" : "parentUser"
                            }
                        },

                        // Stage 6
                        {
                            $project: {
                                "_id" : 1,
                                "isPublic" : 1,
                                "creatorID" : 1,
                                "parentID" : 1,
                                "isEditable" : 1,
                                "captionText" : 1,
                                "isTemplate" : 1,
                                "followeeCount" : 1,
                                "followerCount" : 1,
                                "popularity" : 1,
                                "trendingCount" : 1,
                                "sharedCount" : 1,
                                "title" : 1,
                                "creator" : 1,
                                "type" : 1,
                                "glyffThumbnail" : 1,
                                "glyffCustomised" : 1,
                                "glyffOriginal" : 1,
                                "createdAt" : 1,
                                "updatedAt" : 1,
                                "editCount" : 1,
                                "viewCount" : 1,
                                "favouriteCount": { "$size": "$favourite" },
                                "favourite":1,
                                "isFavourite" :   { $cond: { if:{
                                    $in: [ ObjectId(data.currentUserId), "$favourite.userId" ]},then:true,else:false
                                }},
                                "block" : { $arrayElemAt: [ "$block", 0 ] },
                                "user" : { $arrayElemAt: [ "$user", 0 ] },
                                "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] },
                                
                            }
                        },

                        // Stage 5
                        {
                            $match: {"block.blockedById": {$nin: [data.userId]}}
                        },

                        ], function(err, glyffs) {
                            console.log("glyffs:",glyffs)
                            if(err) {
                                callback(null, err)
                            } else {
                                callback(null, glyffs)
                            }
                        }
                        );
} else {
                // console.log("data with pagination")
                glyff.aggregate(

                    // Pipeline
                    [
                        // Stage 1
                        {
                            $match: data.queryCondition
                        },

                        // Stage 2
                        {
                            $lookup: {
                                "from" : "favouriteglyphs",
                                "localField" : "_id",
                                "foreignField" : "glyphId",
                                "as" : "favourite"
                            }
                        },

                        // Stage 3
                        {
                            $lookup: {
                                "from" : "blocks",
                                "localField" : "creatorID",
                                "foreignField" : "blockedId",
                                "as" : "block"
                            }
                        },

                        // Stage 4
                        {
                            $lookup: {
                                "from" : "users",
                                "localField" : "creatorID",
                                "foreignField" : "_id",
                                "as" : "user"
                            }
                        },

                        // Stage 5
                        {
                            $lookup: {
                                "from" : "users",
                                "localField" : "parentID",
                                "foreignField" : "_id",
                                "as" : "parentUser"
                            }
                        },

                        

                        // Stage 6
                        {
                            $sort: data.pageSortQuery.sort
                        },

                        // Stage 7
                        {
                            $skip: data.pageSortQuery.skip
                        },

                        // Stage 8
                        {
                            $limit: data.pageSortQuery.limit
                        },

                        // Stage 9
                        {
                            $project: {
                                "_id" : 1,
                                "isPublic" : 1,
                                "creatorID" : 1,
                                "parentID" : 1,
                                "isEditable" : 1,
                                "captionText" : 1,
                                "isTemplate" : 1,
                                "followeeCount" : 1,
                                "followerCount" : 1,
                                "popularity" : 1,
                                "trendingCount" : 1,
                                "sharedCount" : 1,
                                "title" : 1,
                                "creator" : 1,
                                "type" : 1,
                                "glyffThumbnail" : 1,
                                "glyffCustomised" : 1,
                                "glyffOriginal" : 1,
                                "createdAt" : 1,
                                "updatedAt" : 1,
                                "editCount" : 1,
                                "favourite":1,
                                "viewCount" : 1,
                                "favouriteCount": { "$size": "$favourite" },
                                "isFavourite" :   { $cond: { if:{
                                    $in: [ ObjectId(data.currentUserId), "$favourite.userId" ]},then:true,else:false
                                }},
                                "block" : { $arrayElemAt: [ "$block", 0 ] },
                                "user" : { $arrayElemAt: [ "$user", 0 ] },
                                "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] },

                            }
                        },

                        // Stage 10
                        {
                            $match: {"block.blockedById": {$nin: [data.userId]}}
                        },

                        ], function(err, glyffs) {
                            if(err) {
                                callback(null, err)
                            } else {
                            // console.log("glyffs", glyffs)
                            callback(null, glyffs)
                        }
                    });
}
}).catch((e)=>{console.log(e);});
}).catch((e)=>{console.log(e);});
}

/*****************
 CHECK USER IS FOLLOW OR NOT
 *****************/

 function isFollow(userId,currentUserId){

    return new Promise((resolve, reject) => {
        if(userId.equals(currentUserId)){

            return resolve(true)
        }
        User.find({"_id":userId,"isPublic":true, "userVerified": true},function(e,d){
            // User.find({"_id":userId,"userVerified": true},function(e,d){    
                if(d.length > 0){ return resolve(true)}
                    Follow.find({"followeeId":userId,"followerId":currentUserId,"isValid":true},function(err,fdata){
                        console.log("fdata:",fdata)
                        if(fdata.length > 0) return resolve(true);
                        return resolve(false);
                    })
            })
    })
}

/*****************
 CHECK ARE GLYFFS IS REPORTED BASE ON USER ID
 *****************/

 function checkReportGlyff(id){
    return new Promise((resolve, reject) => {
        reportglyff.find(
            {"userId":id,
            $or:[{'reportApprovedByAdmin':{$exists:false}},{"reportApprovedByAdmin":true}]}
            ,function(e,d){
                if(!(d.length > 0)) return resolve(false);
                var glyffIds = d.map(function(obj) { 
                    console.log("obj.glyphId:",obj.glyphId)
                    return obj.glyphId; 
                })
                return resolve(glyffIds);
            });
    })
}

/*****************
 CHECK WHICH GLYFFS IS DELETED
 *****************/

 function deletedGlyffIds(){
    return new Promise((resolve, reject) => {
        glyff.find({"isDeleted":true},function(e,d){
            var glyffIds = d.map(function(obj) { return obj.glyphId; })
            return resolve(glyffIds);
        });
    })
}

/*****************
 CHECK IS GLYFFS IS REPORTED BASE ON USER ID AND GLYFF ID
 *****************/

 function checkReportGlyffId(id,glyphId){
    return new Promise((resolve, reject) => {
        reportglyff.find({"userId":id,"glyphId":glyphId},function(e,d){
            if(!(d.length > 0)) return resolve(true);
            return resolve(false);
        });
    })
}

/*****************
 COUNT GLYPH MODEL
 *****************/
 exports.countGlyphModel = function(data, callback) {
    console.log("2  data",data);
    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};
        if(glyffIds && glyffIds.length > 0){
            data.queryCondition._id = {$nin : glyffIds};
        }
        glyff.count(data.queryCondition, function(err, count) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, count)
            }

        });
    }).catch((e)=>{console.log(e);});

}

/*****************
 UPDATE GLYPH MODEL
 *****************/
 exports.updateGlyphModel = function(data, callback) {

    console.log(data, "datataaaaaaaaaaaaaaaaaaaa")

    glyff.findByIdAndUpdate(data.glyphId, {$set: data.setObject}, { new: true }, function (err, glyph) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, glyph)
        }
    });
}

/*****************
 AGGREGRATION GLYPH MODEL
 *****************/
 exports.aggregrationFetchGlyphModel = function(data, callback) {
    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};

        if(glyffIds.length > 0){
            data.queryCondition._id = {$nin : glyffIds};
        }
        console.log(data.queryCondition,"queryCondition");
        glyff.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: data.queryCondition
                },

                // Stage 1
                {
                    $sort: {
                        createdAt: -1
                    }
                },

                // Stage 2
                {
                    $skip: data.pageSortQuery.skip
                },

                // Stage 3
                {
                    $limit: data.pageSortQuery.limit
                },

                // Stage 4
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 5
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "_id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },

                // Stage 6
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "creatorID",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 7
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 8
                {
                    $project: {
                        "_id" : 1,
                        "isPublic" : 1,
                        "creatorID" : 1,
                        "parentID" : 1,
                        "isEditable" : 1,
                        "captionText" : 1,
                        "isTemplate" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "popularity" : 1,
                        "trendingCount" : 1,
                        "sharedCount" : 1,
                        "title" : 1,
                        "creator" : 1,
                        "type" : 1,
                        "glyffThumbnail" : 1,
                        "glyffCustomised" : 1,
                        "glyffOriginal" : 1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "editCount" : 1,
                        "viewCount" : 1,
                        "favouriteCount": { "$size": "$favourite" },
                        "user": { $arrayElemAt: [ "$user", 0 ] },
                        "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                        "block" : { $arrayElemAt: [ "$block", 0 ] },
                        "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                // Stage 8
                {
                    $match: {"block.blockedById": {$nin: [data.userId]}}
                },

                ], function(err, glyphs) {
                    if(err) {
                        callback(null, err)
                    } else {
                        callback(null, glyphs)
                    }

                }
                );
    }).catch((e)=>{console.log(e);});
}

/*****************
 SAVE FAVOURITE GLYPHS MODEL
 *****************/
 exports.saveGlyphFavouriteModel = function(data, callback) {

    var favouriteGlyph = new favouriteGlyphs(data);

    // API call to save glyff favourite
    favouriteGlyph.save(function(err, glyphFavourite) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, glyphFavourite)
        }
    });

}

/*****************
 REMOVE FAVOURITE GLYPHS MODEL
 *****************/
 exports.removeFavouriteGlyff = function(data, callback) {

    favouriteGlyphs.remove({ userId: data.userId, glyphId: data.glyphId }, function(err) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, true)
        }
    });

}

/*****************
 FIND FAVOURITE GLYPHS MODEL
 *****************/
 exports.findGlyphFavouriteModel = function(data, callback) {
    checkReportGlyffId(data.userId,data.glyphId).then((status) => {
        if(!(status)){callback(null, {message:'Meme has been reported.',status:'Report'}); return false;}
        favouriteGlyphs.find({userId: data.userId, glyphId: data.glyphId}, function(err, glyphFavourite) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, glyphFavourite)
            }
        });
    }).catch((e)=>{console.log(e);});

}

/*****************
 AGGREGRATION Favourite GLYPH MODEL
 *****************/
 exports.getFavouriteCountOfParticularUser = function(data,callback){
    favouriteGlyphs.aggregate(


        [
        
        {
            $match: {
                userId:ObjectId(data)
            }
        },

        
        {
            $count: "count"
        },

        ],function(err, glyphs) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, glyphs)
            }

        }



        );

}
exports.aggregrationFetchFavouriteGlyphModel = function(data, callback) {
    checkReportGlyff(data.queryCondition.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};
        data.queryCondition.captionText = (data.queryCondition.captionText != "" ) ? { "glyff.captionText": data.queryCondition.captionText } : {};
        var matchQuery = {userId:data.queryCondition.userId};
        if(glyffIds.length > 0){matchQuery.glyphId = {$nin : glyffIds};}

        console.log("matchQuery",matchQuery);
        favouriteGlyphs.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: matchQuery
                },


                // Stage 2
                {
                    $lookup: {
                        "from" : "glyffs",
                        "localField" : "glyphId",
                        "foreignField" : "_id",
                        "as" : "glyff"
                    }
                },

                // Stage 3
                {
                    $unwind: {
                        path : "$glyff",
                    }
                },
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "glyff._id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },
                // Stage 4
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "glyff.creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 5
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "glyff.parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 6
                {
                    $match: data.queryCondition.captionText
                },

                // Stage 7
                {
                    $sort: {
                        createdAt: -1
                    }
                },

                // Stage 8
                {
                    $skip: data.pageSortQuery.skip
                },

                // Stage 9
                {
                    $limit: data.pageSortQuery.limit
                },

                // Stage 10
                {
                    // $project: {
                    //     "_id" : 1,
                    //     "userId" : 1,
                    //     "glyphId" : 1,
                    //     "createdAt" : 1,
                    //     "glyff": {"_id": 1,"isPublic": 1,"parentID": 1,"creatorID": 1, "isDeleted": 1,"viewCount": 1,
                    //         "editCount": 1,"isEditable": 1,"captionText": 1,"isTemplate": 1,"followeeCount": 1
                    //         ,"followerCount": 1,"popularity": 1,"trendingCount": 1
                    //         ,"sharedCount": 1,"title": 1,"category": 1,"creator": 1
                    //         ,"type": 1,"glyffThumbnail": 1,"glyffCustomised": 1,"glyffOriginal": 1
                    //         ,"createdAt": 1,"updatedAt": 1,"isFavourite": { $cond: { if: { $eq: ["$userId", data.queryCondition.userId] }, then: true, else: false } }},
                    //     // "isFavourite" : { $cond: { if: { $eq: ["$userId", data.queryCondition.userId] }, then: true, else: false } },
                    //     "user": { $arrayElemAt: [ "$user", 0 ] },
                    //     "parentUser": { $arrayElemAt: [ "$parentUser", 0 ] }
                    // }
                    $project: {
                        "_id" : "$glyff._id",
                        "isPublic": "$glyff.isPublic",
                        "parentID": "$glyff.parentID",
                        "creatorID": "$glyff.creatorID",
                        "isDeleted": "$glyff.isDeleted",
                        "viewCount": "$glyff.viewCount",
                        "editCount": "$glyff.editCount",
                        "isEditable": "$glyff.isEditable",
                        "captionText": "$glyff.captionText",
                        "isTemplate": "$glyff.isTemplate",
                        "followeeCount": "$glyff.followeeCount",
                        "followerCount": "$glyff.followerCount",
                        "popularity": "$glyff.popularity",
                        "trendingCount": "$glyff.trendingCount",
                        "sharedCount": "$glyff.sharedCount",
                        "title": "$glyff.title",
                        "category": "$glyff.category",
                        "creator": "$glyff.creator",
                        "type": "$glyff.type",
                        "glyffThumbnail": "$glyff.glyffThumbnail",
                        "glyffCustomised": "$glyff.glyffCustomised",
                        "glyffOriginal": "$glyff.glyffOriginal",
                        "createdAt": "$glyff.createdAt",
                        "updatedAt": "$glyff.updatedAt",
                        "favouriteCount": { "$size": "$favourite" },
                        "isFavourite": { $cond: { if: { $eq: ["$userId", data.queryCondition.userId] }, then: true, else: false } },
                        "user": { $arrayElemAt: [ "$user", 0 ] },
                        "parentUser": { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                ], function(err, glyphs) {
                    if(err) {
                        callback(null, err)
                    } else {
                        callback(null, glyphs)
                    }

                }
                );
}).catch((e)=>{console.log(e);});
}

/*****************
 COUNT Favourite GLYPH MODEL
 *****************/
 exports.countFavouriteGlyphModel = function(data, callback) {
    checkReportGlyff(data.queryCondition.userId).then((glyffIds) => {
        var query = {userId:data.queryCondition.userId};
        if(glyffIds.length > 0){query.glyphId = {$nin : glyffIds};}
        favouriteGlyphs.count(query, function(err, count) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, count)
            }
        });
    }).catch((e)=>{console.log(e);});
}

/*****************
 COUNT Share GLYPH MODEL
 *****************/
 exports.countShareGlyphModel = function(data, callback) {
    checkReportGlyff(data.userId).then((glyffIds) => {
        var query = {userId:data.userId};
        if(glyffIds.length > 0){query.glyphId = {$nin : glyffIds};}
        shareGlyphs.count(query, function(err, shareCount) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, shareCount)
            }
        });
    }).catch((e)=>{console.log(e);});
}

/*****************
 SHARE GLYPHS MODEL
 *****************/
 exports.shareGlyphModel = function(data, callback) {

    var shareGlyph = new shareGlyphs(data);

    // API call to save glyff favourite
    shareGlyph.save(function(err, shareGlyph) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, shareGlyph)
        }
    });

}

/*****************
 NOTIFICATIONS MODEL
 *****************/
 exports.notificationModel = function(data, callback) {
    console.log("i am in notificationModel-1",data)
    var newNotification = new Notifications();

    newNotification.set('toUserID', data.toUserID);
    newNotification.set('fromUserID', data.fromUserID);
    newNotification.set('fromMessage', data.fromMessage);
    newNotification.set('toMessage', data.toMessage);
    newNotification.set('type', data.type);
    newNotification.set('toUserImageUrl', data.toUserImageUrl);
    newNotification.set('fromUserImageUrl', data.fromUserImageUrl);
    newNotification.set('glyphImageUrl', data.glyphImageUrl);
    newNotification.set('isPublic', data.isPublic);
    newNotification.set('toName', data.toName);
    newNotification.set('fromName', data.fromName);
    newNotification.set('glyphType', data.glyphType);

    newNotification.save(function(err, notification) {
        console.log("save or not")
        if(err) {
            callback(null, err)
        } else {
            console.log("lets see ",notification)
            callback(null, notification)
        }
    })

}

/*****************
 PUSH NOTIFICATIONS MODEL
 *****************/
 exports.pushNotificationModel = function(data, callback) {
    console.log("i am in push notification",data)
    var fromUserImageUrl = data.fromUserImageUrl || '';
    Notification.pushNotification({"type": data.type,"fromUserImageUrl":fromUserImageUrl,"glyphType": data.glyphType, "glyphThumbnail": data.imageUrl , "device_token": data.device_token, "message": data.message, "name": data.name}, function(err, pushNotification) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, pushNotification)
        }
    })

}

/*****************
 FETCH FOLLOWEES MODEL
 *****************/
 exports.fetchFolloweesModel = function(data, callback) {

    Follow.aggregate(

        // Pipeline
        [
            // Stage 1
            {
                $match: {
                    "followeeId": data.followeeId,
                    "isValid": true
                }
            },

            // Stage 2
            {
                $lookup: {
                    "from" : "users",
                    "localField" : "followerId",
                    "foreignField" : "_id",
                    "as" : "user"
                }
            },

            // Stage 3
            {
                $match: {
                    user: {
                        $elemMatch: {
                            push_notifications: {
                                $elemMatch: data.push_notification
                            }
                        }
                    }
                }
            },

            // Stage 4
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

            ], function(err, followers) {

                if(err) {
                    callback(null, err)
                } else {
                    callback(null, followers)
                }

            });

}
exports.fetchAllGlifModel = function(userID,callback){
    console.log("userID:",userID)
    var matchQuery;
    if(userID){
        matchQuery = { creatorID:ObjectId(userID),isDeleted:false}
    }
    else{
       matchQuery = {  isDeleted:false } 
   }

   glyff.aggregate(

    // Pipeline
    [
        // Stage 1
        {
            $match:matchQuery
        },

        {
            $lookup: {
                "from" : "reportglyffs",
                "localField" : "_id",
                "foreignField" : "glyphId",
                "as" : "report"
            }
        },

        // Stage 3
        {
            $lookup: {
               "from" : "favouriteglyphs",
               "localField" : "_id",
               "foreignField" : "glyphId",
               "as" : "favourites"
           }
       },

        // Stage 4
        {
            $lookup: {
                "from" : "users",
                "localField" : "creatorID",
                "foreignField" : "_id",
                "as" : "creatorDetail"
            }
        },

        // Stage 5
        {
            $lookup: {
               "from" : "users",
               "localField" : "parentID",
               "foreignField" : "_id",
               "as" : "originatorDetail"
           }
       },

        // Stage 6
        {
            $unwind: {
                path : "$report",
                preserveNullAndEmptyArrays : true // optional
            }
        },

        // Stage 7
        {
            $match: {
              $or:[{"report.reportApprovedByAdmin" : false},{'report.reportApprovedByAdmin':{$exists:false}}]

          }
      },

        // Stage 8
        {
            $group: {
               _id:"$_id",
               report:{$addToSet:'$report'},
               doc:{$first:'$$ROOT'}
           }
       },

        // Stage 9
        {
            $project: {
               report:1,
               "isPublic" : '$doc.isPublic' ,
               "parentID" : '$doc.parentID' ,
               "creatorID" :'$doc.creatorID' ,
               "glyffGif" : '$doc.glyffGif', 
               "isDeleted" : '$doc.isDeleted',
               "viewCount" : '$doc.viewCount', 
               "editCount" :'$doc.editCount', 
               "isEditable" : '$doc.isEditable', 
               "captionText" :'$doc.captionText',
               "isTemplate" : '$doc.isTemplate',
               "followeeCount" : '$doc.followeeCount', 
               "followerCount" : '$doc.followerCount', 
               "popularity" : '$doc.popularity', 
               "trendingCount" : '$doc.trendingCount', 
               "sharedCount" :'$doc.sharedCount', 
               "title" : '$doc.title', 
               "category" : '$doc.category', 
               "creator" :'$doc.creator',
               "type" : '$doc.type', 
               "glyffThumbnail" : '$doc.glyffThumbnail',
               "glyffCustomised" : '$doc.glyffCustomised',
               "glyffOriginal" : '$doc.glyffOriginal',
               "createdAt" : '$doc.createdAt',
               "updatedAt" : '$doc.updatedAt',
               favouritesCount: { "$size": "$doc.favourites" },
               creatorname:{$arrayElemAt:['$doc.creatorDetail.name',0]},
               originatorname:{$arrayElemAt:['$doc.originatorDetail.name',0]},
               "isReported" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$report.glyphId", 0 ] }, "$_id"] }, then: "Yes", else: "No" } }

           }
       },
       {
        $sort: {
            trendingCount :-1,
            createdAt : -1,

        }
    }

    ],function(err, followers) {

        if(err) {
            callback(null, err)
        } else {
            console.log("followers:",followers)
            callback(null, followers)
        }

    });

    // Created with Studio 3T, the IDE for MongoDB - https://studio3t.com/



    // glyff.aggregate(

    // // Pipeline
    // [   
    // {
    //     $match: {
    //         isDeleted:false 
    //     }
    // },
    //     // Stage 1
    //     {
    //         $lookup: {
    //             "from" : "favouriteglyphs",
    //             "localField" : "_id",
    //             "foreignField" : "glyphId",
    //             "as" : "favourites"
    //         }
    //     },

    //     // Stage 2
    //     {
    //         $lookup: {
    //             "from" : "users",
    //             "localField" : "creatorID",
    //             "foreignField" : "_id",
    //             "as" : "creatorDetail"
    //         }
    //     },
    //     {
    //         $lookup: {
    //             "from" : "reportglyffs",
    //             "localField" : "_id",
    //             "foreignField" : "glyphId",
    //             "as" : "repotstatus"
    //         }
    //     },

    //     // Stage 3
    //     {
    //         $lookup: {
    //          "from" : "users",
    //          "localField" : "parentID",
    //          "foreignField" : "_id",
    //          "as" : "originatorDetail"
    //      }
    //  },

    //     // Stage 5
    //     {
    //         $unwind: {
    //             path : "$creatorDetail",
    //             preserveNullAndEmptyArrays : true 
    //         }
    //     },

    //     // Stage 6
    //     {
    //         $unwind: {
    //             path : "$originatorDetail",
    //             preserveNullAndEmptyArrays : true 
    //         }
    //     },

    //     // Stage 7
    //     {
    //         $project: {
    //             "isPublic" : 1, 
    //             "parentID" : 1, 
    //             "creatorID" :1, 
    //             "isDeleted" : 1, 
    //             "viewCount" : 1, 
    //             "editCount" : 1, 
    //             "isEditable" : 1, 
    //             "captionText" : 1, 
    //             "isTemplate" : 1, 
    //             "followeeCount" : 1, 
    //             "followerCount" : 1, 
    //             "popularity" : 1, 
    //             "trendingCount" : 1, 
    //             "sharedCount" : 1, 
    //             "title" : 1, 
    //             "category" :1, 
    //             "creator" :1, 
    //             "type" : 1, 
    //             "glyffThumbnail" :1, 
    //             "glyffCustomised" : 1, 
    //             "glyffOriginal" : 1, 
    //             "createdAt" : 1, 
    //             "updatedAt" : 1,
    //             "favouritesCount": { "$size": "$favourites" },
    //             "creatorname":"$creatorDetail.name",
    //             "originatorname":"$originatorDetail.name",
    //             "isReported" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$reportstatus.glyphId", 0 ] }, "$_id"] }, then: "Yes", else: "No" } }

    //         }
    //     },

    //     ], function(err, followers) {

    //         if(err) {
    //             callback(null, err)
    //         } else {
    //             callback(null, followers)
    //         }

    //     });
}
/*****************
 UPDATE GLYPH EDITCOUNT
 *****************/
 exports.updateGlyphEditCountModel = function(id, callback) {
    console.log("editCount",id);
    glyff.findByIdAndUpdate({"_id":id,"isDeleted":false},{$inc: { editCount: 1 }},function(e,d){
        if(e) {
            callback(null, e)
        }
        else{
            callback(null, d)
        } 
    });
}

/*****************
 UPDATE GLYPH VIEWCOUNT
 *****************/
 exports.updateGlyphViewCountModel = function(dataObj, callback) {
    glyff.find({'_id':dataObj.glyffId,'isDeleted':false},function(err,data){
        if(data.length > 0){
            console.log("dataObj  :",dataObj)
            var data1 = data[0].creatorID.toString();
            var data2 = dataObj.id.toString();
            if(data1 != data2){
                glyff.findByIdAndUpdate({"_id":dataObj.glyffId,"isDeleted":false},{$inc: { viewCount: 1,trendingCount: 1 }},function(e,d){
                    if(e) {
                        callback(null, e)
                    }
                    else{
                        callback(null, d)
                    } 
                });
            }
            else
            {
                callback(null,'');
            }
        }
        else
        {
            callback(null,'');
        }
    })
}


/*****************
 UPDATE GLYPH SHARECOUNT
 *****************/
 exports.updateGlyphShareCountModel = function(data, callback) {

    glyff.findByIdAndUpdate(data.id,{$set: {updatedAt:new Date()},$inc: { sharedCount: 1 , trendingCount: 1}},function(e,glyph){

        User.findByIdAndUpdate(glyph.creatorID,{$inc: { sharedCount: 1 , trendingCount: 1}},function(e,d){
            if(e) {
                callback(null, e)
            }
            else{
                callback(null, d)
            }
        });
    })
}

exports.aggregrationViewedRecentGlyphModel = function(data, callback){

    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};

        if(glyffIds.length > 0){
            data.reportGlyffIds = {"_id": {$nin : glyffIds}};
        } else {
            data.reportGlyffIds = {};
        }
        console.log(data.queryCondition,"queryCondition");


        viewGlyphs.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: {
                        "userId" : data.userId,
                        // "createdAt": { "$gte": data.start }
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
                    $lookup: {
                        "from" : "glyffs",
                        "localField" : "glyphId",
                        "foreignField" : "_id",
                        "as" : "glyphId"
                    }
                },

                // Stage 4
                {
                    $match: {
                        "glyphId": { $elemMatch: data.queryCondition }
                    }
                },

                // Stage 5
                {
                    $unwind: {
                        path : "$glyphId",
                    }
                },

                // Stage 6
                {
                    $project: {
                        "_id" : "$glyphId._id",
                        "isPublic" : "$glyphId.isPublic",
                        "creatorID" : "$glyphId.creatorID",
                        "parentID" : "$glyphId.parentID",
                        "viewCount" : "$glyphId.viewCount",
                        "editCount" : "$glyphId.editCount",
                        "isEditable" : "$glyphId.isEditable",
                        "captionText" : "$glyphId.captionText",
                        "isTemplate" : "$glyphId.isTemplate",
                        "followeeCount" : "$glyphId.followeeCount",
                        "followerCount" : "$glyphId.followerCount",
                        "popularity" : "$glyphId.popularity",
                        "trendingCount" : "$glyphId.trendingCount",
                        "sharedCount" : "$glyphId.sharedCount",
                        "title" : "$glyphId.title",
                        "category" : "$glyphId.category",
                        "creator" : "$glyphId.creator",
                        "type" : "$glyphId.type",
                        "glyffThumbnail" : "$glyphId.glyffThumbnail",
                        "glyffCustomised" : "$glyphId.glyffCustomised",
                        "glyffOriginal" : "$glyphId.glyffOriginal",
                        "createdAt" : "$glyphId.createdAt",
                        "updatedAt" : "$glyphId.updatedAt",
                        "sharedCreatedAt": "$createdAt",
                        "userId" : 1
                    }
                },

                // Stage 7
                {
                    $group: {
                        _id : {
                            "_id" : "$_id"},
                            info: { $addToSet : {
                                "userId" : "$userId",
                                "isPublic" : "$isPublic",
                                "creatorID" : "$creatorID",
                                "parentID" : "$parentID",
                                "viewCount" : "$viewCount",
                                "editCount" : "$editCount",
                                "isEditable" : "$isEditable",
                                "captionText" : "$captionText",
                                "isTemplate" : "$isTemplate",
                                "followeeCount" : "$followeeCount",
                                "followerCount" : "$followerCount",
                                "popularity" : "$popularity",
                                "trendingCount" : "$trendingCount",
                                "sharedCount" : "$sharedCount",
                                "title" : "$title",
                                "category" : "$category",
                                "creator" : "$creator",
                                "type" : "$type",
                                "glyffThumbnail" : "$glyffThumbnail",
                                "glyffCustomised" : "$glyffCustomised",
                                "glyffOriginal" : "$glyffOriginal",
                                "createdAt" : "$createdAt",
                                "updatedAt" : "$updatedAt",
                                "sharedCreatedAt" : "$sharedCreatedAt"
                            }}
                        }
                    },

                // Stage 8
                {
                    $sort: {
                        "info.sharedCreatedAt": -1
                    }
                },

                // Stage 9
                {
                    $project: {
                        _id: "$_id._id",
                        isPublic : {$arrayElemAt: ["$info.isPublic", 0]},
                        creatorID : {$arrayElemAt: ["$info.creatorID", 0]},
                        parentID : {$arrayElemAt: ["$info.parentID", 0]},
                        viewCount : {$arrayElemAt: ["$info.viewCount", 0]},
                        editCount : {$arrayElemAt: ["$info.editCount", 0]},
                        isEditable : {$arrayElemAt: ["$info.isEditable", 0]},
                        captionText : {$arrayElemAt: ["$info.captionText", 0]},
                        isTemplate : {$arrayElemAt: ["$info.isTemplate", 0]},
                        followeeCount : {$arrayElemAt: ["$info.followeeCount", 0]},
                        followerCount : {$arrayElemAt: ["$info.followerCount", 0]},
                        popularity : {$arrayElemAt: ["$info.popularity", 0]},
                        trendingCount : {$arrayElemAt: ["$info.trendingCount", 0]},
                        sharedCount : {$arrayElemAt: ["$info.sharedCount", 0]},
                        title : {$arrayElemAt: ["$info.title", 0]},
                        category : {$arrayElemAt: ["$info.category", 0]},
                        creator : {$arrayElemAt: ["$info.creator", 0]},
                        type : {$arrayElemAt: ["$info.type", 0]},
                        glyffThumbnail : {$arrayElemAt: ["$info.glyffThumbnail", 0]},
                        glyffCustomised : {$arrayElemAt: ["$info.glyffCustomised", 0]},
                        glyffOriginal : {$arrayElemAt: ["$info.glyffOriginal", 0]},
                        createdAt : {$arrayElemAt: ["$info.createdAt", 0]},
                        updatedAt : {$arrayElemAt: ["$info.updatedAt", 0]},
                        sharedCreatedAt: {$arrayElemAt: ["$info.sharedCreatedAt", 0]},
                        userId : {$arrayElemAt: ["$info.userId", 0]}
                    }
                },

                // Stage 10
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "_id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },

                // Stage 11
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "creatorID",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 12
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 13
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 14
                {
                    $project: {
                        "_id" : 1,
                        "isPublic" : 1,
                        "creatorID" : 1,
                        "parentID" : 1,
                        "viewCount" : 1,
                        "editCount" : 1,
                        "isEditable" : 1,
                        "captionText" : 1,
                        "isTemplate" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "popularity" : 1,
                        "trendingCount" : 1,
                        "sharedCount" : 1,
                        "title" : 1,
                        "category" : 1,
                        "creator" : 1,
                        "type" : 1,
                        "glyffThumbnail" : 1,
                        "glyffCustomised" : 1,
                        "glyffOriginal" : 1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "sharedCreatedAt" : 1,
                        "userId" : 1,
                        "favouriteCount": { "$size": "$favourite" },
                        "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                        "block" : { $arrayElemAt: [ "$block", 0 ] },
                        "user" : { $arrayElemAt: [ "$user", 0 ] },
                        "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                // Stage 15
                {
                    $match: {"block.blockedById": {$nin: [data.userId]}}
                },

                // Stage 16
                {
                    $match: data.reportGlyffIds
                },

                ], function(err, glyphs) {
                    if(err) {
                        callback(null, err)
                    } else {
                        callback(null, glyphs)
                    }

                }

                );

}).catch((e)=>{console.log(e);});
}

/*****************
 AGGREGRATION SHARED RECENT MODEL
 *****************/
 exports.aggregrationSharedRecentGlyphModel = function(data, callback) {
    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};

        if(glyffIds.length > 0){
            data.reportGlyffIds = {"_id": {$nin : glyffIds}};
        } else {
            data.reportGlyffIds = {};
        }
        console.log(data.queryCondition,"queryCondition");


        shareGlyphs.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: {
                        "userId" : data.userId,
                        // "createdAt": { "$gte": data.start }
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
                    $lookup: {
                        "from" : "glyffs",
                        "localField" : "glyphId",
                        "foreignField" : "_id",
                        "as" : "glyphId"
                    }
                },

                // Stage 4
                {
                    $match: {
                        "glyphId": { $elemMatch: data.queryCondition }
                    }
                },

                // Stage 5
                {
                    $unwind: {
                        path : "$glyphId",
                    }
                },

                // Stage 6
                {
                    $project: {
                        "_id" : "$glyphId._id",
                        "isPublic" : "$glyphId.isPublic",
                        "creatorID" : "$glyphId.creatorID",
                        "parentID" : "$glyphId.parentID",
                        "viewCount" : "$glyphId.viewCount",
                        "editCount" : "$glyphId.editCount",
                        "isEditable" : "$glyphId.isEditable",
                        "captionText" : "$glyphId.captionText",
                        "isTemplate" : "$glyphId.isTemplate",
                        "followeeCount" : "$glyphId.followeeCount",
                        "followerCount" : "$glyphId.followerCount",
                        "popularity" : "$glyphId.popularity",
                        "trendingCount" : "$glyphId.trendingCount",
                        "sharedCount" : "$glyphId.sharedCount",
                        "title" : "$glyphId.title",
                        "category" : "$glyphId.category",
                        "creator" : "$glyphId.creator",
                        "type" : "$glyphId.type",
                        "glyffThumbnail" : "$glyphId.glyffThumbnail",
                        "glyffCustomised" : "$glyphId.glyffCustomised",
                        "glyffOriginal" : "$glyphId.glyffOriginal",
                        "createdAt" : "$glyphId.createdAt",
                        "updatedAt" : "$glyphId.updatedAt",
                        "sharedCreatedAt": "$createdAt",
                        "userId" : 1
                    }
                },

                // Stage 7
                {
                    $group: {
                        _id : {
                            "_id" : "$_id"},
                            info: { $addToSet : {
                                "userId" : "$userId",
                                "isPublic" : "$isPublic",
                                "creatorID" : "$creatorID",
                                "parentID" : "$parentID",
                                "viewCount" : "$viewCount",
                                "editCount" : "$editCount",
                                "isEditable" : "$isEditable",
                                "captionText" : "$captionText",
                                "isTemplate" : "$isTemplate",
                                "followeeCount" : "$followeeCount",
                                "followerCount" : "$followerCount",
                                "popularity" : "$popularity",
                                "trendingCount" : "$trendingCount",
                                "sharedCount" : "$sharedCount",
                                "title" : "$title",
                                "category" : "$category",
                                "creator" : "$creator",
                                "type" : "$type",
                                "glyffThumbnail" : "$glyffThumbnail",
                                "glyffCustomised" : "$glyffCustomised",
                                "glyffOriginal" : "$glyffOriginal",
                                "createdAt" : "$createdAt",
                                "updatedAt" : "$updatedAt",
                                "sharedCreatedAt" : "$sharedCreatedAt"
                            }}
                        }
                    },

                // Stage 8
                {
                    $sort: {
                        "info.sharedCreatedAt": -1
                    }
                },

                // Stage 9
                {
                    $project: {
                        _id: "$_id._id",
                        isPublic : {$arrayElemAt: ["$info.isPublic", 0]},
                        creatorID : {$arrayElemAt: ["$info.creatorID", 0]},
                        parentID : {$arrayElemAt: ["$info.parentID", 0]},
                        viewCount : {$arrayElemAt: ["$info.viewCount", 0]},
                        editCount : {$arrayElemAt: ["$info.editCount", 0]},
                        isEditable : {$arrayElemAt: ["$info.isEditable", 0]},
                        captionText : {$arrayElemAt: ["$info.captionText", 0]},
                        isTemplate : {$arrayElemAt: ["$info.isTemplate", 0]},
                        followeeCount : {$arrayElemAt: ["$info.followeeCount", 0]},
                        followerCount : {$arrayElemAt: ["$info.followerCount", 0]},
                        popularity : {$arrayElemAt: ["$info.popularity", 0]},
                        trendingCount : {$arrayElemAt: ["$info.trendingCount", 0]},
                        sharedCount : {$arrayElemAt: ["$info.sharedCount", 0]},
                        title : {$arrayElemAt: ["$info.title", 0]},
                        category : {$arrayElemAt: ["$info.category", 0]},
                        creator : {$arrayElemAt: ["$info.creator", 0]},
                        type : {$arrayElemAt: ["$info.type", 0]},
                        glyffThumbnail : {$arrayElemAt: ["$info.glyffThumbnail", 0]},
                        glyffCustomised : {$arrayElemAt: ["$info.glyffCustomised", 0]},
                        glyffOriginal : {$arrayElemAt: ["$info.glyffOriginal", 0]},
                        createdAt : {$arrayElemAt: ["$info.createdAt", 0]},
                        updatedAt : {$arrayElemAt: ["$info.updatedAt", 0]},
                        sharedCreatedAt: {$arrayElemAt: ["$info.sharedCreatedAt", 0]},
                        userId : {$arrayElemAt: ["$info.userId", 0]}
                    }
                },

                // Stage 10
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "_id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },

                // Stage 11
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "creatorID",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 12
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 13
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 14
                {
                    $project: {
                        "_id" : 1,
                        "isPublic" : 1,
                        "creatorID" : 1,
                        "parentID" : 1,
                        "viewCount" : 1,
                        "editCount" : 1,
                        "isEditable" : 1,
                        "captionText" : 1,
                        "isTemplate" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "popularity" : 1,
                        "trendingCount" : 1,
                        "sharedCount" : 1,
                        "title" : 1,
                        "category" : 1,
                        "creator" : 1,
                        "type" : 1,
                        "glyffThumbnail" : 1,
                        "glyffCustomised" : 1,
                        "glyffOriginal" : 1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "sharedCreatedAt" : 1,
                        "userId" : 1,
                        "favouriteCount": { "$size": "$favourite" },
                        "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                        "block" : { $arrayElemAt: [ "$block", 0 ] },
                        "user" : { $arrayElemAt: [ "$user", 0 ] },
                        "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                // Stage 15
                {
                    $match: {"block.blockedById": {$nin: [data.userId]}}
                },

                // Stage 16
                {
                    $match: data.reportGlyffIds
                },

                ], function(err, glyphs) {
                    if(err) {
                        callback(null, err)
                    } else {
                        callback(null, glyphs)
                    }

                }

                );

}).catch((e)=>{console.log(e);});
}

exports.removeGlyff = function(data, callback) {
    glyff.find(data,function(err,glyffData){
        if(err) {callback(null,{'message':err,status:'0'})}
            if(!(glyffData.length > 0)) { callback(null,{'message':"Glyff not found",status:'0'}) }
                else if(glyffData[0].isDeleted == true) { callback(null,{'message':"Glyff has been deleted already",status:'0'})}
                    else {
                        glyff.findByIdAndUpdate(data, {$set: {isDeleted: true}} , {new:true}, function (err, deleteGlyff) {
                            if(err) {callback(null,{'message':err,status:'0'})}
                                callback(null, {'message':"Glyff has been deleted successfully",status:'1'})
                        });
                    }
                })
}

exports.getTopTrendingGlyph = function(callback){
    shareGlyphs.aggregate
    ([
        { "$match": {
            "createdAt": { 
                $lt: new Date(), 
                $gte: new Date(new Date().setDate(new Date().getDate()-1)) 
            }
        }},
        { "$group": {
            "_id": "$glyphId",
            "count": { "$sum": 1 },
        }},
        { "$sort" : { 
            "count" : -1 
        }}
        ],function(err,glyffData){
            console.log(glyffData.length, "glyffData")
            if(err) {callback(null,{'message':err,status:0})}
                if(!(glyffData.length > 0)) {
                    console.log("hell")
                    callback(null,{'message':"Glyff not found",status:0})
                } else {
                    console.log("welcome")
                    glyff.aggregate(

                // Pipeline
                [
                    // Stage 1
                    {
                        $match: {'_id':glyffData[0]._id}
                    },

                    // Stage 2
                    {
                        $lookup: {
                            "from" : "users",
                            "localField" : "creatorID",
                            "foreignField" : "_id",
                            "as" : "user"
                        }
                    },

                    // Stage 3
                    {
                        $project: {
                            "_id" : 1,
                            "isPublic" : 1,
                            "creatorID" : 1,
                            "parentID" : 1,
                            "isEditable" : 1,
                            "captionText" : 1,
                            "isTemplate" : 1,
                            "followeeCount" : 1,
                            "followerCount" : 1,
                            "popularity" : 1,
                            "trendingCount" : 1,
                            "sharedCount" : 1,
                            "title" : 1,
                            "creator" : 1,
                            "type" : 1,
                            "glyffThumbnail" : 1,
                            "glyffCustomised" : 1,
                            "glyffOriginal" : 1,
                            "user" : { $arrayElemAt: [ "$user", 0 ] },
                        }
                    },

                    ], function(err, glyffs) {
                        callback(null,{'message':"Glyff Found",status:'1','data':glyffs})
                    })
                } 
            });
}


/*****************
 AGGREGRATION PUBLIC GLYPH MODEL
 *****************/
 exports.aggregrationFetchPublicGlyphModel = function(data, callback) {
    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};

        if(glyffIds.length > 0){
            data.queryCondition._id = {$nin : glyffIds};
        }
        console.log(data.queryCondition,"queryCondition----------------------------");
        glyff.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: data.queryCondition
                },

                // Stage 2
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 3
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "_id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },

                // Stage 4
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "creatorID",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 5
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 6
                {
                    $project: {
                        "_id" : 1,
                        "isPublic" : 1,
                        "creatorID" : 1,
                        "parentID" : 1,
                        "isEditable" : 1,
                        "captionText" : 1,
                        "isTemplate" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "popularity" : 1,
                        "trendingCount" : 1,
                        "sharedCount" : 1,
                        "title" : 1,
                        "creator" : 1,
                        "type" : 1,
                        "glyffThumbnail" : 1,
                        "glyffCustomised" : 1,
                        "glyffGif":1,
                        "glyffOriginal" : 1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "editCount" : 1,
                        "viewCount" : 1,
                        "user": { $arrayElemAt: [ "$user", 0 ] },
                        "favouriteCount": { "$size": "$favourite" },
                        "isFavourite" :   { $cond: { if:{
                            $in: [ ObjectId(data.userId), "$favourite.userId" ]},then:true,else:false
                        }},
                        "block" : { $arrayElemAt: [ "$block", 0 ] },
                        "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                // Stage 7
                {
                    $match: {"block.blockedById": {$nin: [data.userId]}, $or: [
                    {"user.isPublic": true},
                    {"creatorID": data.userId}
                    ]}
                },

                ], function(err, publicGlyphs) {
                    if(err) {
                        callback(null, err)
                    } else {
                        callback(null, publicGlyphs)
                    }

                }
                );
    }).catch((e)=>{console.log(e);});
}


/*****************
 AGGREGRATION PRIVATE GLYPH MODEL
 *****************/
 exports.aggregrationFetchPrivateGlyphModel = function(data, callback) {
    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};

        if(glyffIds.length > 0){
            data.queryCondition._id = {$nin : glyffIds};
        }
        console.log(data.queryCondition,"private condition");
        glyff.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: data.queryCondition
                },

                // Stage 2
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 3
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "_id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },

                // Stage 4
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "creatorID",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 5
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 6
                {
                    $project: {
                        "_id" : 1,
                        "isPublic" : 1,
                        "creatorID" : 1,
                        "parentID" : 1,
                        "isEditable" : 1,
                        "captionText" : 1,
                        "isTemplate" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "popularity" : 1,
                        "trendingCount" : 1,
                        "sharedCount" : 1,
                        "title" : 1,
                        "creator" : 1,
                        "type" : 1,
                        "glyffThumbnail" : 1,
                        "glyffCustomised" : 1,
                        "glyffOriginal" : 1,
                        "glyffGif":1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "editCount" : 1,
                        "viewCount" : 1,
                        "user": { $arrayElemAt: [ "$user", 0 ] },
                        "favouriteCount": { "$size": "$favourite" },
                        "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                        "block" : { $arrayElemAt: [ "$block", 0 ] },
                        "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                // Stage 7
                {
                    $match: {"block.blockedById": {$nin: [data.userId]}, "user.isPublic": false}
                },

                // Stage 8
                {
                    $lookup: {
                        "from" : "follows",
                        "localField" : "creatorID",
                        "foreignField" : "followeeId",
                        "as" : "follow"
                    }
                },

                // Stage 9
                {
                    $unwind: {
                        path : "$follow",
                    }
                },

                // Stage 10
                {
                    $match: {"follow.followerId":data.userId, "follow.isValid": true}
                },

                ], function(err, privateGlyphs) {
                    if(err) {
                        callback(null, err)
                    } else {
                        callback(null, privateGlyphs)
                    }

                }
                );
    }).catch((e)=>{console.log(e);});
}


/*****************
 AGGREGRATION PRIVATE FRIENDS GLYPH MODEL
 *****************/
 exports.aggregrationFetchPrivateFriendsGlyphModel = function(data, callback) {
    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};

        if(glyffIds.length > 0){
            data.queryCondition._id = {$nin : glyffIds};
        }
        console.log(data.queryCondition,"private queryCondition");
        glyff.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: data.queryCondition
                },

                // Stage 2
                {
                    $sort: {
                        createdAt: -1
                    }
                },

                // Stage 3
                // {
                //     $skip: data.pageSortQuery.skip
                // },
                //
                // // Stage 4
                // {
                //     $limit: data.pageSortQuery.limit
                // },

                // Stage 5
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 6
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "_id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },

                // Stage 7
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "creatorID",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 8
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 9
                {
                    $project: {
                        "_id" : 1,
                        "isPublic" : 1,
                        "creatorID" : 1,
                        "parentID" : 1,
                        "isEditable" : 1,
                        "captionText" : 1,
                        "isTemplate" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "popularity" : 1,
                        "trendingCount" : 1,
                        "sharedCount" : 1,
                        "title" : 1,
                        "creator" : 1,
                        "type" : 1,
                        "glyffThumbnail" : 1,
                        "glyffCustomised" : 1,
                        "glyffOriginal" : 1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "editCount" : 1,
                        "viewCount" : 1,
                        "user": { $arrayElemAt: [ "$user", 0 ] },
                        "favouriteCount": { "$size": "$favourite" },
                        "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                        "block" : { $arrayElemAt: [ "$block", 0 ] },
                        "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                // Stage 10
                {
                    // $match: {"block.blockedById": {$nin: [data.userId]}, "user.isPublic": false}
                    $match: {"block.blockedById": {$nin: [data.userId]}}
                },

                // Stage 11
                {
                    $lookup: {
                        "from" : "follows",
                        "localField" : "creatorID",
                        "foreignField" : "followeeId",
                        "as" : "follow"
                    }
                },

                // Stage 12
                {
                    $unwind: {
                        path : "$follow",
                    }
                },

                // Stage 13
                {
                    $match: {"follow.followerId":data.userId, "follow.isValid": true}
                },

                ], function(err, privateGlyphs) {
                    if(err) {
                        console.log(err, "errrrrrrrrrr")
                        callback(null, err)
                    } else {
                        console.log(privateGlyphs, "privateGlyphs")
                        callback(null, privateGlyphs)
                    }

                }
                );
}).catch((e)=>{console.log(e);});
}



/*****************
 AGGREGRATION Count GLYPH MODEL
 *****************/
 exports.countFetchPrivateFriendsGlyphModel = function(data, callback) {
    checkReportGlyff(data.userId).then((glyffIds) => {
        data.queryCondition = data.queryCondition || {};

        if(glyffIds.length > 0){
            data.queryCondition._id = {$nin : glyffIds};
        }
        console.log(data.queryCondition,"queryCondition");
        glyff.aggregate(

            // Pipeline
            [
                // Stage 1
                {
                    $match: data.queryCondition
                },

                // Stage 2
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "creatorID",
                        "foreignField" : "_id",
                        "as" : "user"
                    }
                },

                // Stage 3
                {
                    $lookup: {
                        "from" : "favouriteglyphs",
                        "localField" : "_id",
                        "foreignField" : "glyphId",
                        "as" : "favourite"
                    }
                },

                // Stage 4
                {
                    $lookup: {
                        "from" : "blocks",
                        "localField" : "creatorID",
                        "foreignField" : "blockedId",
                        "as" : "block"
                    }
                },

                // Stage 5
                {
                    $lookup: {
                        "from" : "users",
                        "localField" : "parentID",
                        "foreignField" : "_id",
                        "as" : "parentUser"
                    }
                },

                // Stage 6
                {
                    $project: {
                        "_id" : 1,
                        "isPublic" : 1,
                        "creatorID" : 1,
                        "parentID" : 1,
                        "isEditable" : 1,
                        "captionText" : 1,
                        "isTemplate" : 1,
                        "followeeCount" : 1,
                        "followerCount" : 1,
                        "popularity" : 1,
                        "trendingCount" : 1,
                        "sharedCount" : 1,
                        "title" : 1,
                        "creator" : 1,
                        "type" : 1,
                        "glyffThumbnail" : 1,
                        "glyffCustomised" : 1,
                        "glyffOriginal" : 1,
                        "createdAt" : 1,
                        "updatedAt" : 1,
                        "editCount" : 1,
                        "viewCount" : 1,
                        "user": { $arrayElemAt: [ "$user", 0 ] },
                        "favouriteCount": { "$size": "$favourite" },
                        "isFavourite" : { $cond: { if: { $eq: [{ $arrayElemAt: [ "$favourite.userId", 0 ] }, data.userId] }, then: true, else: false } },
                        "block" : { $arrayElemAt: [ "$block", 0 ] },
                        "parentUser" : { $arrayElemAt: [ "$parentUser", 0 ] }
                    }
                },

                // Stage 7
                {
                    $match: {"block.blockedById": {$nin: [data.userId]}, "user.isPublic": false}
                },

                // Stage 8
                {
                    $lookup: {
                        "from" : "follows",
                        "localField" : "creatorID",
                        "foreignField" : "followeeId",
                        "as" : "follow"
                    }
                },

                // Stage 9
                {
                    $unwind: {
                        path : "$follow",
                    }
                },

                // Stage 10
                {
                    $match: {"follow.followerId":data.userId, "follow.isValid": true}
                },

                // Stage 11
                {
                    $count: "count"
                },

                ], function(err, countGlyphs) {
                    if(err) {
                        callback(null, err)
                    } else {
                        callback(null, countGlyphs)
                    }

                }
                );
    }).catch((e)=>{console.log(e);});
}

exports.fetchAllGlyphByUserModel = function(glyphObj, callback) {
    console.log("glyphObj:",glyphObj)
    glyff.find(glyphObj.queryCondition, function(err,glyphs){
        // console.log(err, "glyphs", glyphs)
        if(glyphs.length > 0){
            callback(null, glyphs)
        }
        else
        {
            callback(null,err);
        }
    })
}
exports.countView = function(data,callback){

    glyff.aggregate(
        [

        {
            $match: {
                "creatorID":ObjectId(data),"isDeleted":false
            }
        },


        {
            $group: {
                _id:null,
                total:{$sum:'$viewCount'}
            }
        },

        ], function(err, countViewGlyphs) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, countViewGlyphs)
            }

        }
        );

} 

exports.calculateDate = function(current,previous){
    glyff.find({
        createdAt: {
            $gte: previous

        } 
    },function(e,d){    
       console.log("d  :",d)     
   })
}
exports.deleteMeme = function(userid,callback){
    glyff.update(
        {_id:userid},
        {$set:{isDeleted:true}}
        ,function(err, data) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, data)
            }

        })   
}
 exports.blockMemeByAdmin = function(glyffid,callback){
    glyff.update(
        {_id:glyffid},
        {$set:{isDeleted:true}}
        ,function(err, data) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, data)
            }

        })   
}       
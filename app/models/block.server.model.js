/**********************
 SCHEMA INITIALISTAION
 **********************/
var Schema = require('mongoose').Schema;

/*********************
 BLOCK SCHEMA
 *********************/
var blockSchema = new Schema({
    blockedById:   { type: Schema.Types.ObjectId, ref: 'users' },
    blockedId:   { type: Schema.Types.ObjectId, ref: 'users' },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

var block = mongoose.model('blocks', blockSchema);

/*****************
 SAVE GLYPH MODEL
 *****************/
exports.blockModel = function(data, callback) {

    var newBlock = new block(data);

    // API call to save block
    newBlock.save(function(err, blocked) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, blocked)
        }
    });

}

/*****************
 Fetch BLOCK MODEL
 *****************/
exports.fetchBlockUsersModel = function(data, callback) {

    data.queryCondition = data.queryCondition || {};
    data.pageSortQuery = data.pageSortQuery || {};

    // block.find(data.queryCondition, null, data.pageSortQuery, function(err, blocks) {
    //     if(err) {
    //         callback(null, err)
    //     } else {
    //         callback(null, blocks)
    //     }
    // });

    block.aggregate(

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
                    "localField" : "blockedId",
                    "foreignField" : "_id",
                    "as" : "blockedUserDetail"
                }
            },

            // Stage 3
            {
                $sort: {
                    createdAt: -1
                }
            },

            // Stage 4
            {
                $skip: data.pageSortQuery.skip
            },

            // Stage 5
            {
                $limit: data.pageSortQuery.limit
            },

            // Stage 6
            {
                $project: {
                    "blockedById" : 1,
                    "createdAt" : 1,
                    "blockedUserDetail" : { $arrayElemAt: [ "$blockedUserDetail", 0 ] }
                }
            },

        ], function(err, blocks) {
            if(err) {
                callback(null, err)
            } else {
                callback(null, blocks)
            }
        });

}

/*****************
 COUNT BLOCK MODEL
 *****************/
exports.countBlockModel = function(data, callback) {

    data.queryCondition = data.queryCondition || {};

    block.count(data.queryCondition, function(err, count) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, count)
        }

    });

}

/*****************
 UNBLOCK MODEL
 *****************/
exports.unblockModel = function(data, callback) {

    block.remove({blockedById: data.blockedById, blockedId: data.blockedId}, function(err) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, true)
        }
    });

}

/*****************
 FIND BLOCK MODEL
 *****************/
exports.findBlockModel = function(data, callback) {

    block.find({blockedById: data.blockedById, blockedId: data.blockedId}, function(err, block) {
        if(err) {
            callback(null, err)
        } else {
            callback(null, block)
        }
    });

}



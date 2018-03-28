const Redis = require('ioredis');
const Lock = require('./lock');


/**
 * convenient way to create a redis-lock
 */
module.exports = function(options) {
	if (!options) options = {};
	let redis = null;
	if (options.redisInstance) redis = options.redisInstance;
	if (options.redisOptions) redis = new Redis(options.redisOptions);

	if (!redis) throw new Error('redis-lock requires either redisInstance or redisOptions');
	return new Lock(redis, options);
};
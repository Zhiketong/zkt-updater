const IORedis = require('ioredis');
const ZKTLock = require('./lock');
const debug = require('debug');
const md5 = require('./md5');
const wait = require('pwait');

let redisInstances = {};

class ZKTUpdater {

	constructor(name, options) {

		if (!name || !name.match(/^[a-z0-9\:\_\-\.]+$/i)) {
			throw new Error('ZKTUpdater need first argument to be a valid string');
		}

		this.name = name;
		
		if (!options.get || typeof options.get !== 'function') throw new Error('options should contain get function');
		if (!options.change || typeof options.change !== 'function') throw new Error('options should contain change function');

		this.options = Object.assign({

			//parameter passed to new IORedis()
			redisOptions: process.env.REDIS_URL,

			//use existing ioredis instance?
			redisInstance: null,

			//write back delay seconds
			changeDelay: 1,

			//max time of get value race lock (ms)
			raceLockTimeout: 3000,

			//value in redis will expire in this seconds if no query
			redisKeyExpireSeconds: 30,

			//prefix for every key
			keyPrefix: 'zktUpdater'

		}, options);


		//create cache instance
		let instance = null, optionsKey = JSON.stringify(this.options.redisOptions);

		//first, check redisInstance option
		if (this.options.redisInstance) {
			instance = this.options.redisInstance;
		} else if ( this.options.redisOptions ) {
			//check if there's already an existing redis instance created by 
			//the same redisOptions. If not, create a new one
			if (redisInstances[optionsKey]) {
				instance = redisInstances[optionsKey];
			} else {
				redisInstances[optionsKey] = instance = new IORedis(this.options.redisOptions);
			}
		}

		if (instance) {
			this.cache = instance;
		} else {
			throw new Error('ZKTUpdater should not initiated without redisOptions');
		}
		
		this.debug = debug(`zktUpdater:${this.name}`);
		this.timeouts = {};
		this.lock = new ZKTLock(this.cache, {
			defaultTimeout: this.options.raceLockTimeout 
		});

		this.cache.defineCommand('zktupdater_incrby', {
			numberOfKeys: 1,
			lua: `	if (redis.call('exists', KEYS[1]) == 1) then
						local v = tonumber(redis.call('hget', KEYS[1], 'value'));
						if (v + tonumber(ARGV[1]) >= 0) then
							redis.call('hincrby', KEYS[1], 'diff', ARGV[1]);
							redis.call('expire', KEYS[1], ${this.options.redisKeyExpireSeconds});
							return tonumber(redis.call('hincrby', KEYS[1], 'value', ARGV[1]));
						end;
						return -1;
					end;
					return -9999999;
			`
		});

		this.cache.defineCommand('zktupdater_get_and_reset_diff', {
			numberOfKeys: 2,
			lua: `	redis.call('del', KEYS[2]);
					if (redis.call('exists', KEYS[1]) == 1) then
						local d = tonumber(redis.call('hget', KEYS[1], 'diff'));
						redis.call('hset', KEYS[1], 'diff', 0);
						return d;
					end;
					return 0;
			`
		});

		this.cache.defineCommand('zktupdater_set_value_add_diff', {
			numberOfKeys: 1,
			lua: `	if (redis.call('exists', KEYS[1]) == 1) then
						local d = tonumber(redis.call('hget', KEYS[1], 'diff'));
						local v = tonumber(ARGV[1]) + d;
						redis.call('hset', KEYS[1], 'value', v);
						return v;
					end;
					redis.call('hset', KEYS[1], 'value', ARGV[1]);
					return tonumber(ARGV[1]);
			`
		});
	}

	/**
	 * generate a cache key used for redis
	 * support object key
	 */
	getKey(key) {
		if (typeof key !== 'string' && typeof key !== 'number') {
			key = md5(JSON.stringify(key));
		}
		return `${this.options.keyPrefix}:${this.name}:${key}`;
	}

	/**
	 * get and initiate value
	 */
	async get(origKey, ...args) {
		let key = this.getKey(origKey);
		let v = await this.cache.hgetall(key);
		// this.debug(`get key ${key}`, v);
		if (v && typeof v === 'object' && v.value) return v;

		let { executed, result } = await this.lock.race('get:' + key, async () => {
			this.debug(`loading ${key} from get function`);
			try {
				let newData = await this.options.get(origKey, ...args);
				this.debug(`set ${key} to cache`);
				await this.cache.hset(key, 'value', newData);
				return newData;
			} catch (err) {
				if (typeof err === 'object') err.zkt_loader = 1;
				if (err && err.code) throw err;
				if (typeof err !== 'object') err = new Error(err);
				err.message = `ZKT-Loader ${this.name}:${key} Error: ${err.message}`;
				throw err;
			}
		});

		if (executed && result !== null) return result;
		return this.get(origKey, ...args);
	}



	async incrby(origKey, incr, ...args) {
		if (typeof incr !== 'number') throw new Error('datawriter.incryby only accepts numbers');
		const key = this.getKey(origKey);
		let r = await this.cache.zktupdater_incrby(key, incr);

		//if not exists
		if (r === -9999999) {
			await this.get(origKey, ...args);
			r = await this.cache.zktupdater_incrby(key, incr);
		}

		this.write(origKey, ...args);

		return r;
	}

	async write(origKey, ...args) {
		try {
			const key = this.getKey(origKey);
			const lockKey = origKey + ':write:lock';
			let notLocked = await this.cache.set(lockKey, '1', 'EX', this.options.changeDelay + 1, 'NX');

			if (notLocked) {
				setTimeout(async () => {
					this.debug(`writing ${key} by change function`);
					try {
						let diff = await this.cache.zktupdater_get_and_reset_diff(key, lockKey);
						this.debug('set value', diff);

						if (Math.abs(diff) > 0) {
							this.debug('save diff from last value to db');
							//save diff from last value to db
							await this.options.change(origKey, diff, ...args);
						}

						//get latest value from db again
						let newData = await this.options.get(origKey, ...args);
						this.debug('got new value', newData);

						//prime lastest value to redis (add diff at the same time)
						await this.cache.zktupdater_set_value_add_diff(key, newData);
					} catch (err) {
						console.error('zktUpdater got error when writing back', err);
					}
				}, this.options.changeDelay * 1000);
			}
		} catch (err) {
			console.error('zktUpdater.write got error', err);
		}
	}

	clear(origKey) {
		this.debug('clearing', origKey);
		return this.cache.del(this.getKey(origKey));
	}
}


module.exports = ZKTUpdater;
const IORedis = require('ioredis');
const NodeCache = require('node-cache');
const ZKTCache = require('./cache');
const ZKTLock = require('./lock');
const debug = require('debug');
const md5 = require('./md5');

let redisInstances = {};

class ZKTLoader {

	constructor(name, loader, options) {

		if (!name || !name.match(/^[a-z0-9\:\_\-\.]+$/i)) {
			throw new Error('ZKTLoader need first argument to be a valid string');
		}

		this.name = name;
		this.loader = loader;
		this.options = Object.assign({

			//if use redis, if not, use in-memory cache provided by node-cache
			useRedis: false, 

			//parameter passed to new IORedis()
			redisOptions: process.env.REDIS_URL,

			//use existing ioredis instance?
			redisInstance: null,

			//default expiration seconds
			ttl: 30,

			//expiration seconds of loader call
			loaderTimeout: 3,

			//prefix for every key
			keyPrefix: 'zktLoader'

		}, options);


		//create cache instance
		if (this.options.useRedis) {
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
				this.cache = new ZKTCache(instance);
			} else {
				throw new Error('ZKTLoader should not initiated without redisOptions');
			}
		} else {
			this.cache = new ZKTCache(new NodeCache({
				stdTTL: this.options.ttl * 2  //default ttl of node-cache
			}));
		}

		this.debug = debug(`zktLoader:${this.name}`);
		this.timeouts = {};
		this.lock = new ZKTLock(this.cache);
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
	 * load data from cache or loader
	 */
	async load(origKey, ...args) {
		let key = this.getKey(origKey);

		return new Promise(async (done, reject) => {
			let did = false;
			let v = null;
			this.debug(`try to load ${key} from cache`);

			try {
				v = await this.cache.get(key);
				if (v && v.createTime) {
					this.debug(`got ${key} from cache`);
					done(v.value);
					did = true;
				} else {
					this.debug(`${key} not found in cache`);
				}

				if (!v || (v && v.createTime && Date.now() - v.createTime > this.options.ttl * 1000)) {
					let { executed } = await this.lock.race(origKey, async () => {
						this.debug(`loading ${key} from loader`);
						try {
							let newData = await this.loader(origKey, ...args);
							this.debug(`set ${key} to cache`);
							await this.prime(origKey, newData);
							if (!did) {
								done(newData);
								did = true;
							}
						} catch (err) {
							if (typeof err === 'object') err.zkt_loader = 1;
							if (err && err.code) throw err;
							if (typeof err !== 'object') err = new Error(err);
							err.message = `ZKT-Loader ${this.name}:${key} Error: ${err.message}`;
							throw err;
						}
					}, did);

					if (!executed && !did) {
						this.load(origKey).then(done).catch(reject);
					}
				}
			} catch (err) {
				if (!did) {
					reject(err);
				} else {
					if (typeof err !== 'object') err = new Error(err);
					err.message = `ZKT-Loader ${this.name}:${key} Error: ${err.message}`;
					console.error(err);
				}
			}
		});
	}

	//清除缓存
	clear(key) {
		return this.cache.del(this.getKey(key)).then(r => r * 1);
	}

	//设置缓存
	async prime(origKey, value) {
		let key = this.getKey(origKey);
		await this.cache.set(key, {
			createTime: Date.now(),
			value
		}, 'EX', this.options.ttl * 2);
	}
}


module.exports = ZKTLoader;
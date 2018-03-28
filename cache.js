const debug = require('debug');


/**
 * 兼容ioredis和node-cache的缓存类
 * 只支持 get set del 方法
 */
class ZKTCache {

	constructor(instance) {
		this.type = instance.setnx ? 'redis' : 'node';
		this.instance = instance;
		this.debug = debug(`zktCache:${this.type}`);
		this.debug('new instance');
	}

	//perform get, returns saved data or null
	get(key) {
		this.debug('get', key);
		if (this.type === 'redis') {
			return this.instance.get(key).then(r => {
				if (!r) return r;
				try {
					return JSON.parse(r);
				} catch (err) {
					console.error(`Bad JSON value from Redis(${key}), raw=${r}`);
				}
				return null;
			});
		} else {
			return Promise.resolve(this.instance.get(key)).then(r => r === undefined ? null : r);
		}
	}

	//perform set, returns bool
	//supports NX
	set(key, val, PXEX, expires, NXXX) {
		this.debug('set', key, val, PXEX || '', expires || '', NXXX || '');

		if (PXEX === 'NX' || PXEX === 'XX') {
			NXXX = PXEX;
			PXEX = null;
			expires = 0;
		}

		if (this.type === 'redis') {
			let args = [key, JSON.stringify(val)];
			if (PXEX && expires > 0) args = args.concat([PXEX, expires]);
			if (NXXX) args.push(NXXX);
			this.debug('ioredis.set', ...args);
			return this.instance.set(...args).then(r => !!(r === 'OK'));
		} else {
			let expireSeconds = 0;
			if (PXEX === 'EX') expireSeconds = expires;
			if (PXEX === 'PX') expireSeconds = expires / 1000;

			this.debug('nodecache.set', key, val, PXEX, `${expires}(seconds=${expireSeconds})`, NXXX);
			if (NXXX === 'NX') {
				let old = this.instance.get(key);
				if (old) return Promise.resolve(false);
				return Promise.resolve(!!this.instance.set(key, val, expireSeconds));
			} else if (NXXX === 'XX') {
				let old = this.instance.get(key);
				if (old === undefined) return Promise.resolve(false);
				return Promise.resolve(!!this.instance.set(key, val, expireSeconds));
			} else {
				return Promise.resolve(!!this.instance.set(key, val, expireSeconds));
			}
		}
	}

	//perform delelete, returns bool
	del(key) {
		this.debug('del', key);
		if (this.type === 'redis') {
			return this.instance.del(key).then(r => !!(r && r * 1 > 0));
		} else {
			return Promise.resolve(!!this.instance.del(key));
		}
	}

}

module.exports = ZKTCache;
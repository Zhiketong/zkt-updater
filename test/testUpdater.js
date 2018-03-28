const Updater = require('../');
const wait = require('pwait');
const Redis = require('ioredis');

const redis = new Redis();

let STOCKS = 30000;

const updater = new Updater('brand', {
	async get(id, ctx) {
		console.log('on get', ctx);
		await wait(100);
		let r = await redis.get('stock' + id) * 1;
		return r;
	},
	async change(id, v, ctx) {
		console.log('on change', ctx);
		await wait(100);
		await redis.incrby('stock' + id, v);
	}
});

async function initiate() {
	await redis.set('stock1', STOCKS);
	await redis.set('orders1', 0);
	await redis.set('stock2', STOCKS);
	await redis.set('orders2', 0);
	await updater.clear(1);
	await updater.clear(2);
}

async function validate(id) {
	let s = await redis.get('stock' + id) * 1;
	let o = await redis.get('orders' + id) * 1;
	console.log('stock=' + s, 'orders=' + o);
	if (STOCKS - s === o) {
		console.log(id, 'valid ok');
	} else {
		console.log(id, 'error');
	}
	console.log(await redis.hgetall('zktUpdater:brand:1'));
}

async function order(id, n) {
	await redis.incrby('orders' + id, n);
}

function log(v) {
	console.log(v);
	return v;
}

(async () => {
	console.log('initiating redis');
	if (process.argv[2] === 'master') await initiate();
	console.log(await redis.hgetall('zktUpdater:brand:1'));
	for(let i=0; i<30000; i++) {
		(async () => {
			let left = await updater.incrby(1, -1, {a: 'A'});
			// console.log('left', left);
			if (left >= 0) {
				// console.log('set order', 1);
				await order(1, 1);
			} else {
				console.log('empty');
			}
		})();
		(async () => {
			let left = await updater.incrby(2, -2, {a: 'B'});
			// console.log('left', left);
			if (left >= 0) {
				// console.log('set order', 1);
				await order(2, 2);
			} else {
				console.log('empty');
			}
		})();
		if (Math.random() > 0.5) await wait(1);
	}

	console.log('finished');
	await validate(1);
	await validate(2);
})();

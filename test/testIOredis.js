const Redis = require('ioredis');
const expect = require('chai').expect;
const wait = require('pwait');

function log(v) {
	console.log(v);
	return v;
}

describe('test zkt cache redis', function() {

	const cache = new Redis(process.env.REDIS_URL);

	cache.defineCommand('zktupdater_incrby', {
		numberOfKeys: 1,
		lua: `	if (redis.call('exists', KEYS[1]) == 1) then
					local v = tonumber(redis.call('hget', KEYS[1], 'value'));
					if (v + tonumber(ARGV[1]) >= 0) then
						redis.call('hincrby', KEYS[1], 'diff', ARGV[1]);
						return tonumber(redis.call('hincrby', KEYS[1], 'value', ARGV[1]));
					end;
					return -1;
				end;
				return -9999999;
		`
	});

	cache.defineCommand('zktupdater_get_and_reset_diff', {
		numberOfKeys: 1,
		lua: `	if (redis.call('exists', KEYS[1]) == 1) then
					local d = tonumber(redis.call('hget', KEYS[1], 'diff'));
					redis.call('hset', KEYS[1], 'diff', 0);
					return d;
				end;
				return 0;
		`
	});


	cache.defineCommand('zktupdater_set_value_add_diff', {
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

	it('hmset', async () => {
		// await cache.hincrby('testhash', 'a', 9);
		// console.log(await cache.hgetall('testhash'));
		// await cache.hmset('testhash', 'a', 1, 'b', 2);
		// await cache.hincrby('testhash', 'a', 9);
		// console.log(await cache.hgetall('testhash'));
		// await cache.expire('testhash', 1);
		// await wait(1000);
		// console.log(await cache.hgetall('testhash'));
		await cache.del('testhasha');
		console.log('set value to 2', await cache.hset('testhasha', 'value', 2));
		console.log(await cache.hgetall('testhasha'));
		console.log('incrby -1', await cache.zktupdater_incrby('testhasha', -1));
		console.log(await cache.hgetall('testhasha'));
		console.log('incrby -1', await cache.zktupdater_incrby('testhasha', -1));
		console.log(await cache.hgetall('testhasha'));
		console.log('reset value to 5', await cache.zktupdater_set_value_add_diff('testhasha', 5));
		console.log(await cache.hgetall('testhasha'));
		console.log('incrby -1', await cache.zktupdater_incrby('testhasha', -1));
		console.log(await cache.hgetall('testhasha'));
		console.log('get and reset diff', await cache.zktupdater_get_and_reset_diff('testhasha'));
		console.log(await cache.hgetall('testhasha'));
		console.log('reset value to 5', await cache.zktupdater_set_value_add_diff('testhasha', 5));
		console.log(await cache.hgetall('testhasha'));
	});

	// it('clean', () => {
	// 	return cache.del('foo').then(log);
	// });

	// it('clean', () => {
	// 	return cache.del('foo').then(log);
	// });

	// it('test get foo', () => {
	// 	return cache.get('foo').then(log).then(r => {
	// 		expect(r).to.equal(null);
	// 	});
	// });

	// it('test set foo with ttl=1', () => {
	// 	return cache.set('foo', 'bar', 'EX', 1).then(log);
	// });

	// it('test get foo', () => {
	// 	return cache.get('foo').then(log).then(r => {
	// 		expect(r).to.equal('bar');
	// 	});
	// });

	// it('should wait 1 second', () => wait(1000));

	// it('should get foo == null', () => {
	// 	return cache.get('foo').then(log).then(r => {
	// 		expect(r).to.equal(null);
	// 	});
	// });

	// it('should get and set for 1s', async function() {
	// 	this.timeout(60000);
	// 	let startTime = Date.now();
	// 	let t = 0;
	// 	while ( true ) {
	// 		let now = Date.now();
	// 		await cache.set('foo', now);
	// 		let r = await cache.get('foo');
	// 		expect(r * 1).to.equal(now);
	// 		t++;
	// 		if (now - startTime >= 1000) break;
	// 	}
	// 	console.log(t);
	// 	return Promise.resolve(1);
	// });


	// it('test NX', async function() {
	// 	await cache.set('foo', 'bar', 'PX', 100);
	// 	expect(await cache.get('foo')).to.equal('bar');
	// 	expect(await cache.set('foo', 'bar2', 'PX', 100, 'NX')).to.equal(null);
	// 	expect(await cache.get('foo')).to.equal('bar');
	// 	expect(await cache.set('foo', 'bar2', 'PX', 100)).to.equal('OK');
	// 	expect(await cache.get('foo')).to.equal('bar2');
	// 	await wait(101);
	// 	expect(await cache.get('foo')).to.equal(null);
	// });

	// it('test XX', async function() {
	// 	await cache.del('foo');
	// 	expect(await cache.get('foo')).to.equal(null);
	// 	expect(await cache.set('foo', 'bar', 'PX', 100, 'XX')).to.equal(null);
	// 	await cache.set('foo', '1');
	// 	expect(await cache.set('foo', 'bar2', 'PX', 100, 'XX')).to.equal('OK');
	// 	expect(await cache.get('foo')).to.equal('bar2');
	// 	expect(await cache.set('foo', 'bar3', 'XX')).to.equal('OK');
	// 	expect(await cache.get('foo')).to.equal('bar3');
	// 	await cache.del('foo');
	// 	expect(await cache.set('foo', 'bar', 'NX')).to.equal('OK');
	// });

});

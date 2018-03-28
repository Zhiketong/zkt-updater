const Cache = require('../cache');
const Lock = require('../lock');
const Redis = require('ioredis');
// const NodeCache = require('node-cache');
const pwait = require('pwait');
const waitRand = () => pwait(Math.ceil( Math.random() * 20 ));

let prefix = process.argv[3] || '';

let i = 0;
let lastms = Date.now();
let running = false;
function getTime() {
	let now = Date.now();
	let re = now - lastms;
	lastms = now;
	return re + 'ms';
}

function createTask() {
	let name = `task${prefix} ${(++i)}`;
	return function(delayed) {
		console.log(name + ' start,', (delayed ? 'delayed' : ''), getTime());
		if (running) throw new Error('running is true');
		running = true;
		//results.push(name + ' start ' + getTime());
		return waitRand().then(() => {
			// if (Math.random() > 0.9) throw new Error('random error for ' + name);
			//results.push(name + ' end ' + getTime());
			console.log(name + ' done', getTime());
			running = false;
		});
	};
}

const redis = new Redis(process.env.REDIS_URL);
// const nodeCache = new NodeCache();
let cache = new Cache(redis);
// let cache = new Cache('node', nodeCache);
let lock = new Lock(cache, {
	defaultTimeout: 60000
});

// process.on('unhandledRejection', (reason, p) => {
// 	console.log('Unhandled Rejection at:', p, 'reason:', reason);
// });

describe('test lock', function() {
	this.timeout(10000);

	it('should test lock', () => {
		return Promise.all([
			lock.all('lock1', createTask()),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			waitRand().then(() => lock.all('lock1', createTask())),
			lock.all('lock1', createTask())
		]).then(() => {
			return Promise.all([
				lock.all('lock1', createTask()),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				waitRand().then(() => lock.all('lock1', createTask())),
				lock.all('lock1', createTask())
			]);
		});
	});
});



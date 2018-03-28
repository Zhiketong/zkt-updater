const Loader = require('../');
const zkt = require('zkt-graphql');
const pwait = require('pwait');
const expect = require('chai').expect;

const loader = new Loader('brand', (brand_id) => {
	console.log(`
-------------loading---------
`);
	return zkt.query('CoreBrand', {
		brand_id: zkt.INT(brand_id)
	}, 'brand_id,brand_name,brand_type,wx_app_id,wx_app_name').then(async (r) => {
		await pwait( Math.ceil(Math.random() * 2000) );
			console.log(`
************* loaded ************
`);
		return r;
	});
}, {
	useRedis: true,
	ttl: 30
});

function log(v) {
	console.log(v);
	return v;
}

describe('test zkt loader', function() {

	this.timeout(600000);

	it('1', (done) => {
		let t = setInterval(() => {
			loader.load(133580).then(r => {
				expect(r).to.be.an('object');
				expect(r.brand_id).to.equal(133580);
			}).catch(err => {
				console.error('err', err);
			});
		}, 100);
		setTimeout(() => {
			clearInterval(t);
			done();
		}, 500000);
	});

});
process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at:', p, 'reason:', reason);
});
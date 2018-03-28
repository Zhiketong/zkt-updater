const Loader = require('../');
const zkt = require('zkt-graphql');
const pwait = require('pwait');
const expect = require('chai').expect;

const loader = new Loader('brand', (brand_id, extra) => {
	console.log(` -------------loading--------- `, extra);
	return zkt.query('CoreBrand', {
		brand_id: zkt.INT(brand_id)
	}, 'brand_id,brand_name,brand_type,wx_app_id,wx_app_name').then(async (r) => {
		await pwait( Math.ceil(Math.random() * 200) );
		console.log(` ************* loaded ************ `);
		return r;
	});
}, {
	useRedis: false,
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
			loader.load(133581, {a:'b'}).then(r => {
				expect(r).to.be.an('object');
				expect(r.brand_id).to.equal(133581);
			}).catch(err => {
				console.error('err', err);
			});
		}, 20);
		setTimeout(() => {
			clearInterval(t);
			done();
		}, 500000);
	});

});

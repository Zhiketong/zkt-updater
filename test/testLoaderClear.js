const Loader = require('../');
const zkt = require('zkt-graphql');
const pwait = require('pwait');
const expect = require('chai').expect;

const loader = new Loader('brand', (brand_id) => {
	return zkt.query('CoreBrand', {
		brand_id: zkt.INT(brand_id)
	}, 'brand_id,brand_name,brand_type,wx_app_id,wx_app_name').then(async (r) => {
		await pwait( Math.ceil(Math.random() * 2000) );
		return r;
	});
}, {
	useRedis: true,
	ttl: 5
});

describe('test zkt loader', function() {

	this.timeout(600000);

	it('should clear 133581', () => {
		return loader.clear(133581).then(r => {
			console.log('cleared', typeof r, r);
		});
	});

});

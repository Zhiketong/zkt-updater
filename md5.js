const crypto = require('crypto');

module.exports = function(s) {
	if (typeof s !== 'string') throw new Error('md5 can only support string');
	return crypto.createHash('md5').update(s).digest('base64').replace(/[\=]+$/, '').replace(/\+/g, 'A').replace(/\//g, 'Z');
};
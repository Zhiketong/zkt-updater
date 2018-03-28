zkt-loader
==========

cache data resource with smart auto-refresh and lock.

## Usage ##

```javascript
const ZKTLoader = require('zkt-loader');
const loader = new ZKTLoader('user', function(user_id) {
	return db.getUser(user_id);
}, {
	useRedis: true,
	redisOptions: 'redis://127.0.0.1:6379'
});

//...

router.get('/getUser', async ctx => {
	ctx.body = loader.load(ctx.query.user_id);
});

//...

```
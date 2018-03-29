zkt-updater
==========

fast and reliable inventory cache based on redis

## Install ##

`npm install zkt-updater`

## Usage ##

```javascript
const updater = new ZKTUpdater('ticketInventory', {
	async get(id, ctx) {
		let t = await db.query("select total from ticket_product where ticket_product_id=? limit 1", [id]);
		return t.total * 1;
	},
	async change(id, diff, ctx) {
		//diff < 0
		await db.query("update ticket_product set total = total + ? where ticket_product_id = ?", [diff, id]);
	}
});

//...


router.post('/create_order', async ctx => {

	let { ticket_product_id, tickets } = ctx.query;

	let left_total = await updater.incrby(ticket_product_id, -tickets, ctx);
	if (left_total >= 0) {
		await create_order(ctx);
	}
	//...
});


```

## Options ##

`get(id, ...args)` get value function, returns Promise

`change(id, diff, ...args)` update value function, returns Promise

`changeDelay` (default 1 second),  when value changed in redis, wait some time before call the `change` function

`redisOptions` default: process.env.REDIS_URL
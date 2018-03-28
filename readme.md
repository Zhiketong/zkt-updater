zkt-updater
==========

## Usage ##

```javascript
const updater = new ZKTUpdater('ticketInventory', {
	async get(id, ctx) {
		let t = await db.query("select total_sold from ticket_product where ticket_product_id=? limit 1", [id]);
		return t.total_sold * 1;
	},
	async change(id, diff, ctx) {
		await db.query("update ticket_product set total_sold = total_sold + ? where ticket_product_id = ?", [diff, id]);
	}
});

//...


router.post('/create_order', async ctx => {

	let { ticket_product_id, tickets } = ctx.query;

	let inventory = await updater.incrby(ticket_product_id, -tickets);
	if (inventory >= 0) {
		await create_order(ctx);
	}
	//...
});


```
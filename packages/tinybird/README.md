### A guide on how to migrate your tinybird datasource

> What to do when you want to add/remove/update a column in your `datasource`.

The `_migration` folder includes:

- `ping_response__v4.datasource` which represents the `VERSION 4` of our
  datasource
- `ping_response.datasource` which has the upgraded schema and a new `VERSION 5`
- `tb_backfill_populate.pipe` will fill the datasource with all the data until a
  set date X
- `tb_materialized_until_change_ingest.pipe` will fill teh dat from the date X

```
tb push datasources/ping_response.datasource
tb push pipes/tb_materialize_until_change_ingest.pipe
# after the given ts, it is time to run the backfill populate
tb push pipes/tb_backfill_populate.pipe --populate --wait
# after populate ends, it is time to remove the pipe
tb pipe rm tb_backfill_populate  --yes
```

Link to the [issue](https://github.com/openstatusHQ/openstatus/issues/278) from
Gonzalo as reference.

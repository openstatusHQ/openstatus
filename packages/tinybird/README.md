### A guide on how to migrate your tinybird datasource

> What to do when you want to add/remove/update a column in your `datasource`.

The `_migration` folder includes:

- `ping_response__v4.datasource` which represents the `VERSION 4` of our
  datasource
- `ping_response.datasource` which has the upgraded schema and a new `VERSION 5`
- `tb_backfill_populate.pipe` will fill the datasource with all the data until a
  given timestamp
- `tb_materialized_until_change_ingest.pipe` will fill the data from a given
  timestamp

```
tb push _migration/ping_response.datasource
tb push _migration/tb_materialized_until_change_ingest.pipe
# after the given ts, it is time to run the backfill populate
tb push _migration/tb_backfill_populate.pipe --populate --wait
# after populate ends, it is time to remove the pipe
tb pipe rm tb_backfill_populate  --yes
```

Check if all the rows have been migrated:

```
tb pipe _migration/tb_datasource_union.pipe
# after checking the result of the pipe
tb pipe rm tb_datasource_union.pipe --yes
```

---

Link to the [issue](https://github.com/openstatusHQ/openstatus/issues/278) from
Gonzalo as reference.


<!-- FIXME: more content -->

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install tinybird-cli
tb auth -i
```

```bash
tb pull
tb push aggregate_*.pipe --populate
tb push endpoint_*.pipe
...
```
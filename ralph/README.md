Ralph is a technique for running AI coding agents in a loop. Our approach is taken from Matt Pocock's [Getting Started with Ralph](https://www.aihero.dev/getting-started-with-ralph) writeup. Make sure to have everything installed.

The `prd.json` file is an array of object with the following format:

```
{
  "category": "functional",
  "description": "When a user is on wrong dashboard /status-pages/[id] redirect him to /status-pages",
  "steps": [
    "Redirect user no access for page id",
    "Avoid throwing an error",
  ],
  "passes": false
}
```

- category: "functional" | "ui" or other categories
- description: define what you are building
- steps: break the task down into multiple smaller steps
- passes: determines whether or not all defined steps and tests have succeed or not and makes it easier to track progress

The `progress.txt` file simply keeps track of the changes and implementation decisions.

You can run Ralph with a human-in-the-loop by running:

```
./ralph-once.sh
```

Or in AFK mode within the sandbox environment by specifying the iteration number with:

```
./afk-raph.sh 10
```
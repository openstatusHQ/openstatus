import { Effect, Schedule } from "effect";
const id = 1;
const alertResult = Effect.tryPromise({
  try: () => {
  const random = Math.random();
    if (random < 0.5) {
      console.log('error')
      throw new Error("Random failure");
    }
    return fetch(`https://jsonplaceholder.typicode.com/todos/${id}`)
},
        catch: (_unknown) => new Error("Failed"),
      }).pipe(Effect.retry({ times: 3, schedule: Schedule.exponential("1000 millis") }));
      Effect.runPromise(alertResult).then((response) => response.json()).then((data) => console.log(data))
;
